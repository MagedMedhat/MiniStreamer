import { Router } from "express";
import { uploadVideoFile } from "../../middlewares/upload.middleware.js";
import {
  createVideo,
  getVideos,
  getVideo,
  streamVideo,
} from "./video.controller.js";

const router = Router();

router.post("/", uploadVideoFile, createVideo);
router.get("/", getVideos);
router.get("/:id", getVideo);
router.get("/:id/stream", streamVideo);

export default router;
