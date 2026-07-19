export const PHASER_MAP_ART = {
  frame: {
    width: 112,
    height: 128,
    margin: 2,
    spacing: 4,
  },
  terrain: {
    key: "arc-map-terrain",
    url: "/game-assets/phaser/terrain-atlas.webp",
    variants: 1,
    fieldColumns: 1,
    fieldRows: 1,
    groups: {
      deep_water: 0,
      coastal_water: 1,
      fresh_water: 2,
      grassland: 3,
      plains: 4,
      desert: 5,
      tundra: 6,
      snow: 7,
      tropical: 8,
      marsh: 9,
    },
  },
  objects: {
    key: "arc-map-objects",
    url: "/game-assets/phaser/object-atlas.png",
    frameWidth: 128,
    frameHeight: 128,
    margin: 2,
    spacing: 4,
    variants: 4,
    groups: {
      "feature:ancient_ruins": 0,
      "marker:city": 4,
      "building:farm": 8,
      "building:mine": 12,
    },
  },
  borders: {
    key: "arc-map-borders",
    url: "/game-assets/phaser/border-atlas.png",
    styles: {
      country: 0,
      region: 64,
      controller: 128,
      selection: 192,
    },
  },
  rivers: {
    key: "arc-map-rivers",
    url: "/game-assets/phaser/river-atlas.png",
  },
  fill: {
    key: "arc-map-fill",
    url: "/game-assets/phaser/fill-atlas.png",
  },
} as const;

export type PhaserTerrainTextureGroup = keyof typeof PHASER_MAP_ART.terrain.groups;
export type PhaserObjectTextureGroup = keyof typeof PHASER_MAP_ART.objects.groups;
export type PhaserBorderStyle = keyof typeof PHASER_MAP_ART.borders.styles;
