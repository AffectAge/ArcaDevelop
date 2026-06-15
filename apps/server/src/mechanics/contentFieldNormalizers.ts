export type GoodFlow = {
  goodId: string;
  amount: number;
  affectedByFertility?: boolean;
};

export type WorkforceRequirement = {
  professionId: string;
  workers: number;
};

export function normalizeGoodFlows(input: unknown): GoodFlow[] {
  if (!Array.isArray(input)) return [];
  const items: GoodFlow[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<{ goodId: unknown; amount: unknown; affectedByFertility: unknown }>;
    const goodId = typeof row.goodId === "string" ? row.goodId.trim() : "";
    const amount = typeof row.amount === "number" && Number.isFinite(row.amount) ? Math.max(0, row.amount) : 0;
    if (!goodId || amount <= 0) continue;
    items.push({
      goodId,
      amount: Number(amount.toFixed(3)),
      ...(row.affectedByFertility === true ? { affectedByFertility: true } : {}),
    });
  }
  return items.slice(0, 64);
}

export function normalizeWorkforceRequirements(input: unknown): WorkforceRequirement[] {
  if (!Array.isArray(input)) return [];
  const items: WorkforceRequirement[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<{ professionId: unknown; workers: unknown }>;
    const professionId = typeof row.professionId === "string" ? row.professionId.trim() : "";
    const workers = typeof row.workers === "number" && Number.isFinite(row.workers) ? Math.max(0, Math.floor(row.workers)) : 0;
    if (!professionId || workers <= 0) continue;
    items.push({ professionId, workers });
  }
  return items.slice(0, 64);
}
