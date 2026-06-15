import type { ContentEntryKind } from "../content/contentEntryPayload";
import type { GameSettings } from "./gameSettingsTypes";

type ContentCatalogRuntimeParams = {
  getGameSettings: () => GameSettings;
};

export function createContentCatalogRuntime(params: ContentCatalogRuntimeParams): {
  getContentEntriesByKind: (kind: ContentEntryKind) => GameSettings["content"][ContentEntryKind];
  contentNameExists: (kind: ContentEntryKind, name: string, excludeId?: string) => boolean;
} {
  function getContentEntriesByKind(kind: ContentEntryKind): GameSettings["content"][ContentEntryKind] {
    return params.getGameSettings().content[kind];
  }

  function contentNameExists(kind: ContentEntryKind, name: string, excludeId?: string): boolean {
    return getContentEntriesByKind(kind).some(
      (entry) => entry.id !== excludeId && entry.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
  }

  return { getContentEntriesByKind, contentNameExists };
}
