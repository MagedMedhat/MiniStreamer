const multer = require("multer");
const mongoose = require("mongoose");
const path = require("path");
const { STORAGE_ROOT } = require("../config");

const EXTENSIONS = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-matroska": ".mkv",
};

const assignId = (req, res, next) => {
  req.videoId = new mongoose.Types.ObjectId();
  next();
};

const storage = multer.diskStorage({
  destination: path.join(STORAGE_ROOT, "originals"),
  filename: (req, file, cb) => {
    cb(null, `${req.videoId}${EXTENSIONS[file.mimetype]}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (EXTENSIONS[file.mimetype]) return cb(null, true);
  const err = new Error("Unsupported file type");
  err.status = 415;
  cb(err);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

module.exports = [assignId, upload.single("video")];
