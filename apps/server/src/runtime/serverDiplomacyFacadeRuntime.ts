import type { createDiplomacyRouteComposition } from "./diplomacyRouteComposition";
import { createRuntimeRef } from "./runtimeRef";

type DiplomacyRuntimeInstance = ReturnType<typeof createDiplomacyRouteComposition>;

export function createServerDiplomacyFacadeRuntime(): {
  diplomacyRuntimeRef: ReturnType<typeof createRuntimeRef<DiplomacyRuntimeInstance>>["ref"];
  diplomacyFacade: {
    refreshExpiredDiplomacyProposals: () => void;
    applyPerTurnTreatyMoneyTransfers: () => void;
  };
} {
  const { ref: diplomacyRuntimeRef, get: getDiplomacyRuntime } =
    createRuntimeRef<DiplomacyRuntimeInstance>("Diplomacy runtime");

  return {
    diplomacyRuntimeRef,
    diplomacyFacade: {
      refreshExpiredDiplomacyProposals: () => getDiplomacyRuntime().refreshExpiredDiplomacyProposals(),
      applyPerTurnTreatyMoneyTransfers: () => getDiplomacyRuntime().applyPerTurnTreatyMoneyTransfers(),
    },
  };
}
