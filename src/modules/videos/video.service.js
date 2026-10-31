import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Video from "../../models/video.model.js";
import AppError from "../../error/AppError.js";
import { STORAGE_ROOT } from "../../config/env.js";
import { enqueue } from "../transcoding/transcoding.queue.js";


export const listVideos = () =>
  Video.find()
    .sort({ createdAt: -1 })
    .select("title status size duration createdAt");

export const getVideoById = async (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Video not found", 404);

  const video = await Video.findById(id);
  if (!video) throw new AppError("Video not found", 404);

  return video;
};

export const getVideoSource = async (id) => {
  const video = await getVideoById(id);
  return {
    filePath: path.join(STORAGE_ROOT, video.originalPath),
    mimeType: video.mimeType,
  };
};

export const createVideoFromUpload = async (upload) => {
  const { filename = "video", filetype, title } = upload.metadata ?? {};

  const video = await Video.create({
    _id: upload.id,
    title: (title || "").trim() || path.parse(filename).name,
    originalName: filename,
    originalPath: path.posix.join("originals", upload.id),
    size: upload.size,
    mimeType: filetype,
  });
  enqueue(video._id);
  return video;
};
