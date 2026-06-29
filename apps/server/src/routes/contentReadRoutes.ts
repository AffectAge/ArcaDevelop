import type express from "express";
import type { AssetContentEntry, GameContentEntry } from "../runtime/gameSettingsTypes";

export type ContentEntryRouteItem = GameContentEntry & Record<string, unknown>;

type ContentReadRoutesDependencies = {
  getActiveScenarioId: () => string;
  getAssets: () => AssetContentEntry[];
  parseContentKind: (raw: unknown) => { success: true; data: string } | { success: false };
  getEntriesByKind: (kind: string) => ContentEntryRouteItem[];
};

export function registerContentReadRoutes(app: express.Express, deps: ContentReadRoutesDependencies): void {
  app.get("/content/cultures", (_req, res) => {
    return res.json(withScenarioAssets(deps, { cultures: deps.getEntriesByKind("cultures") }));
  });

  app.get("/content/entries/:kind", (req, res) => {
    const parsed = deps.parseContentKind(req.params.kind);
    if (!parsed.success) {
      return res.status(404).json({ error: "CONTENT_KIND_NOT_FOUND" });
    }
    return res.json(withScenarioAssets(deps, { items: deps.getEntriesByKind(parsed.data) }));
  });
}

function withScenarioAssets<T extends Record<string, unknown>>(deps: ContentReadRoutesDependencies, payload: T): T & {
  activeScenarioId: string;
  assets: AssetContentEntry[];
} {
  return {
    ...payload,
    activeScenarioId: deps.getActiveScenarioId(),
    assets: deps.getAssets(),
  };
}
