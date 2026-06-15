import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import multer from "multer";
import {
  resolveContentUploadDir,
  resolveUploadDir,
  resourceIconFields,
} from "./uploadPaths";

export const ONLY_IMAGES_UPLOAD_ERROR = "ONLY_IMAGES";
export const UPLOAD_FILE_SIZE_LIMIT_BYTES = 4 * 1024 * 1024;

export function resolveUploadDestination(fieldname: string, kindParam?: string): string {
  if (fieldname === "civilopediaImage") return resolveUploadDir("civilopedia");
  if (resourceIconFields.has(fieldname)) return resolveUploadDir("resource-icons");
  if (fieldname === "uiBackground") return resolveUploadDir("ui-backgrounds");
  if (fieldname === "marketLogo") return resolveUploadDir("markets");
  if (fieldname === "cultureLogo") return resolveContentUploadDir(kindParam);
  if (fieldname === "divisionIcon") return resolveUploadDir("division-icons");
  if (fieldname === "racePortrait") return resolveContentUploadDir("races");
  if (fieldname === "flag") return resolveUploadDir("flags");
  return resolveUploadDir("crests");
}

export function buildUploadFileName(originalName: string, id: string = randomUUID()): string {
  const ext = extname(originalName) || ".png";
  return `${id}${ext.toLowerCase()}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const kindParam = typeof req.params.kind === "string" ? req.params.kind : undefined;
    cb(null, resolveUploadDestination(file.fieldname, kindParam));
  },
  filename: (_req, file, cb) => {
    cb(null, buildUploadFileName(file.originalname));
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: UPLOAD_FILE_SIZE_LIMIT_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error(ONLY_IMAGES_UPLOAD_ERROR));
  },
});

export function isUploadFileSizeError(error: unknown): boolean {
  return error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
}
