export type BaseResourceIconKey =
  | "population"
  | "culture"
  | "science"
  | "religion"
  | "colonization"
  | "construction"
  | "ducats"
  | "gold";

export const BASE_RESOURCE_ICON_URLS = {
  population: "/game-assets/resource-icons/population.png",
  culture: "/game-assets/resource-icons/culture.png",
  science: "/game-assets/resource-icons/science.png",
  religion: "/game-assets/resource-icons/religion.png",
  colonization: "/game-assets/resource-icons/colonization.png",
  construction: "/game-assets/resource-icons/construction.png",
  ducats: "/game-assets/resource-icons/ducats.png",
  gold: "/game-assets/resource-icons/gold.png",
} as const satisfies Record<BaseResourceIconKey, string>;
