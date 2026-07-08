import type { PrismaClient } from "@prisma/client";
import type { WebSocket } from "ws";
import type { Country, WsOutMessage } from "@arcanorum/shared";
import { TtlAsyncCache } from "./ttlAsyncCache";

const COUNTRY_QUERY_CACHE_TTL_MS = 2_000;

export const countrySelect = {
  id: true,
  name: true,
  color: true,
  flagUrl: true,
  crestUrl: true,
  cultureId: true,
  cultureName: true,
  cultureColor: true,
  cultureLogoUrl: true,
  religionId: true,
  religionName: true,
  religionColor: true,
  religionLogoUrl: true,
  cultureGroupId: true,
  religionGroupId: true,
  raceId: true,
  isAdmin: true,
  isLocked: true,
  blockedUntilTurn: true,
  blockedUntilAt: true,
  lockReason: true,
  ignoreUntilTurn: true,
  eventLogRetentionTurns: true,
  isRegistrationApproved: true,
} as const;

type CountryRow = {
  id: string;
  name: string;
  color: string;
  flagUrl: string | null;
  crestUrl: string | null;
  cultureId: string;
  cultureName: string;
  cultureColor: string;
  cultureLogoUrl: string | null;
  religionId: string;
  religionName: string;
  religionColor: string;
  religionLogoUrl: string | null;
  cultureGroupId: string;
  religionGroupId: string;
  raceId: string;
  isAdmin: boolean;
  isLocked: boolean;
  blockedUntilTurn: number | null;
  blockedUntilAt: Date | null;
  lockReason?: string | null;
  ignoreUntilTurn: number | null;
  eventLogRetentionTurns?: number | null;
};

type RegistrationApprovalCountry = {
  id: string;
  name: string;
  color: string;
  flagUrl: string | null;
  crestUrl: string | null;
  createdAt?: Date | null;
};

type CountryRuntimeHelpersParams = {
  prisma: PrismaClient;
  getCountryMarketId: (countryId: string) => string;
  sendPendingNotificationsToSocket: (
    socket: WebSocket,
    notifications: Array<Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"]>,
    audience: "admins",
    viewerCountryId: string,
  ) => void;
};

export function createCountryRuntimeHelpers(params: CountryRuntimeHelpersParams) {
  const countryQueryCache = new TtlAsyncCache({ defaultTtlMs: COUNTRY_QUERY_CACHE_TTL_MS });

  function invalidateCountryQueryCache(): void {
    countryQueryCache.clear();
  }

  async function getCachedCountryQuery<T>(input: { key: string; ttlMs?: number; loader: () => Promise<T> }): Promise<T> {
    return countryQueryCache.get(input);
  }

  function countryFromDb(row: CountryRow): Country {
    return {
      ...row,
      marketId: params.getCountryMarketId(row.id),
      blockedUntilAt: row.blockedUntilAt ? row.blockedUntilAt.toISOString() : null,
      lockReason: row.lockReason ?? null,
    };
  }

  function makeRegistrationApprovalUiNotification(
    country: RegistrationApprovalCountry,
  ): Extract<WsOutMessage, { type: "UI_NOTIFY" }>["notification"] {
    return {
      id: `registration-approval:${country.id}`,
      category: "registration",
      createdAt: (country.createdAt ?? new Date()).toISOString(),
      action: {
        type: "registration-approval",
        country: {
          id: country.id,
          name: country.name,
          color: country.color,
          flagUrl: country.flagUrl,
          crestUrl: country.crestUrl,
        },
      },
    };
  }

  async function sendPendingRegistrationNotificationsToAdminSocket(
    socket: WebSocket,
    adminCountryId: string,
  ): Promise<void> {
    const pending = await getCachedCountryQuery({
      key: "country:pending-registration",
      loader: () =>
        params.prisma.country.findMany({
          where: { isRegistrationApproved: false },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            color: true,
            flagUrl: true,
            crestUrl: true,
            createdAt: true,
          },
        }),
    });
    params.sendPendingNotificationsToSocket(
      socket,
      pending.map(makeRegistrationApprovalUiNotification),
      "admins",
      adminCountryId,
    );
  }

  function getCountrySkipInfo(
    country: { ignoreUntilTurn: number | null },
    currentTurn: number,
  ): { ignored: boolean; ignoreUntilTurn: number | null } {
    if (country.ignoreUntilTurn != null && currentTurn <= country.ignoreUntilTurn) {
      return { ignored: true, ignoreUntilTurn: country.ignoreUntilTurn };
    }
    return { ignored: false, ignoreUntilTurn: null };
  }

  function getCountryBlockInfo(
    country: { isLocked: boolean; blockedUntilTurn: number | null; blockedUntilAt: Date | null },
    currentTurn: number,
    now: Date,
  ): { blocked: boolean; reason: "PERMANENT" | "TURN" | "TIME" | null; blockedUntilTurn: number | null; blockedUntilAt: Date | null } {
    if (country.isLocked) {
      return { blocked: true, reason: "PERMANENT", blockedUntilTurn: null, blockedUntilAt: null };
    }
    if (country.blockedUntilTurn != null && currentTurn <= country.blockedUntilTurn) {
      return { blocked: true, reason: "TURN", blockedUntilTurn: country.blockedUntilTurn, blockedUntilAt: null };
    }
    if (country.blockedUntilAt != null && country.blockedUntilAt > now) {
      return { blocked: true, reason: "TIME", blockedUntilTurn: null, blockedUntilAt: country.blockedUntilAt };
    }
    return { blocked: false, reason: null, blockedUntilTurn: null, blockedUntilAt: null };
  }

  async function cleanupExpiredPunishments(currentTurn: number, now: Date): Promise<void> {
    const clearedByTurn = await params.prisma.country.updateMany({
      where: {
        isLocked: false,
        blockedUntilTurn: { lt: currentTurn },
      },
      data: { blockedUntilTurn: null },
    });

    const clearedByTime = await params.prisma.country.updateMany({
      where: {
        isLocked: false,
        blockedUntilAt: { lt: now },
      },
      data: { blockedUntilAt: null },
    });
    if (clearedByTurn.count > 0 || clearedByTime.count > 0) {
      invalidateCountryQueryCache();
    }
  }

  return {
    cleanupExpiredPunishments,
    countryFromDb,
    getCachedCountryQuery,
    getCountryBlockInfo,
    getCountrySkipInfo,
    invalidateCountryQueryCache,
    makeRegistrationApprovalUiNotification,
    sendPendingRegistrationNotificationsToAdminSocket,
  };
}
