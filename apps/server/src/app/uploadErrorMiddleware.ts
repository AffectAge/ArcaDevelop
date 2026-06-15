import type express from "express";
import { ONLY_IMAGES_UPLOAD_ERROR, isUploadFileSizeError } from "../uploads/uploadMiddleware";

export function uploadErrorMiddleware(
  err: unknown,
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (!err) {
    next();
    return;
  }

  if (isUploadFileSizeError(err)) {
    res.status(400).json({ error: "FILE_TOO_LARGE" });
    return;
  }

  if (err instanceof Error && err.message === ONLY_IMAGES_UPLOAD_ERROR) {
    res.status(400).json({ error: ONLY_IMAGES_UPLOAD_ERROR });
    return;
  }

  next(err);
}
