import IORedis from "ioredis";
import { REDIS_URL } from "./env.js";

export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});
