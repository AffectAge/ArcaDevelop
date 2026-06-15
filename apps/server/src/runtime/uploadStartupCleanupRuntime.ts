import type { PrismaClient } from "@prisma/client";
import { cleanupOrphanUploads } from "../uploads/uploadCleanup";

type UploadStartupCleanupRuntimeParams = {
  prisma: PrismaClient;
  enabled: boolean;
  getUploadsRoot: () => string;
  getReferencedData: () => unknown[];
  logger?: {
    warn: (message: string) => void;
    info: (message: string) => void;
    error: (message: string, error: unknown) => void;
  };
};

export function createUploadStartupCleanupRuntime(params: UploadStartupCleanupRuntimeParams): {
  cleanupOrphanUploadsOnServerStart: () => Promise<void>;
} {
  const logger = params.logger ?? console;

  async function cleanupOrphanUploadsOnServerStart(): Promise<void> {
    try {
      const countries = await params.prisma.country.findMany({
        select: {
          flagUrl: true,
          crestUrl: true,
        },
      });
      cleanupOrphanUploads({
        enabled: params.enabled,
        uploadsRoot: params.getUploadsRoot(),
        referencedData: params.getReferencedData(),
        uploadReferenceRecords: countries,
        logger: { warn: logger.warn, info: logger.info },
      });
    } catch (error) {
      logger.error("[uploads] Startup cleanup failed:", error);
    }
  }

  return { cleanupOrphanUploadsOnServerStart };
}
