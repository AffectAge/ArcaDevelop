import { unlinkSync } from "node:fs";
import {
  collectUploadPathsFromUnknown,
  extractUploadRelativePathFromUrl,
  listUploadFilesRecursively,
  resolveUploadPathInsideRoot,
} from "./uploadValidation";

export type UploadReferenceRecord = {
  flagUrl?: string | null;
  crestUrl?: string | null;
  cultureLogoUrl?: string | null;
  religionLogoUrl?: string | null;
};

export type UploadCleanupLogger = {
  warn: (message: string) => void;
  info: (message: string) => void;
};

export type UploadCleanupResult =
  | { status: "disabled" }
  | { status: "skipped-no-references"; totalFiles: number }
  | { status: "skipped-suspicious-ratio"; totalFiles: number; orphanFiles: number; orphanRatio: number }
  | { status: "nothing-to-remove"; totalFiles: number; referencedFiles: number }
  | { status: "removed"; totalFiles: number; orphanFiles: number; removedFiles: number; referencedFiles: number };

export function cleanupOrphanUploads(options: {
  enabled: boolean;
  uploadsRoot: string;
  referencedData: unknown[];
  uploadReferenceRecords: UploadReferenceRecord[];
  logger?: UploadCleanupLogger;
}): UploadCleanupResult {
  if (!options.enabled) {
    return { status: "disabled" };
  }

  const logger = options.logger ?? console;
  const referenced = new Set<string>();
  for (const data of options.referencedData) {
    collectUploadPathsFromUnknown(data, referenced);
  }
  for (const record of options.uploadReferenceRecords) {
    const flagRel = extractUploadRelativePathFromUrl(record.flagUrl);
    if (flagRel) referenced.add(flagRel);
    const crestRel = extractUploadRelativePathFromUrl(record.crestUrl);
    if (crestRel) referenced.add(crestRel);
    const cultureLogoRel = extractUploadRelativePathFromUrl(record.cultureLogoUrl);
    if (cultureLogoRel) referenced.add(cultureLogoRel);
    const religionLogoRel = extractUploadRelativePathFromUrl(record.religionLogoUrl);
    if (religionLogoRel) referenced.add(religionLogoRel);
  }

  const uploadFiles = listUploadFilesRecursively(options.uploadsRoot);
  const orphanFiles = uploadFiles.filter((path) => !referenced.has(path));
  if (uploadFiles.length > 0 && referenced.size === 0) {
    logger.warn("[uploads] Startup cleanup skipped: no references detected.");
    return { status: "skipped-no-references", totalFiles: uploadFiles.length };
  }

  const orphanRatio = uploadFiles.length > 0 ? orphanFiles.length / uploadFiles.length : 0;
  if (orphanFiles.length > 10 && orphanRatio > 0.8) {
    logger.warn(
      `[uploads] Startup cleanup skipped: suspicious orphan ratio ${Math.round(orphanRatio * 100)}% (${orphanFiles.length}/${uploadFiles.length}).`,
    );
    return {
      status: "skipped-suspicious-ratio",
      totalFiles: uploadFiles.length,
      orphanFiles: orphanFiles.length,
      orphanRatio,
    };
  }

  if (orphanFiles.length === 0) {
    return { status: "nothing-to-remove", totalFiles: uploadFiles.length, referencedFiles: referenced.size };
  }

  let removed = 0;
  for (const rel of orphanFiles) {
    const absolute = resolveUploadPathInsideRoot(options.uploadsRoot, rel);
    if (!absolute) continue;
    try {
      unlinkSync(absolute);
      removed += 1;
    } catch {
      // Ignore per-file delete failures and continue cleanup.
    }
  }

  logger.info(
    `[uploads] Startup cleanup removed ${removed}/${orphanFiles.length} orphan files (tracked=${referenced.size}).`,
  );
  return {
    status: "removed",
    totalFiles: uploadFiles.length,
    orphanFiles: orphanFiles.length,
    removedFiles: removed,
    referencedFiles: referenced.size,
  };
}
