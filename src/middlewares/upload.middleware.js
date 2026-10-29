import multer from "multer";
import mongoose from "mongoose";
import path from "path";
import AppError from "../error/AppError.js";
import { STORAGE_ROOT } from "../config/env.js";
import {
  EXTENSIONS,
  MAX_FILE_SIZE,
} from "../modules/videos/video.constants.js";

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
  cb(new AppError("Unsupported file type", 415));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const uploadVideoFile = [assignId, upload.single("video")];
