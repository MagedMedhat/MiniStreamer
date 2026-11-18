# MiniStreamer

MiniStreamer is a small video streaming platform built to understand how streaming works behind the scenes. You upload a video, the backend converts it into several quality levels, and a custom browser player streams it with adaptive bitrate, manual quality switching, seeking, and hover previews on the seek bar.

It is intentionally not a YouTube clone. There are no accounts, comments, or recommendations. The scope is the core of video delivery: resumable uploads, background transcoding, HLS packaging, and a player that understands it.

## Features

- Resumable uploads of up to 500 MB (MP4, MOV, WebM, MKV) with pause, resume, and automatic retry after connection drops.
- Background transcoding to an HLS adaptive bitrate ladder (144p, 360p, 720p, 1080p), never upscaling beyond the source resolution.
- Automatic retries with exponential backoff, and resumable transcoding that skips renditions already finished.
- Seek-preview thumbnails generated as a sprite sheet with a WebVTT index.
- Custom player with Auto and manual quality selection, buffered range display, volume, fullscreen, idle-hiding controls, and keyboard shortcuts.
- A direct byte-range streaming endpoint for the original file (HTTP 206 Partial Content).
- Cache headers tuned per file type for HLS delivery.

## Tech stack

| Layer            | Technology                                                       |
| ---------------- | ---------------------------------------------------------------- |
| Runtime          | Node.js (ES modules), Express 5                                  |
| Database         | MongoDB with Mongoose 9                                          |
| Job queue        | BullMQ on Redis (ioredis)                                        |
| Uploads          | tus protocol (`@tus/server`, `@tus/file-store`, `tus-js-client`) |
| Media processing | FFmpeg and ffprobe                                               |
| Streaming format | HLS (MPEG-TS segments, 4 second segment length)                  |
| Frontend         | Plain HTML, CSS, and JavaScript with `hls.js`                    |

## Architecture

```
Browser (tus-js-client)
   |  PATCH chunks, resumable
   v
Express app  --->  tus server  --->  storage/uploads  (partial files)
                       |
                       | upload finished
                       v
              storage/originals/<id>  +  Video document (status: uploaded)
                       |
                       | enqueue(videoId)
                       v
                 Redis / BullMQ queue "transcode"
                       |
                       v
Worker process: ffprobe -> ffmpeg per rendition -> master.m3u8 -> thumbnails
                       |
                       v
   storage/hls/<id>/...   +  Video document (status: ready)
                       |
                       v
Browser (hls.js)  <--  Express static /hls  (m3u8 + ts segments)
```

The web server and the worker are two separate processes. Uploading and browsing stay responsive while FFmpeg is using the CPU, and the worker can be restarted or scaled independently.

### Storage layout

```
storage/
  uploads/            partially uploaded files and tus metadata (cleaned after 24 hours)
  originals/<id>      the original uploaded file, named by the video id
  hls/<id>/
    master.m3u8       the master playlist listing all renditions
    144p/             playlist.m3u8 and seg000.ts, seg001.ts, ...
    360p/
    720p/
    1080p/            only the renditions that fit the source height
    thumbs/
      sprite.jpg      one image containing all preview frames
      thumbs.vtt      maps time ranges to rectangles in the sprite
```

### Project structure

```
public/
  index.html          library page and uploader
  watch.html          custom HLS player
  style.css
src/
  server.js           starts the API process
  worker.js           starts the transcoding worker process
  app.js              Express wiring: tus, static files, routes, error handler
  config/             env.js, db.js, redis.js
  error/              AppError.js
  models/             video.model.js
  modules/
    uploads/          tus server configuration and upload cleanup
    videos/           route, controller, service, constants
    transcoding/      queue, ladder constants, transcoding and thumbnail services
  utils/              ffmpeg.js, ffprobe.js, streamFile.js, errorHandler.js
```

Each feature lives in its own module with separate route, controller, and service files.

## Getting started

### Prerequisites

- Node.js 20.19 or newer
- MongoDB running locally or remotely
- Redis running locally or remotely
- FFmpeg and ffprobe available on your `PATH`

