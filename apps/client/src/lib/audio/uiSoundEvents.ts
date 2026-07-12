export const UI_SOUND_EVENTS = [
  "button.click",
  "button.danger",
  "choice.select",
  "modal.open",
  "modal.close",
  "action.confirm",
  "action.reject",
  "notification.important",
] as const;

export type UiSoundEventName = (typeof UI_SOUND_EVENTS)[number];

export type UiSoundSprite = Partial<Record<UiSoundEventName, [number, number]>>;
