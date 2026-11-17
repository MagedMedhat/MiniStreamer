import multer from "multer";

export default function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = err.status || 500;

  if (err instanceof multer.MulterError) {
    status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
  } else if (err.name === "ValidationError") {
    status = 400;
  }

  if (status === 500) console.error(err);

  res.status(status).json({
    error: status === 500 ? "Internal server error" : err.message,
  });
}
