import type { ResourceTotals } from "./core";

export type ResourceId = keyof ResourceTotals;

export type ResourceFlowDirection = "income" | "expense";

export type ResourceFlowSourceType =
  | "base"
  | "building"
  | "law"
  | "technology"
  | "event"
  | "trade"
  | "army"
  | "unit"
  | "diplomacy"
  | "colonization"
  | "construction"
  | "customization"
  | "modifier"
  | "system";

export type ResourceFlow = {
  id: string;
  turnId: number;
  countryId: string;
  resourceId: ResourceId;
  direction: ResourceFlowDirection;
  amount: number;
  sourceType: ResourceFlowSourceType;
  sourceId: string;
  categoryId: string;
  labelKey: string;
  labelParams?: Record<string, string | number | boolean | null>;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ResourceBalance = {
  resourceId: ResourceId;
  incomeTotal: number;
  expenseTotal: number;
  net: number;
  incomesByCategory: Record<string, number>;
  expensesByCategory: Record<string, number>;
  entries: ResourceFlow[];
};
