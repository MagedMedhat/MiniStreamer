const { transcode } = require("./transcoder");

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

function enqueue(videoId) {
  jobs.push(videoId);
  next();
}

module.exports = { enqueue };
