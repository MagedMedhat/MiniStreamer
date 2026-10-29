import express from "express";
import path from "path";
import { STORAGE_ROOT } from "./config/env.js";
import videoRoutes from "./modules/videos/video.route.js";
import errorHandler from "./utils/errorHandler.js";

const app = express();

app.use(express.json());
app.use(express.static(path.join(import.meta.dirname, "..", "public")));
app.use("/hls", express.static(path.join(STORAGE_ROOT, "hls")));
app.use("/api/videos", videoRoutes);

app.use(errorHandler);

export default app;
