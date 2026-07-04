import type { HexId, MapUnit, Order, TurnActionChecklist, TurnActionItem, UnitTypeDefinition, WorldBase } from "@arcanorum/shared";

export function buildTurnActionChecklist(params: {
  worldBase: Pick<WorldBase, "unitsById">;
  unitTypes: readonly UnitTypeDefinition[];
  ordersByTurn: Map<number, Map<string, Order[]>>;
  turnId: number;
  countryId: string;
}): TurnActionChecklist {
  const queuedUnitIds = collectQueuedMapUnitIds(params.ordersByTurn.get(params.turnId), params.countryId);
  const items: TurnActionItem[] = [];
  for (const unit of Object.values(params.worldBase.unitsById ?? {})) {
    if (!isUnitActionRequired(unit, params.countryId, queuedUnitIds)) continue;
    const unitType = params.unitTypes.find((entry) => entry.id === unit.unitTypeId) ?? null;
    items.push({
      id: `turn-action:${params.turnId}:${unit.id}:unit-can-act`,
      countryId: params.countryId,
      kind: "unit_can_act",
      severity: "blocking",
      target: { type: "unit", unitId: unit.id, hexId: unit.hexId },
      labelKey: unitType?.canFoundCity ? "turnActions.unitCanFoundCity.label" : "turnActions.unitCanAct.label",
      descriptionKey: unitType?.canFoundCity
        ? "turnActions.unitCanFoundCity.description"
        : "turnActions.unitCanAct.description",
      action: { type: "focus_hex", hexId: unit.hexId, unitId: unit.id },
    });
  }
  items.sort((left, right) => left.id.localeCompare(right.id, "en"));
  return {
    turnId: params.turnId,
    countryId: params.countryId,
    items,
    blockingCount: items.filter((item) => item.severity === "blocking").length,
  };
}

export function collectQueuedMapUnitIds(
  currentTurnOrders: Map<string, Order[]> | undefined,
  countryId: string,
): Set<string> {
  const queued = new Set<string>();
  for (const orders of currentTurnOrders?.values() ?? []) {
    for (const order of orders) {
      if (order.countryId !== countryId) continue;
      if (order.type === "UNIT_MOVE" && order.unitKind === "map") queued.add(order.unitId);
      if (order.type === "UNIT_ATTACK") queued.add(order.attackerUnitId);
      if (order.type === "UNIT_SKIP_TURN" && order.unitKind === "map") queued.add(order.unitId);
      if (order.type === "UNIT_SLEEP" && order.unitKind === "map") queued.add(order.unitId);
      if (order.type === "UNIT_WAKE" && order.unitKind === "map") queued.add(order.unitId);
      if (order.type === "FOUND_CITY") queued.add(order.civilianUnitId);
    }
  }
  return queued;
}

function isUnitActionRequired(unit: MapUnit, countryId: string, queuedUnitIds: ReadonlySet<string>): boolean {
  return (
    unit.countryId === countryId &&
    unit.status === "idle" &&
    unit.hp > 0 &&
    unit.movementPoints > 0 &&
    !queuedUnitIds.has(unit.id)
  );
}
