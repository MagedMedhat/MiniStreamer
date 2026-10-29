import Video from "../../models/video.model.js";
import { transcode } from "./transcoding.service.js";

const CONCURRENCY = 1;
const jobs = [];
let running = 0;

function next() {
  while (running < CONCURRENCY && jobs.length > 0) {
    const videoId = jobs.shift();
    running++;
    transcode(videoId)
      .catch((err) => console.error("Unexpected job error:", err))
      .finally(() => {
        running--;
        next();
      });
  }
}

export function enqueue(videoId) {
  jobs.push(videoId);
  next();
}

// Pick up anything that didn't finish after a crash or restart
export async function recoverPendingJobs() {
  const pending = await Video.find({
    status: { $in: ["uploaded", "processing"] },
  }).select("_id");

  pending.forEach((v) => enqueue(v._id));
}
