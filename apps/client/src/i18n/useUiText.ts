import { useMemo, useSyncExternalStore } from "react";
import { getUiLocale, setUiLocale, subscribeUiLocale, tUi, type UiLocale, type UiTextKey } from "./uiText";

type UiTranslator = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: UiTextKey, params?: Record<string, string | number>) => string;
};

export function useUiText(): UiTranslator {
  const locale = useSyncExternalStore(subscribeUiLocale, getUiLocale, getUiLocale);

  return useMemo(
    () => ({
      locale,
      setLocale: setUiLocale,
      t: (key: UiTextKey, params: Record<string, string | number> = {}) => tUi(key, params, locale),
    }),
    [locale],
  );
}
