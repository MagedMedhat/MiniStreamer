import { Router } from "express";
import {
  getVideos,
  getVideo,
  streamVideo,
} from "./video.controller.js";

const router = Router();

router.get("/", getVideos);
router.get("/:id", getVideo);
router.get("/:id/stream", streamVideo);

export default router;
