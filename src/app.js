import express from "express";
import path from "path";
import { STORAGE_ROOT } from "./config/env.js";
import videoRoutes from "./modules/videos/video.route.js";
import errorHandler from "./utils/errorHandler.js";
import { tusServer } from "./modules/uploads/tus.server.js";
const app = express();

app.use("/api/uploads", (req, res) => tusServer.handle(req, res)); // we put it before express.json because tus sends bodies as application/offset+octet-stream
app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, "..", "public")));

const HLS_ROOT = path.join(STORAGE_ROOT, "hls");
app.use(
  "/hls",
  express.static(HLS_ROOT, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".ts")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (filePath.endsWith(".m3u8")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }),
);

app.use("/api/videos", videoRoutes);

app.use(errorHandler);

export default app;
