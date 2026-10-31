import { Worker } from "bullmq";
import connectDB from "./config/db.js";
import fs from "fs";
import path from "path";
import { STORAGE_ROOT } from "./config/env.js";
import { connection } from "./config/redis.js";
import Video from "./models/video.model.js";
import { transcode } from "./modules/transcoding/transcoding.service.js";
import { QUEUE_NAME } from "./modules/transcoding/transcoding.constants.js";

await connectDB();

const worker = new Worker(QUEUE_NAME, (job) => transcode(job.data.videoId), {
  connection,
  concurrency: 1,
});

worker.on("completed", (job) => console.log(`Job ${job.id} done`));

worker.on("failed", async (job, err) => {
  console.error(
    `Job ${job?.id} failed (${job?.attemptsMade}/${job?.opts.attempts}):`,
    err.message,
  );
  if (job && job.attemptsMade >= job.opts.attempts) {
    try {
      await Video.findByIdAndUpdate(job.data.videoId, { status: "failed" });
      await fs.promises.rm(path.join(STORAGE_ROOT, "hls", job.data.videoId), {
        recursive: true,
        force: true,
      });
    } catch (err) {
      console.error("Cleanup after final failure failed:", err.message);
    }
  }
});

worker.on("error", (err) => console.error("Worker error:", err));

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
