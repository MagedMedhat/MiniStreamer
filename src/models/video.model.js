import { Schema, model } from "mongoose";

const renditionSchema = new Schema(
  {
    name: String, // 360,480,..
    width: Number,
    height: Number,
    bitrate: Number,
    playlist: String,
  },
  { _id: false },
);

const videoSchema = new Schema(
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

export default model("Video", videoSchema);
