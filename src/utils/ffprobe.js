import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function probe(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ]);

  const data = JSON.parse(stdout);
  const stream = data.streams && data.streams[0];
  if (!stream) throw new Error("No video stream found in file");

  return {
    width: stream.width,
    height: stream.height,
    duration: parseFloat(data.format.duration),
  };
}
