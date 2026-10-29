import { spawn } from "child_process";

export function runFfmpeg(args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { cwd });

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk).slice(-4000);
    });

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}
