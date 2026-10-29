import fs from "fs";
import path from "path";
import Video from "../../models/video.model.js";
import { probe } from "../../utils/ffprobe.js";
import { STORAGE_ROOT } from "../../config/env.js";
import { LADDER } from "./transcoding.constants.js";
import { runFfmpeg } from "../../utils/ffmpeg.js";
import { generateThumbnails } from "./thumbnails.service.js";

function pickLadder(sourceHeight) {
  const fitting = LADDER.filter((r) => r.height <= sourceHeight);
  if (fitting.length > 0) return fitting;
  // Source is smaller than our lowest encoding quality
  const height = sourceHeight - (sourceHeight % 2);
  return [{ name: `${height}p`, height, videoBitrate: 400, audioBitrate: 64 }];
}

function buildArgs(inputPath, r) {
  const maxrate = Math.round(r.videoBitrate * 1.07);
  const bufsize = Math.round(r.videoBitrate * 1.5);
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-y",
    "-i",
    inputPath,
    "-vf",
    `scale=-2:${r.height}`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-b:v",
    `${r.videoBitrate}k`,
    "-maxrate",
    `${maxrate}k`,
    "-bufsize",
    `${bufsize}k`,
    "-force_key_frames",
    "expr:gte(t,n_forced*4)",
    "-sc_threshold",
    "0",
    "-c:a",
    "aac",
    "-b:a",
    `${r.audioBitrate}k`,
    "-ac",
    "2",
    "-f",
    "hls",
    "-hls_time",
    "4",
    "-hls_playlist_type",
    "vod",
    "-hls_segment_filename",
    "seg%03d.ts",
    "playlist.m3u8",
  ];
}

function buildMaster(renditions) {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const r of renditions) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${r.bitrate},RESOLUTION=${r.width}x${r.height}`,
    );
    lines.push(`${r.name}/playlist.m3u8`);
  }
  return lines.join("\n") + "\n";
}

export async function transcode(videoId) {
  const video = await Video.findById(videoId);
  if (!video) return;

  video.status = "processing";
  await video.save();

  const outRoot = path.join(STORAGE_ROOT, "hls", String(video._id));

  try {
    const input = path.join(STORAGE_ROOT, video.originalPath);
    const info = await probe(input);
    const ladder = pickLadder(info.height);

    await fs.promises.rm(outRoot, { recursive: true, force: true });

    const renditions = [];
    for (const r of ladder) {
      const dir = path.join(outRoot, r.name);
      await fs.promises.mkdir(dir, { recursive: true });
      await runFfmpeg(buildArgs(input, r), dir);

      renditions.push({
        name: r.name,
        width: Math.round((info.width * r.height) / info.height / 2) * 2,
        height: r.height,
        bitrate: (r.videoBitrate + r.audioBitrate) * 1000,
        playlist: path.posix.join(
          "hls",
          String(video._id),
          r.name,
          "playlist.m3u8",
        ),
      });
    }

    await fs.promises.writeFile(
      path.join(outRoot, "master.m3u8"),
      buildMaster(renditions),
    );

    try {
      await generateThumbnails({ input, outRoot, info });
    } catch (err) {
      console.error(`Thumbnails failed for ${video._id}:`, err.message);
    }

    video.duration = info.duration;
    video.renditions = renditions;
    video.status = "ready";
    await video.save();
  } catch (err) {
    console.error(`Transcoding failed for ${video._id}:`, err.message);
    video.status = "failed";
    await video.save();
    await fs.promises.rm(outRoot, { recursive: true, force: true });
  }
}
