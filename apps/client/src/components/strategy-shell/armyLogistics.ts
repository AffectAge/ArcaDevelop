import type { Division, EquipmentProductionLine, EquipmentVariant } from "@arcanorum/shared";

export type ArmyLogisticsRowTone = "positive" | "warning" | "negative";

export type ArmyLogisticsGoodRequirement = {
  goodId: string;
  amount: number;
  missing: number;
};

export type ArmyLogisticsRow = {
  variantId: string;
  name: string;
  stockpile: number;
  assigned: number;
  required: number;
  missingEquipment: number;
  produced: number;
  balance: number;
  lineCount: number;
  activeLineCount: number;
  goodsCost: Array<{ goodId: string; amount: number }>;
  missingGoods: ArmyLogisticsGoodRequirement[];
  tone: ArmyLogisticsRowTone;
};

export function buildArmyLogisticsRows(params: {
  variantsById: Record<string, EquipmentVariant>;
  stockpileByVariantId: Record<string, number>;
  productionLines: EquipmentProductionLine[];
  divisions: Division[];
}): ArmyLogisticsRow[] {
  const variantIds = new Set<string>();
  for (const variantId of Object.keys(params.stockpileByVariantId)) variantIds.add(variantId);
  for (const line of params.productionLines) variantIds.add(line.equipmentVariantId);
  for (const division of params.divisions) {
    for (const variantId of Object.keys(division.equipmentByVariantId ?? {})) variantIds.add(variantId);
    for (const assignment of division.equipmentAssignments ?? []) {
      if (assignment.equipmentVariantId) variantIds.add(assignment.equipmentVariantId);
    }
  }

  return [...variantIds]
    .map((variantId) => {
      const variant = params.variantsById[variantId] ?? null;
      const lines = params.productionLines.filter((line) => line.equipmentVariantId === variantId);
      const stockpile = positiveNumber(params.stockpileByVariantId[variantId]);
      const assigned = params.divisions.reduce(
        (sum, division) => sum + positiveNumber(division.equipmentByVariantId?.[variantId]),
        0,
      );
      const requiredFromAssignments = params.divisions.reduce(
        (sum, division) =>
          sum +
          (division.equipmentAssignments ?? []).reduce(
            (assignmentSum, assignment) =>
              assignment.equipmentVariantId === variantId
                ? assignmentSum + positiveNumber(assignment.requiredCount)
                : assignmentSum,
            0,
          ),
        0,
      );
      const required = Math.max(requiredFromAssignments, assigned);
      const missingEquipment = Math.max(0, required - assigned);
      const produced = lines.reduce((sum, line) => sum + positiveNumber(line.lastProduced), 0);
      const balance = stockpile + produced - missingEquipment;
      return {
        variantId,
        name: variant?.name?.trim() || variantId,
        stockpile,
        assigned,
        required,
        missingEquipment,
        produced,
        balance,
        lineCount: lines.length,
        activeLineCount: lines.filter((line) => line.active).length,
        goodsCost: variant?.goodsCost ?? [],
        missingGoods: aggregateMissingGoods(lines),
        tone: balance < 0 ? "negative" : stockpile <= 0 && produced <= 0 ? "warning" : "positive",
      } satisfies ArmyLogisticsRow;
    })
    .sort((a, b) => {
      const toneRank = toneSortRank(a.tone) - toneSortRank(b.tone);
      if (toneRank !== 0) return toneRank;
      const producedRank = Number(b.produced > 0 || b.activeLineCount > 0) - Number(a.produced > 0 || a.activeLineCount > 0);
      if (producedRank !== 0) return producedRank;
      return a.name.localeCompare(b.name, "ru") || a.variantId.localeCompare(b.variantId, "en");
    });
}

function aggregateMissingGoods(lines: EquipmentProductionLine[]): ArmyLogisticsGoodRequirement[] {
  const byGoodId = new Map<string, ArmyLogisticsGoodRequirement>();
  for (const line of lines) {
    for (const entry of line.lastMissingGoods ?? []) {
      const existing = byGoodId.get(entry.goodId) ?? { goodId: entry.goodId, amount: 0, missing: 0 };
      existing.amount += positiveNumber(entry.required);
      existing.missing += positiveNumber(entry.missing);
      byGoodId.set(entry.goodId, existing);
    }
  }
  return [...byGoodId.values()].sort((a, b) => b.missing - a.missing || a.goodId.localeCompare(b.goodId, "en"));
}

function toneSortRank(tone: ArmyLogisticsRowTone): number {
  if (tone === "negative") return 0;
  if (tone === "warning") return 1;
  return 2;
}

function positiveNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}
