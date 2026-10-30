import path from "path";
import mongoose from "mongoose";
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { STORAGE_ROOT } from "../../config/env.js";
import { EXTENSIONS, MAX_FILE_SIZE } from "../videos/video.constants.js";
import { createVideoFromUpload } from "../videos/video.service.js";
import fs from "fs/promises";

const UPLOADS_DIR = path.join(STORAGE_ROOT, "uploads");
const ORIGINALS_DIR = path.join(STORAGE_ROOT, "originals");

const datastore = new FileStore({
  directory: UPLOADS_DIR,
  expirationPeriodInMilliseconds: 24 * 60 * 60 * 1000, //24 hours
});
export const tusServer = new Server({
  path: "/api/uploads",
  datastore,
  maxSize: MAX_FILE_SIZE,
  namingFunction: () => String(new mongoose.Types.ObjectId()),

  async onUploadCreate(req, upload) {
    if (!EXTENSIONS[upload.metadata?.filetype]) {
      throw { status_code: 415, body: "Unsupported file type" };
    }
    return { metadata: upload.metadata };
  },

  async onUploadFinish(req, upload) {
    const from = path.join(UPLOADS_DIR, upload.id);
    const to = path.join(ORIGINALS_DIR, upload.id);

    try {
      await fs.rename(from, to);
      await fs.rm(`${from}.json`, { force: true });
      await createVideoFromUpload(upload);
    } catch (err) {
      console.error(`Finishing upload ${upload.id} failed:`, err);
      await fs.rm(from, { force: true });
      await fs.rm(to, { force: true });
      await fs.rm(`${from}.json`, { force: true });
      throw { status_code: 500, body: "Could not save the video" };
    }
    return {};
  },
});

export function startUploadCleanup() {
  const run = async () => {
    try {
      const removed = await tusServer.cleanUpExpiredUploads();
      if (removed) console.log(`Removed ${removed} expired uploads`);
    } catch (err) {
      console.error("Upload cleanup failed:", err.message);
    }
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
