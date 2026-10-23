const mongoose = require("mongoose");

const renditionSchema = new mongoose.Schema(
  {
    name: String, // "360p"
    width: Number,
    height: Number,
    bitrate: Number, // bits per second
    playlist: String, // relative path, e.g. "hls/<id>/360p/playlist.m3u8"
  },
  { _id: false },
);

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    originalName: String,
    originalPath: { type: String, required: true },
    size: Number,
    mimeType: String,
    status: {
      type: String,
      enum: ["uploaded", "processing", "ready", "failed"],
      default: "uploaded",
    },
    duration: { type: Number, default: null },
    renditions: { type: [renditionSchema], default: [] },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Video", videoSchema);
