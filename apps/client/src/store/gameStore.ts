import { create } from "zustand";
import { WORLD_DELTA_MASK, type CountryTechnologyState, type EventCategory, type EventLogEntry, type EventPriority, type EventVisibility, type Order, type ResourceTotals, type WorldBase, type WorldDelta } from "@arcanorum/shared";

type OrdersByTurn = Map<number, Map<string, Order[]>>;

type AuthState = {
  token: string;
  playerId: string;
  countryId: string;
  isAdmin: boolean;
};

type GameState = {
  auth: AuthState | null;
  turnId: number;
  worldStateVersion: number;
  onlinePlayerIds: string[];
  selectedProvinceId: string | null;
  worldBase: WorldBase | null;
  ordersByTurn: OrdersByTurn;
  eventLog: EventLogEntry[];
  eventLogRetentionTurns: number;
  setAuth: (auth: AuthState | null) => void;
  setWorldBase: (world: WorldBase, turnId: number, worldStateVersion: number) => void;
  applyWorldDelta: (delta: WorldDelta, turnId: number, worldStateVersion: number) => void;
  addOrder: (order: Order) => void;
  setTurnOrders: (turnId: number, orders: Order[]) => void;
  removeOrder: (turnId: number, orderId: string) => void;
  setPresence: (ids: string[]) => void;
  setSelectedProvince: (id: string | null) => void;
  resetOverlay: (turnId: number) => void;
  updateCountryResources: (countryId: string, patch: Partial<ResourceTotals>) => void;
  updateCountryTechnology: (countryId: string, technology: CountryTechnologyState) => void;
  addEvent: (entry: { turn?: number; category: EventCategory; message: string; title?: string; countryId?: string | null; priority?: EventPriority; visibility?: EventVisibility }) => void;
  pruneLogEntries: (currentTurn: number, keepTurns?: number) => void;
  trimOldLogEntries: (keepLast?: number) => void;
  clearEventLog: () => void;
  setEventLogRetentionTurns: (turns: number) => void;
};

const MAX_LOG_ENTRIES = 200;

