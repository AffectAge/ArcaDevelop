import { DEFAULT_ADMIN_AUDIT_MAX_ENTRIES } from "../security/adminAuditLog";
import {
  DEFAULT_EXPLORATION_DEPLETION_PER_ATTEMPT_PCT,
  DEFAULT_EXPLORATION_DURATION_TURNS,
  DEFAULT_EXPLORATION_EMPTY_CHANCE_PCT,
  DEFAULT_EXPLORATION_ROLLS_PER_EXPEDITION,
} from "../mechanics/resourceExplorationMechanics";
import type { PersistedContentLibrary } from "../persistence/contentLibraryFile";
import { buildDefaultGameSettings } from "../content/defaultGameSettings";
import type { GameSettings } from "./gameSettingsTypes";

export const MAX_WORLD_DELTA_HISTORY = 512;
export const MAX_PERSISTED_WORLD_DELTA_LOG = 10_000;
export const PERSIST_STATE_DEBOUNCE_MS = 750;
export const WORLD_DELTA_LOG_PRUNE_INTERVAL_MS = 30_000;

export const DEFAULT_MAX_ACTIVE_COLONIZATIONS = 3;
export const DEFAULT_COLONIZATION_POINTS_PER_TURN = 30;
export const SETTINGS_MAX_NUMBER = 1_000_000_000_000;
export const BUILDING_BASE_THROUGHPUT = 1;
export const BUILDING_BASE_WAGE_PER_WORKER_GOLD = 0.2;
export const CORRIDOR_LOAD_HISTORY_LENGTH = 20;
export const DEFAULT_MARKET_PRICE_SMOOTHING = 0.3;
export const DEFAULT_BUILDING_DURABILITY_DECAY_PER_TURN = 10;
export const DEFAULT_BUILDING_DURABILITY_RECOVERY_PER_TURN = 5;

export function buildServerDefaultGameSettings(params: {
  persistedContentLibrary: PersistedContentLibrary | null;
}): GameSettings {
  return buildDefaultGameSettings({
    persistedContentLibrary: params.persistedContentLibrary,
    defaultAdminAuditMaxEntries: DEFAULT_ADMIN_AUDIT_MAX_ENTRIES,
    buildingDurabilityDecayPerTurn: DEFAULT_BUILDING_DURABILITY_DECAY_PER_TURN,
    buildingDurabilityRecoveryPerTurn: DEFAULT_BUILDING_DURABILITY_RECOVERY_PER_TURN,
    explorationBaseEmptyChancePct: DEFAULT_EXPLORATION_EMPTY_CHANCE_PCT,
    explorationDepletionPerAttemptPct: DEFAULT_EXPLORATION_DEPLETION_PER_ATTEMPT_PCT,
    explorationDurationTurns: DEFAULT_EXPLORATION_DURATION_TURNS,
    explorationRollsPerExpedition: DEFAULT_EXPLORATION_ROLLS_PER_EXPEDITION,
    maxActiveColonizations: DEFAULT_MAX_ACTIVE_COLONIZATIONS,
    colonizationPointsPerTurn: DEFAULT_COLONIZATION_POINTS_PER_TURN,
  });
}
