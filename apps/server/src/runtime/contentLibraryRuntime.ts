import { readContentLibraryFile, writeContentLibraryFile, type PersistedContentLibrary } from "../persistence/contentLibraryFile";
import type { GameSettings } from "./gameSettingsTypes";

type ContentLibraryRuntimeParams = {
  path: string;
  getGameSettings: () => GameSettings;
  logError: (message: string, error: unknown) => void;
};

export function createContentLibraryRuntime(params: ContentLibraryRuntimeParams) {
  let cachedPersistedContentLibrary: PersistedContentLibrary | null | undefined;

  function getPersistedContentLibraryFromDisk(): PersistedContentLibrary | null {
    if (cachedPersistedContentLibrary !== undefined) {
      return cachedPersistedContentLibrary;
    }
    const result = readContentLibraryFile(params.path);
    if (result.status === "missing") {
      cachedPersistedContentLibrary = null;
      return null;
    }
    if (result.status === "invalid") {
      params.logError("[content-library] Failed to read content-library.json:", result.error);
      cachedPersistedContentLibrary = null;
      return null;
    }
    cachedPersistedContentLibrary = result.data;
    return cachedPersistedContentLibrary;
  }

  function persistContentLibraryFromSettings(): void {
    const gameSettings = params.getGameSettings();
    const snapshot = {
      content: gameSettings.content,
      civilopedia: gameSettings.civilopedia,
      map: {
        backgroundImageUrl: gameSettings.map.backgroundImageUrl,
      },
      resourceIcons: gameSettings.resourceIcons,
      updatedAt: new Date().toISOString(),
    };
    const result = writeContentLibraryFile(params.path, snapshot);
    if (result.ok) {
      cachedPersistedContentLibrary = snapshot;
      return;
    }
    params.logError("[content-library] Failed to persist content-library.json:", result.error);
  }

  function clearPersistedContentLibraryCache(): void {
    cachedPersistedContentLibrary = undefined;
  }

  return {
    clearPersistedContentLibraryCache,
    getPersistedContentLibraryFromDisk,
    persistContentLibraryFromSettings,
  };
}
