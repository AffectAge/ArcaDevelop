import { join } from "node:path";
import multer from "multer";
import { describe, expect, it } from "vitest";
import { getActiveScenarioUploadsRoot, resolveContentUploadDir, resolveUploadDir } from "./uploadPaths";
import {
  ONLY_IMAGES_UPLOAD_ERROR,
  UPLOAD_FILE_SIZE_LIMIT_BYTES,
  buildUploadFileName,
  isUploadFileSizeError,
  resolveUploadDestination,
} from "./uploadMiddleware";

describe("uploadMiddleware", () => {
  it("resolves upload destinations by field name", () => {
    expect(resolveUploadDestination("cultureLogo", "goods")).toBe(resolveContentUploadDir("goods"));
    expect(resolveUploadDestination("racePortrait")).toBe(resolveContentUploadDir("races"));
    expect(resolveUploadDestination("flag")).toBe(resolveUploadDir("flags"));
    expect(resolveUploadDestination("unknown")).toBe(resolveUploadDir("crests"));
    expect(resolveUploadDestination("flag")).toBe(join(getActiveScenarioUploadsRoot(), "flags"));
  });

  it("builds stable upload filenames from an injected id", () => {
    expect(buildUploadFileName("Flag.PNG", "file-id")).toBe("file-id.png");
    expect(buildUploadFileName("no-extension", "file-id")).toBe("file-id.png");
  });

  it("detects multer file size errors", () => {
    expect(isUploadFileSizeError(new multer.MulterError("LIMIT_FILE_SIZE"))).toBe(true);
    expect(isUploadFileSizeError(new multer.MulterError("LIMIT_FIELD_COUNT"))).toBe(false);
    expect(isUploadFileSizeError(new Error(ONLY_IMAGES_UPLOAD_ERROR))).toBe(false);
  });

  it("keeps the expected upload file size limit", () => {
    expect(UPLOAD_FILE_SIZE_LIMIT_BYTES).toBe(4 * 1024 * 1024);
  });
});
