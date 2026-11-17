import * as videoService from "./video.service.js";
import streamFile from "../../utils/streamFile.js";


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