### Install

```bash
npm install
```

### Configure

Create a `.env` file in the project root. All values are optional because each has a default:

```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/ministreamer
REDIS_URL=redis://127.0.0.1:6379
STORAGE_ROOT=./storage
```

### Run

Start both processes in separate terminals:

```bash
npm run dev       # API and web server
npm run worker    # transcoding worker
```

Open `http://localhost:3000`, drop a video onto the page, and click Upload. The card appears in the library as Queued, then Processing, then Ready. Click it to watch.

If the worker is not running, uploads still succeed but stay in the Queued state until a worker starts, because the jobs wait in Redis.

## How it works

### 1. Resumable upload

The browser uses `tus-js-client`, which splits the file into chunks and keeps track of the offset on the server. If the connection drops, it resumes from the last confirmed byte instead of starting over. The upload id is stored in the browser, so even a page reload can continue an interrupted upload.

On the server, `onUploadCreate` rejects any file type that is not in the allowed list before a single byte is stored. The upload id is generated as a MongoDB ObjectId, so the same id becomes the video's `_id`, the original file name, and the HLS folder name. The tus handler is mounted before `express.json()` because tus sends bodies as `application/offset+octet-stream`, which the JSON parser must not touch.

When the last chunk arrives, `onUploadFinish` moves the file from `uploads/` to `originals/`, deletes the tus metadata file, creates the `Video` document, and enqueues a transcoding job. If any of that fails, the partial files are removed and the client gets a 500. Abandoned uploads older than 24 hours are removed by an hourly cleanup.

### 2. Queue

Jobs are added to a BullMQ queue named `transcode` with the video id as the job id, so the same video cannot be queued twice. Each job gets 3 attempts with exponential backoff starting at 30 seconds. Completed jobs are kept for one hour and failed jobs for one week for inspection. The worker runs one job at a time because FFmpeg already uses multiple cores.

If all attempts fail, the worker marks the video as `failed` and deletes its partial HLS output.

### 3. Transcoding

The worker first runs ffprobe to read the source width, height, and duration, then picks the renditions that fit:

| Rendition | Video bitrate | Audio bitrate |
| --------- | ------------- | ------------- |
| 144p      | 150 kbps      | 64 kbps       |
| 360p      | 800 kbps      | 96 kbps       |
| 720p      | 2500 kbps     | 128 kbps      |
| 1080p     | 5000 kbps     | 128 kbps      |

A 720p source produces 144p, 360p, and 720p. A source smaller than 144p gets a single rendition at its own height.

Each rendition is encoded with `libx264` (veryfast preset) and AAC stereo into 4 second HLS segments. Two settings matter for correct adaptive switching: keyframes are forced every 4 seconds and scene-change keyframes are disabled. This makes every segment start on a keyframe at the same timestamp in every rendition, so the player can switch quality at any segment boundary without glitches. Bitrate is capped with `maxrate` and `bufsize` so each stream stays close to the bandwidth advertised in the master playlist.

Each rendition is written into a `<name>.tmp` folder and renamed to its final name only when FFmpeg exits successfully. A folder with the final name therefore always means a complete rendition. If a job is retried after a crash, finished renditions are skipped and only the missing ones are encoded.

After all renditions exist, the worker writes `master.m3u8` with the bandwidth and resolution of each rendition, generates the thumbnails, saves the duration and rendition list on the video, and sets the status to `ready`. A thumbnail failure is logged but does not fail the video.

### 4. Seek-preview thumbnails

One FFmpeg run extracts a frame at a regular interval and tiles them into a single `sprite.jpg`. The interval is the larger of 2 seconds and the duration divided by 100, so there are never more than about 100 frames. A `thumbs.vtt` file lists each time range together with the rectangle (`x,y,w,h`) of its frame in the sprite. The player downloads one image and one small text file, then shows the right region while the user hovers the seek bar. The library page reuses the first frame of the sprite as the card thumbnail.

### 5. Delivery

