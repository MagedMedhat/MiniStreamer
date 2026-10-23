const path = require("path");

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ministreamer",
  STORAGE_ROOT: path.resolve(
    process.env.STORAGE_ROOT || path.join(__dirname, "..", "storage"),
  ),
};
