const fs = require("fs");

const CHUNK_SIZE = 1024 * 1024; // 1 MB

function pipeFile(res, filePath, options) {
  const stream = fs.createReadStream(filePath, options);
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

async function streamFile(req, res, filePath, mimeType) {
  let size;
  try {
    ({ size } = await fs.promises.stat(filePath));
  } catch {
    return res.status(404).json({ error: "Video file is missing on disk" });
  }

  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": size,
      "Accept-Ranges": "bytes",
    });
    return pipeFile(res, filePath);
  }

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
    "Content-Type": mimeType,
  });
  pipeFile(res, filePath, { start, end });
}

module.exports = streamFile;