HLS files are served as static files from `/hls`:

- `.ts` segments are cached for one year as immutable, because a segment's content never changes.
- `.m3u8` playlists are sent with `no-cache`, so the player always checks for the latest version.

The original file is also available at `/api/videos/:id/stream` with full HTTP Range support. It answers `206 Partial Content` with the requested byte range, defaults open-ended ranges to 1 MB chunks, and answers `416` for invalid ranges. This endpoint is how the project started, and it is kept because it shows what seeking looks like without HLS.

### 6. Playback

`watch.html` loads the video metadata and, if the video is not ready yet, shows its status and checks again every few seconds. When it is ready, `hls.js` loads `master.m3u8` and plays through a custom control bar. Safari uses its native HLS support instead.

The quality menu offers Auto plus each available resolution. Manual selection uses `hls.nextLevel`, which applies the change at the next segment and keeps the already buffered video playing. Auto shows the resolution currently chosen by the player.

Keyboard shortcuts: Space or K toggles play, Left and Right arrows seek 5 seconds, F toggles fullscreen, M toggles mute.

## API

| Method | Path                     | Description                                               |
| ------ | ------------------------ | --------------------------------------------------------- |
| `GET`  | `/api/videos`            | List videos, newest first (title, status, size, duration) |
| `GET`  | `/api/videos/:id`        | Full details of one video, including renditions           |
| `GET`  | `/api/videos/:id/stream` | Stream the original file with Range support               |
| `*`    | `/api/uploads`           | tus protocol endpoint used by the uploader                |
| `GET`  | `/hls/:id/master.m3u8`   | HLS master playlist                                       |

Video status values: `uploaded` (queued), `processing`, `ready`, `failed`.

## Development history

The project was built in phases, and each phase was meant to teach one idea before the next one built on it.

1. **HTTP Range requests.** The first version streamed a single file and answered byte-range requests by hand. This showed how a browser asks for just the part of a file it needs, and why seeking works without downloading the whole video.
2. **Upload, model, and library.** Added a `Video` model in MongoDB, an upload flow, streaming by id, and the library and watch pages.
3. **FFmpeg and HLS.** Started by running FFmpeg manually to produce 360p and 720p renditions and hand-writing a `master.m3u8` to understand the format. Then the backend took over: ffprobe reads the source, FFmpeg encodes each rendition, and the master playlist is generated.
4. **Adaptive playback.** Added `hls.js` and the custom player with a quality menu. A 144p rendition was added to the ladder so quality changes are obvious while testing.
5. **Refactor to modules.** The code was reorganized into feature modules (route, controller, service per feature) in the same style as the earlier clinic backend project.
6. **Smooth quality switching.** Manual switching moved from `hls.currentLevel` to `hls.nextLevel`. The first flushes the buffer and stalls playback, while the second waits for the next segment boundary and switches cleanly.
7. **Cache-Control on HLS.** Immutable caching for segments and no-cache for playlists.
8. **Seek-preview thumbnails.** Sprite sheet plus WebVTT, rendered on hover in the player.
9. **Resumable uploads with tus.** Replaced the single-request upload so large files survive network drops, with pause and resume in the UI.
10. **BullMQ and Redis.** Moved transcoding out of the web process into a durable queue with retries, backoff, and a separate worker, which also made renditions idempotent.

## Known limitations

- No authentication or authorization: anyone who can reach the server can upload and watch.
- No delete or edit endpoints for videos.
- Files live on local disk, so the API and the worker must share the same `STORAGE_ROOT`.
- The tus endpoint and the segment files are public.
- One transcoding job at a time, on CPU only.
- No automated tests.

## Roadmap

- Move storage to an object store (S3-compatible) so the API and workers can run on different machines.
- Switch to CMAF fragmented MP4 segments, which allows serving both HLS and DASH from the same files.
- Video deletion with cleanup of originals, renditions, and thumbnails.
- Progress reporting during transcoding.
- Tests for the queue, transcoding service, and range streaming.

## License

This repository is open-source and available under the MIT License.