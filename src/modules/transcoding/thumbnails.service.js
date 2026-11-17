import fs from "fs";
import path from "path";
import { runFfmpeg } from "../../utils/ffmpeg.js";
import { THUMBNAILS } from "./transcoding.constants.js";

const pad = (n, width = 2) => String(n).padStart(width, "0");

function vttTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms % 1000, 3)}`;
}

function planSprite({ width, height, duration }) {
  const interval = Math.max(
    THUMBNAILS.MIN_INTERVAL,
    Math.ceil(duration / THUMBNAILS.MAX_COUNT),
  );
  const count = Math.ceil(duration / interval);
  const cols = Math.min(THUMBNAILS.COLUMNS, count);
  const rows = Math.ceil(count / cols);
  const thumbW = THUMBNAILS.WIDTH;
  const thumbH = Math.round((thumbW * height) / width / 2) * 2;
  return { interval, count, cols, rows, thumbW, thumbH };
}

function buildVtt({ interval, count, cols, thumbW, thumbH }, duration) {
  const lines = ["WEBVTT", ""];
  for (let i = 0; i < count; i++) {
    const start = i * interval;
    const end = Math.min((i + 1) * interval, duration);
    const x = (i % cols) * thumbW;
    const y = Math.floor(i / cols) * thumbH;
    lines.push(`${vttTime(start)} --> ${vttTime(end)}`);
    lines.push(`sprite.jpg#xywh=${x},${y},${thumbW},${thumbH}`);
    lines.push("");
  }
  return lines.join("\n");
}

export async function generateThumbnails({ input, outRoot, info }) {
  const plan = planSprite(info);
  const dir = path.join(outRoot, "thumbs");
  await fs.promises.mkdir(dir, { recursive: true });

  await runFfmpeg(
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostdin",
      "-y",
      "-i",
      input,
      "-an",
      "-vf",
      `fps=1/${plan.interval},scale=${plan.thumbW}:${plan.thumbH},tile=${plan.cols}x${plan.rows}`,
      "-frames:v",
      "1",
      "-q:v",
      "5",
      "-update",
      "1",
      "sprite.jpg",
    ],
    dir,
  );

  await fs.promises.writeFile(
    path.join(dir, "thumbs.vtt"),
    buildVtt(plan, info.duration),
  );
}
