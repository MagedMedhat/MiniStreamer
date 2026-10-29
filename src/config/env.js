import "dotenv/config";
import path from "path";

export const PORT = process.env.PORT || 3000;

export const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ministreamer";

export const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT ||
    path.join(import.meta.dirname, "..", "..", "storage"),
);
