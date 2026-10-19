const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const VIDEO_PATH = path.join(__dirname, "storage", "originals", "FFmpeg.mp4");
const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB

app.use(express.static(path.join(__dirname, "public")));

app.get("/video", (req, res) => {
  const { size } = fs.statSync(VIDEO_PATH);
  const range = req.headers.range;

  // Case 1: no Range header, send the whole file
  if (!range) {
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": size,
      "Accept-Ranges": "bytes",
    });
    return fs.createReadStream(VIDEO_PATH).pipe(res);
  }

  // Case 2: parse "bytes=START-END"
  const [startStr, endStr] = range.replace("bytes=", "").split("-");
  const start = parseInt(startStr, 10);
  const end = endStr
    ? parseInt(endStr, 10)
    : Math.min(start + CHUNK_SIZE - 1, size - 1);

  if (Number.isNaN(start) || start >= size || end >= size || start > end) {
    res.writeHead(416, { "Content-Range": `bytes */${size}` });
    return res.end();
  }

  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": "video/mp4",
  });

  fs.createReadStream(VIDEO_PATH, { start, end }).pipe(res);
});

app.listen(3000, () => console.log("http://localhost:3000"));
