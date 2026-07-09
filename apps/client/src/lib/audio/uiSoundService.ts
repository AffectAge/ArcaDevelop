import { Howl } from "howler";
import type { UiSoundEventName, UiSoundSprite } from "./uiSoundEvents";

export type { UiSoundEventName };

type UiSoundSettings = {
  muted: boolean;
  volume: number;
};

let settings: UiSoundSettings = {
  muted: false,
  volume: 0.45,
};

let soundPack: Howl | null = null;
let registeredSprites: UiSoundSprite = {};

export function configureUiSounds(next: Partial<UiSoundSettings>): void {
  settings = {
    muted: next.muted ?? settings.muted,
    volume: clampVolume(next.volume ?? settings.volume),
  };
  soundPack?.mute(settings.muted);
  soundPack?.volume(settings.volume);
}

export function registerUiSoundSprite(src: string | string[], sprite: UiSoundSprite): void {
  soundPack?.unload();
  registeredSprites = sprite;
  soundPack = new Howl({
    src,
    sprite,
    volume: settings.volume,
    mute: settings.muted,
    preload: true,
    html5: false,
  });
}

export function playUiSound(eventName: UiSoundEventName): void {
  if (!soundPack || settings.muted || !registeredSprites[eventName]) return;
  try {
    soundPack.play(eventName);
  } catch {
    // Audio is non-critical UI feedback and should never block an interaction.
  }
}

export function stopUiSounds(): void {
  soundPack?.stop();
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return settings.volume;
  return Math.min(1, Math.max(0, value));
}
