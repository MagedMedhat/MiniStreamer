import fs from "fs";
import path from "path";
import app from "./app.js";
import connectDB from "./config/db.js";
import { PORT, STORAGE_ROOT } from "./config/env.js";
import { recoverPendingJobs } from "./modules/transcoding/transcoding.queue.js";

fs.mkdirSync(path.join(STORAGE_ROOT, "originals"), { recursive: true });

await connectDB();
await recoverPendingJobs();

app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
