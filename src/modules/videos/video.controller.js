import * as videoService from "./video.service.js";
import streamFile from "../../utils/streamFile.js";

// export const createVideo = async (req, res) => {
//   const video = await videoService.createVideo({
//     file: req.file,
//     videoId: req.videoId,
//     title: req.body?.title,
//   });
//   res.status(201).json(video);
// };

export const getVideos = async (req, res) => {
  res.json(await videoService.listVideos());
};

export const getVideo = async (req, res) => {
  res.json(await videoService.getVideoById(req.params.id));
};

export const streamVideo = async (req, res) => {
  const { filePath, mimeType } = await videoService.getVideoSource(
    req.params.id,
  );
  await streamFile(req, res, filePath, mimeType);
};
