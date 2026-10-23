require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const { PORT, MONGO_URI, STORAGE_ROOT } = require("./src/config");
const videoRoutes = require("./src/routes/videos");

fs.mkdirSync(path.join(STORAGE_ROOT, "originals"), { recursive: true });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/videos", videoRoutes);

app.use((err, req, res, next) => {
  let status = err.status || 500;
  if (err instanceof multer.MulterError) {
    status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  } else if (err.name === "ValidationError") {
    status = 400;
  }
  if (status === 500) console.error(err);
  res
    .status(status)
    .json({ error: status === 500 ? "Internal server error" : err.message });
});

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
