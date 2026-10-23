const express = require("express");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Video = require("../models/Video");
const uploadVideo = require("../middleware/upload");
const streamFile = require("../utils/streamFile");
const { STORAGE_ROOT } = require("../config");

const router = express.Router();

// Upload
router.post("/", uploadVideo, async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'No file uploaded (form field name must be "video")' });
    }

    const title =
      (req.body.title || "").trim() || path.parse(req.file.originalname).name;

    const video = await Video.create({
      _id: req.videoId,
      title,
      originalName: req.file.originalname,
      originalPath: path.posix.join("originals", req.file.filename),
      size: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.status(201).json(video);
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {}); // don't leave orphan files
    next(err);
  }
});

// List
router.get("/", async (req, res, next) => {
  try {
    const videos = await Video.find()
      .sort({ createdAt: -1 })
      .select("title status size duration createdAt");
    res.json(videos);
  } catch (err) {
    next(err);
  }
});

// Load the video for any route with :id
router.param("id", async (req, res, next, id) => {
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: "Video not found" });
    }
    const video = await Video.findById(id);
    if (!video) return res.status(404).json({ error: "Video not found" });
    req.video = video;
    next();
  } catch (err) {
    next(err);
  }
});

// One video's metadata
router.get("/:id", (req, res) => res.json(req.video));

// Stream
router.get("/:id/stream", (req, res) => {
  const filePath = path.join(STORAGE_ROOT, req.video.originalPath);
  streamFile(req, res, filePath, req.video.mimeType);
});

module.exports = router;