export const useGameStore = create<GameState>((set) => ({
  auth: null,
  turnId: 1,
  worldStateVersion: 1,
  onlinePlayerIds: [],
  selectedProvinceId: null,
  worldBase: null,
  ordersByTurn: new Map(),
  eventLog: [],
  eventLogRetentionTurns: 3,
  setAuth: (auth) => set({ auth }),
  setWorldBase: (world, nextTurnId, nextWorldStateVersion) =>
    set({
      worldBase: world,
      turnId: nextTurnId,
      worldStateVersion: nextWorldStateVersion,
    }),
  applyWorldDelta: (delta, nextTurnId, nextWorldStateVersion) =>
    set((state) => {
      if (!state.worldBase) {
        return state;
      }

      const nextWorldBase: WorldBase = {
        ...state.worldBase,
        turnId: nextTurnId,
      };

      if ((delta.mask & WORLD_DELTA_MASK.resourcesByCountry) !== 0 && delta.c) {
        nextWorldBase.resourcesByCountry = { ...nextWorldBase.resourcesByCountry };
        for (const [countryId, value] of Object.entries(delta.c)) {
          if (!value) {
            delete nextWorldBase.resourcesByCountry[countryId];
            continue;
          }
          nextWorldBase.resourcesByCountry[countryId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.provinceOwner) !== 0 && delta.o) {
        nextWorldBase.provinceOwner = { ...nextWorldBase.provinceOwner };
        for (const [provinceId, value] of Object.entries(delta.o)) {
          if (value == null) {
            delete nextWorldBase.provinceOwner[provinceId];
            continue;
          }
          nextWorldBase.provinceOwner[provinceId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionOwner) !== 0 && delta.a) {
        nextWorldBase.regionOwner = { ...nextWorldBase.regionOwner };
        for (const [regionId, value] of Object.entries(delta.a)) {
          if (value == null) {
            delete nextWorldBase.regionOwner[regionId];
            continue;
          }
          nextWorldBase.regionOwner[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionController) !== 0 && delta.f) {
        nextWorldBase.regionController = { ...nextWorldBase.regionController };
        for (const [regionId, value] of Object.entries(delta.f)) {
          if (value == null) {
            delete nextWorldBase.regionController[regionId];
            continue;
          }
          nextWorldBase.regionController[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.provinceNameById) !== 0 && delta.n) {
        nextWorldBase.provinceNameById = { ...nextWorldBase.provinceNameById };
        for (const [provinceId, value] of Object.entries(delta.n)) {
          if (value == null) {
            delete nextWorldBase.provinceNameById[provinceId];
            continue;
          }
          nextWorldBase.provinceNameById[provinceId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.colonyProgressByRegion) !== 0 && delta.p) {
        nextWorldBase.colonyProgressByRegion = { ...nextWorldBase.colonyProgressByRegion };
        for (const [regionId, value] of Object.entries(delta.p)) {
          if (!value) {
            delete nextWorldBase.colonyProgressByRegion[regionId];
            continue;
          }
          nextWorldBase.colonyProgressByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionColonizationByRegion) !== 0 && delta.z) {
        nextWorldBase.regionColonizationByRegion = { ...nextWorldBase.regionColonizationByRegion };
        for (const [regionId, value] of Object.entries(delta.z)) {
          if (!value) {
            delete nextWorldBase.regionColonizationByRegion[regionId];
            continue;
          }
          nextWorldBase.regionColonizationByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionPopulationByRegion) !== 0 && delta.u) {
        nextWorldBase.regionPopulationByRegion = { ...nextWorldBase.regionPopulationByRegion };
        for (const [regionId, value] of Object.entries(delta.u)) {
          if (!value) {
            delete nextWorldBase.regionPopulationByRegion[regionId];
            continue;
          }
          nextWorldBase.regionPopulationByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionBuildingsByRegion) !== 0 && delta.b) {
        nextWorldBase.regionBuildingsByRegion = { ...nextWorldBase.regionBuildingsByRegion };
        for (const [regionId, value] of Object.entries(delta.b)) {
          if (!value) {
            delete nextWorldBase.regionBuildingsByRegion[regionId];
            continue;
          }
          nextWorldBase.regionBuildingsByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionBuildingDucatsByRegion) !== 0 && delta.q) {
        nextWorldBase.regionBuildingDucatsByRegion = { ...nextWorldBase.regionBuildingDucatsByRegion };
        for (const [regionId, value] of Object.entries(delta.q)) {
          if (!value) {
            delete nextWorldBase.regionBuildingDucatsByRegion[regionId];
            continue;
          }
          nextWorldBase.regionBuildingDucatsByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionPopulationTreasuryByRegion) !== 0 && delta.y) {
        nextWorldBase.regionPopulationTreasuryByRegion = { ...nextWorldBase.regionPopulationTreasuryByRegion };
        for (const [regionId, value] of Object.entries(delta.y)) {
          if (value == null) {
            delete nextWorldBase.regionPopulationTreasuryByRegion[regionId];
            continue;
          }
          nextWorldBase.regionPopulationTreasuryByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionConstructionQueueByRegion) !== 0 && delta.r) {
        nextWorldBase.regionConstructionQueueByRegion = { ...nextWorldBase.regionConstructionQueueByRegion };
        for (const [regionId, value] of Object.entries(delta.r)) {
          if (!value) {
            delete nextWorldBase.regionConstructionQueueByRegion[regionId];
            continue;
          }
          nextWorldBase.regionConstructionQueueByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionResourceDepositsByRegion) !== 0 && delta.t) {
        nextWorldBase.regionResourceDepositsByRegion = { ...nextWorldBase.regionResourceDepositsByRegion };
        for (const [regionId, value] of Object.entries(delta.t)) {
          if (!value) {
            delete nextWorldBase.regionResourceDepositsByRegion[regionId];
            continue;
          }
          nextWorldBase.regionResourceDepositsByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionResourceExplorationQueueByRegion) !== 0 && delta.e) {
        nextWorldBase.regionResourceExplorationQueueByRegion = {
          ...nextWorldBase.regionResourceExplorationQueueByRegion,
        };
        for (const [regionId, value] of Object.entries(delta.e)) {
          if (!value) {
            delete nextWorldBase.regionResourceExplorationQueueByRegion[regionId];
            continue;
          }
          nextWorldBase.regionResourceExplorationQueueByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.regionResourceExplorationCountByRegion) !== 0 && delta.k) {
        nextWorldBase.regionResourceExplorationCountByRegion = {
          ...nextWorldBase.regionResourceExplorationCountByRegion,
        };
        for (const [regionId, value] of Object.entries(delta.k)) {
          if (value == null) {
            delete nextWorldBase.regionResourceExplorationCountByRegion[regionId];
            continue;
          }
          nextWorldBase.regionResourceExplorationCountByRegion[regionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.parliamentByCountry) !== 0 && delta.m) {
        nextWorldBase.parliamentByCountry = { ...nextWorldBase.parliamentByCountry };
        for (const [countryId, value] of Object.entries(delta.m)) {
          if (!value) {
            delete nextWorldBase.parliamentByCountry[countryId];
            continue;
          }
          nextWorldBase.parliamentByCountry[countryId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.technologyByCountry) !== 0 && delta.h) {
        nextWorldBase.technologyByCountry = { ...nextWorldBase.technologyByCountry };
        for (const [countryId, value] of Object.entries(delta.h)) {
          if (!value) {
            delete nextWorldBase.technologyByCountry[countryId];
            continue;
          }
          nextWorldBase.technologyByCountry[countryId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.countryDecisionsByCountryId) !== 0 && delta.d) {
        nextWorldBase.countryDecisionsByCountryId = { ...nextWorldBase.countryDecisionsByCountryId };
        for (const [countryId, value] of Object.entries(delta.d)) {
          if (!value) {
            delete nextWorldBase.countryDecisionsByCountryId[countryId];
            continue;
          }
          nextWorldBase.countryDecisionsByCountryId[countryId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.countryEventsByCountryId) !== 0 && delta.v) {
        nextWorldBase.countryEventsByCountryId = { ...nextWorldBase.countryEventsByCountryId };
        for (const [countryId, value] of Object.entries(delta.v)) {
          if (!value) {
            delete nextWorldBase.countryEventsByCountryId[countryId];
            continue;
          }
          nextWorldBase.countryEventsByCountryId[countryId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.divisionTemplatesByCountry) !== 0 && delta.g) {
        nextWorldBase.divisionTemplatesByCountry = { ...nextWorldBase.divisionTemplatesByCountry };
        for (const [countryId, value] of Object.entries(delta.g)) {
          if (!value) {
            delete nextWorldBase.divisionTemplatesByCountry[countryId];
            continue;
          }
          nextWorldBase.divisionTemplatesByCountry[countryId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.divisionsById) !== 0 && delta.x) {
        nextWorldBase.divisionsById = { ...nextWorldBase.divisionsById };
        for (const [divisionId, value] of Object.entries(delta.x)) {
          if (!value) {
            delete nextWorldBase.divisionsById[divisionId];
            continue;
          }
          nextWorldBase.divisionsById[divisionId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.militaryFormationQueueByCountry) !== 0 && delta.w) {
        nextWorldBase.militaryFormationQueueByCountry = { ...nextWorldBase.militaryFormationQueueByCountry };
        for (const [countryId, value] of Object.entries(delta.w)) {
          if (!value) {
            delete nextWorldBase.militaryFormationQueueByCountry[countryId];
            continue;
          }
          nextWorldBase.militaryFormationQueueByCountry[countryId] = value;
        }
      }

      if ((delta.mask & WORLD_DELTA_MASK.diplomacyProposals) !== 0 && delta.j) {
        nextWorldBase.diplomacyProposals = delta.j;
      }

      return {
        worldBase: nextWorldBase,
        turnId: nextTurnId,
        worldStateVersion: nextWorldStateVersion,
      };
    }),
  addOrder: (order) =>
    set((state) => {
      const turnMap = new Map(state.ordersByTurn);
      const byPlayer = new Map(turnMap.get(order.turnId) ?? []);
      const list = [...(byPlayer.get(order.playerId) ?? []), order];
      byPlayer.set(order.playerId, list);
      turnMap.set(order.turnId, byPlayer);
      return { ordersByTurn: turnMap };
    }),
  setTurnOrders: (targetTurnId, orders) =>
    set((state) => {
      const turnMap = new Map(state.ordersByTurn);
      const byPlayer = new Map<string, Order[]>();
      for (const order of orders) {
        const list = byPlayer.get(order.playerId) ?? [];
        list.push(order);
        byPlayer.set(order.playerId, list);
      }
      if (byPlayer.size > 0) {
        turnMap.set(targetTurnId, byPlayer);
      } else {
        turnMap.delete(targetTurnId);
      }
      return { ordersByTurn: turnMap };
    }),
  removeOrder: (targetTurnId, orderId) =>
    set((state) => {
      const turnMap = new Map(state.ordersByTurn);
      const byPlayer = turnMap.get(targetTurnId);
      if (!byPlayer) return state;
      const nextByPlayer = new Map<string, Order[]>();
      for (const [playerId, list] of byPlayer.entries()) {
        const filtered = list.filter((order) => order.id !== orderId);
        if (filtered.length > 0) {
          nextByPlayer.set(playerId, filtered);
        }
      }
      if (nextByPlayer.size > 0) {
        turnMap.set(targetTurnId, nextByPlayer);
      } else {
        turnMap.delete(targetTurnId);
      }
      return { ordersByTurn: turnMap };
    }),
  setPresence: (ids) => set({ onlinePlayerIds: ids }),
  setSelectedProvince: (id) => set({ selectedProvinceId: id }),
  resetOverlay: (nextTurnId) =>
    set((state) => {
      const map = new Map(state.ordersByTurn);
      map.delete(nextTurnId - 1);
      return { ordersByTurn: map, turnId: nextTurnId };
    }),
  updateCountryResources: (countryId, patch) =>
    set((state) => {
      if (!state.worldBase?.resourcesByCountry[countryId]) {
        return state;
      }

      return {
        worldBase: {
          ...state.worldBase,
          resourcesByCountry: {
            ...state.worldBase.resourcesByCountry,
            [countryId]: {
              ...state.worldBase.resourcesByCountry[countryId],
              ...patch,
            },
          },
        },
      };
    }),
  updateCountryTechnology: (countryId, technology) =>
    set((state) => {
      if (!state.worldBase) {
        return state;
      }

      return {
        worldBase: {
          ...state.worldBase,
          technologyByCountry: {
            ...state.worldBase.technologyByCountry,
            [countryId]: technology,
          },
        },
      };
    }),
  addEvent: (entry) =>
    set((state) => {
      const timestamp = new Date().toISOString();
      const nextTurn = entry.turn ?? state.turnId;
      const next: EventLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        turn: nextTurn,
        timestamp,
        category: entry.category,
        priority: entry.priority ?? "medium",
        visibility: entry.visibility ?? "public",
        title: entry.title ?? null,
        message: entry.message,
        countryId: entry.countryId ?? null,
      };
      const merged = [...state.eventLog, next];
      return { eventLog: merged.slice(-MAX_LOG_ENTRIES) };
    }),
  pruneLogEntries: (currentTurn, keepTurns) =>
    set((state) => {
      const retention = Math.max(1, Math.floor(keepTurns ?? state.eventLogRetentionTurns));
      return {
        eventLog: state.eventLog.filter((entry) => currentTurn - entry.turn < retention).slice(-MAX_LOG_ENTRIES),
      };
    }),
  trimOldLogEntries: (keepLast = 50) =>
    set((state) => ({
      eventLog: state.eventLog.slice(-Math.max(1, keepLast)),
    })),
  clearEventLog: () => set({ eventLog: [] }),
  setEventLogRetentionTurns: (turns) =>
    set((state) => {
      const next = Math.max(1, Math.floor(turns));
      return {
        eventLogRetentionTurns: next,
        eventLog: state.eventLog.slice(-MAX_LOG_ENTRIES),
      };
    }),
}));

export const selectOrdersForProvince = (provinceId: string, turnId: number) => (state: GameState): Order[] => {
  const byPlayer = state.ordersByTurn.get(turnId);
  if (!byPlayer) {
    return [];
  }

  const orders: Order[] = [];
  for (const list of byPlayer.values()) {
    for (const order of list) {
      if (order.type === "ARMY_MOVE" && order.provinceId === provinceId) {
        orders.push(order);
      }
    }
  }
  return orders;
};

export const selectOrdersForRegion = (regionId: string, turnId: number) => (state: GameState): Order[] => {
  const byPlayer = state.ordersByTurn.get(turnId);
  if (!byPlayer) {
    return [];
  }

  const orders: Order[] = [];
  for (const list of byPlayer.values()) {
    for (const order of list) {
      if ((order.type === "BUILD" || order.type === "COLONIZE") && order.regionId === regionId) {
        orders.push(order);
      }
    }
  }
  return orders;
};
