export const CODE_GUARD_SCANNED_ROOTS = [
  "apps/server/src/app",
  "apps/server/src/scenarios",
  "apps/server/src/map",
  "apps/server/src/lifecycle",
  "apps/server/src/mechanics",
  "apps/server/src/security",
  "apps/server/src/persistence",
  "apps/server/src/runtime",
  "apps/server/src/routes",
  "apps/server/src/uploads",
  "apps/server/scripts",
  "packages/shared/src",
  "scripts",
] as const;

export const SCENARIO_DATA_GUARD_ROOT = "apps/server/data/scenarios";

export const CLIENT_THEME_TOKEN_GUARD_PATHS = [
  "apps/client/src/components/templates",
] as const;

export const CLIENT_LOCALIZED_TEXT_GUARD_PATHS = [
  "apps/client/src/components/templates",
  "apps/client/src/components/map-hud",
  "apps/client/src/components/ClientSettingsModal.tsx",
  "apps/client/src/components/ColonizationModal.tsx",
] as const;
