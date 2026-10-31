import { Queue } from "bullmq";
import { connection } from "../../config/redis.js";
import { QUEUE_NAME, MAX_ATTEMPTS } from "./transcoding.constants.js";

const queue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: MAX_ATTEMPTS,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: 3600 }, // 1 hour
    removeOnFail: { age: 7 * 24 * 3600 }, // 1 week
  },
});

export const enqueue = (videoId) =>
  queue.add(
    "transcode",
    { videoId: String(videoId) },
    { jobId: String(videoId) },
  );
