export function toProvinceMatchKeys(provinceId: string): Array<string | number> {
  const raw = String(provinceId ?? "").trim();
  if (!raw) return [];
  const keys: Array<string | number> = [raw];
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) keys.push(asNumber);
  const trailingNumber = raw.match(/(\d+)\s*$/)?.[1];
  if (trailingNumber) {
    const parsed = Number(trailingNumber);
    if (Number.isFinite(parsed)) keys.push(parsed, trailingNumber);
  }
  return [...new Set(keys)];
}

export function buildProvinceMatchExpression(groups: Array<{ ids: string[]; value: unknown }>, fallback: unknown): unknown {
  const expression: unknown[] = ["match", ["id"]];
  for (const group of groups) {
    const ids = [...new Set(group.ids.flatMap(toProvinceMatchKeys))];
    if (ids.length === 0) continue;
    expression.push(ids, group.value);
  }
  return expression.length > 2 ? [...expression, fallback] : fallback;
}
