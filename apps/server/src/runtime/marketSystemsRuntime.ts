import type { PrismaClient } from "@prisma/client";
import type { Adm1ProvinceIndexEntry } from "../map/provinceIndex";
import type { GameSettings } from "./gameSettingsTypes";
import type { WorldBase } from "@arcanorum/shared";
import { createMarketAccessRuntime } from "./marketAccessRuntime";
import { createMarketRuntimeFacade } from "./marketRuntimeFacade";

type MarketSystemsRuntimeParams = {
  prisma: PrismaClient;
  getGameSettings: () => GameSettings;
  getWorldBase: () => WorldBase;
  getTurnId: () => number;
  getProvinceIndex: () => Adm1ProvinceIndexEntry[];
  getProvinceOwner: (provinceId: string) => string | null;
  corridorLoadHistoryLength: number;
  removeUploadedByUrl: (url: string) => void;
  round3: (value: number) => number;
};

export function createMarketSystemsRuntime(params: MarketSystemsRuntimeParams): {
  marketAccessRuntime: ReturnType<typeof createMarketAccessRuntime>;
  marketRuntimeFacade: ReturnType<typeof createMarketRuntimeFacade>;
} {
  const marketAccessRuntime = createMarketAccessRuntime({
    getProvinceIndex: params.getProvinceIndex,
    getGameSettings: params.getGameSettings,
    getTurnId: params.getTurnId,
    getProvinceOwner: params.getProvinceOwner,
    round3: params.round3,
  });

  const marketRuntimeFacade = createMarketRuntimeFacade({
    getContext: () => ({
      gameSettings: params.getGameSettings(),
      worldBase: params.getWorldBase(),
      provinceIndex: params.getProvinceIndex(),
      corridorLoadHistoryLength: params.corridorLoadHistoryLength,
    }),
    removeUploadedByUrl: params.removeUploadedByUrl,
    findCountryNamesByIds: (countryIds) =>
      params.prisma.country.findMany({
        where: { id: { in: countryIds } },
        select: { id: true, name: true },
      }),
  });

  return { marketAccessRuntime, marketRuntimeFacade };
}
