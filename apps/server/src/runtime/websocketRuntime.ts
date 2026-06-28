import { randomUUID } from "node:crypto";
import type { WebSocketServer, WebSocket } from "ws";
import type { AuthHeaderPayload } from "../security/authHeader";
import type {
  Division,
  HexId,
  Order,
  OrderDelta,
  ResourceTotals,
  WorldBase,
  WorldDelta,
  WsInMessage,
  WsOutMessage,
} from "@arcanorum/shared";
import type { GameContentEntry, GameSettings } from "./gameSettingsTypes";
import type { RegionColonizationConfig } from "../mechanics/colonizationMechanics";
import { countLandDivisionsOnHex, findDivisionRouteToTarget } from "../mechanics/militaryMechanics";
import { validateFoundCityOrder } from "../mechanics/settlementMechanics";
import {
  findCivilianRouteToTarget,
  findFleetRouteToTarget,
  isCivilianHexOccupied,
  normalizeUnitMoveRoute,
} from "../mechanics/unitMovementMechanics";
import type { HexMapIndexEntry } from "../map/hexIndex";

type WebSocketCountryRecord = {
  id: string;
  isAdmin: boolean;
  eventLogRetentionTurns?: number | null;
};

type ResolveStatusCountryRecord = {
  id: string;
  isLocked: boolean;
  blockedUntilTurn: number | null;
  blockedUntilAt: Date | null;
  ignoreUntilTurn: number | null;
};

type WebSocketRuntimeParams = {
  wsServer: WebSocketServer;
  onlinePlayers: Set<string>;
  getWorldBase: () => WorldBase;
  getGameSettings: () => GameSettings;
  getTurnId: () => number;
  getWorldStateVersion: () => number;
  getOrdersByTurn: () => Map<number, Map<string, Order[]>>;
  getQueuedColonizeRegionsByCountryByTurn: () => Map<number, Map<string, Set<string>>>;
  getActiveColonizeRegionsByCountry: () => Map<string, Set<string>>;
  getHexIndex: () => HexMapIndexEntry[];
  parseAuthToken: (token: string) => AuthHeaderPayload | null;
  findCountryForAuth: (countryId: string) => Promise<WebSocketCountryRecord | null>;
  listResolveStatusCountries: () => Promise<ResolveStatusCountryRecord[]>;
  getAiControlledCountryIds: () => Set<string>;
  ensureCountryInWorldBase: (countryId: string) => void;
  getLastLoginAt: (countryId: string) => string | null;
  setLastLoginAt: (countryId: string, timestamp: string) => void;
  getReplayDeltasFromVersion: (fromWorldStateVersion: number) => { ok: true; deltas: WorldDelta[] } | { ok: false };
  sendPendingRegistrationNotificationsToAdminSocket: (socket: WebSocket, adminCountryId: string) => Promise<void>;
  broadcast: (message: WsOutMessage) => void;
  broadcastTurnResolveStarted: (reason: "manual" | "admin" | "auto") => void;
  resolveAndBroadcastCurrentTurn: () => Promise<boolean>;
  cleanupExpiredPunishments: (currentTurn: number, now: Date) => Promise<void>;
  getCountryBlockInfo: (
    country: { isLocked: boolean; blockedUntilTurn: number | null; blockedUntilAt: Date | null },
    currentTurn: number,
    now: Date,
  ) => { blocked: boolean };
  getCountrySkipInfo: (
    country: { ignoreUntilTurn: number | null },
    currentTurn: number,
  ) => { ignored: boolean };
  getReadySetForTurn: (turnId: number) => Set<string>;
  savePersistentState: () => void;
  addOrderToTurnIndexes: (order: Order) => void;
  getRegionColonizationConfig: (hexId: string) => RegionColonizationConfig;
  parseRequestedBuildingIdFromPayload: (payload: Record<string, unknown>) => string;
  resolveBuildingOwnerFromPayload: (payload: Record<string, unknown>, requestedByCountryId: string) => unknown;
  isCountryAllowedForBuildingWithEngine: (building: GameContentEntry, countryId: string) => Promise<boolean>;
  getHexBuildRestriction: (building: GameContentEntry, hexId: string, regionId: string, countryId: string) => string | null;
  isBuildingUnlockedForCountry: (buildingId: string, countryId: string) => boolean;
  countBuildingOccurrences: (
    buildingId: string,
    countryId: string,
    options?: { includePendingOrders?: boolean },
  ) => { byCountry: number; global: number };
  getCountryBuildLimit: (building: GameContentEntry, countryId: string) => number | null | undefined;
  getGlobalBuildLimit: (building: GameContentEntry) => number | null;
  normalizeArmyMoveRoute: (
    payload: Record<string, unknown> | undefined,
    fallbackHexId: HexId,
    currentHexId: HexId,
  ) => HexId[];
  isContiguousArmyRoute: (fromHexId: HexId, route: HexId[]) => boolean;
  getHexMovementCost: (hexId: HexId, countryId?: string) => number;
};

export function registerWebSocketRuntime(params: WebSocketRuntimeParams): void {
  params.wsServer.on("connection", (socket) => {
    let playerId: string | null = null;
    let playerCountryId: string | null = null;
    let isAdmin = false;
    let lastAckedWorldStateVersion = 0;

    const send = (message: WsOutMessage): void => {
      socket.send(JSON.stringify(message));
    };

    send({ type: "CONNECTED", serverTime: new Date().toISOString() });

    socket.on("message", async (raw) => {
      let msg: WsInMessage;
      try {
        msg = JSON.parse(raw.toString()) as WsInMessage;
      } catch {
        send({ type: "ERROR", code: "BAD_JSON", message: "Invalid message payload" });
        return;
      }

      if (msg.type === "PING") {
        send({ type: "PONG" });
        return;
      }

      if (msg.type === "AUTH") {
        const auth = await handleAuthMessage({
          params,
          socket,
          msg,
          send,
          setPlayerId: (next) => {
            playerId = next;
          },
          setPlayerCountryId: (next) => {
            playerCountryId = next;
          },
          setIsAdmin: (next) => {
            isAdmin = next;
          },
          setLastAckedWorldStateVersion: (next) => {
            lastAckedWorldStateVersion = Math.max(lastAckedWorldStateVersion, next);
          },
        });
        if (auth === "handled") return;
      }

      if (!playerId) {
        send({ type: "ERROR", code: "UNAUTHORIZED", message: "Please authenticate first" });
        return;
      }

      if (msg.type === "WORLD_DELTA_ACK") {
        if (typeof msg.worldStateVersion === "number" && Number.isFinite(msg.worldStateVersion)) {
          lastAckedWorldStateVersion = Math.max(lastAckedWorldStateVersion, Math.floor(msg.worldStateVersion));
        }
        return;
      }

      if (msg.type === "WORLD_DELTA_REPLAY_REQUEST") {
        handleReplayRequest({ params, msg, send, lastAckedWorldStateVersion });
        return;
      }

      if (msg.type === "ORDER_DELTA") {
        await submitOrderDeltaToRuntime({ params, msg, send, playerId, playerCountryId });
        return;
      }

      if (msg.type === "ADMIN_FORCE_RESOLVE") {
        if (!isAdmin) {
          send({ type: "ERROR", code: "FORBIDDEN", message: "Admin only" });
          return;
        }
        params.broadcastTurnResolveStarted("admin");
        await params.resolveAndBroadcastCurrentTurn();
        return;
      }

      if (msg.type === "REQUEST_RESOLVE") {
        await handleRequestResolve({ params, send, playerCountryId });
      }
    });

    socket.on("close", () => {
      if (playerId) {
        params.onlinePlayers.delete(playerId);
        params.broadcast({ type: "PRESENCE", onlinePlayerIds: [...params.onlinePlayers] });
      }
    });
  });
}

async function handleAuthMessage(input: {
  params: WebSocketRuntimeParams;
  socket: WebSocket;
  msg: Extract<WsInMessage, { type: "AUTH" }>;
  send: (message: WsOutMessage) => void;
  setPlayerId: (playerId: string) => void;
  setPlayerCountryId: (countryId: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  setLastAckedWorldStateVersion: (worldStateVersion: number) => void;
}): Promise<"handled"> {
  const { params, msg, send } = input;
  try {
    const payload = params.parseAuthToken(msg.token);
    if (!payload) {
      send({ type: "ERROR", code: "UNAUTHORIZED", message: "Token invalid" });
      return "handled";
    }

    input.setPlayerId(payload.id);
    input.setPlayerCountryId(payload.countryId);
    const country = await params.findCountryForAuth(payload.countryId);
    if (!country) {
      send({ type: "ERROR", code: "UNAUTHORIZED", message: "Country not found" });
      return "handled";
    }

    const isAdmin = Boolean(country.isAdmin);
    input.setIsAdmin(isAdmin);
    (input.socket as WebSocket & { __arcIsAdmin?: boolean; __arcCountryId?: string }).__arcIsAdmin = isAdmin;
    (input.socket as WebSocket & { __arcIsAdmin?: boolean; __arcCountryId?: string }).__arcCountryId = country.id;
    if (!params.getLastLoginAt(country.id)) {
      params.setLastLoginAt(country.id, new Date().toISOString());
    }
    params.onlinePlayers.add(payload.id);
    params.ensureCountryInWorldBase(payload.countryId);

    const requestedResumeVersionRaw = msg.lastKnownWorldStateVersion;
    const requestedResumeVersion =
      typeof requestedResumeVersionRaw === "number" && Number.isFinite(requestedResumeVersionRaw)
        ? Math.max(0, Math.floor(requestedResumeVersionRaw))
        : null;
    const resumeReplay = requestedResumeVersion != null ? params.getReplayDeltasFromVersion(requestedResumeVersion) : null;

    if (requestedResumeVersion != null) {
      input.setLastAckedWorldStateVersion(Math.min(requestedResumeVersion, params.getWorldStateVersion()));
    }

    if (requestedResumeVersion != null && resumeReplay?.ok) {
      send({
        type: "AUTH_OK",
        playerId: payload.id,
        countryId: payload.countryId,
        isAdmin,
        turnId: params.getTurnId(),
        worldStateVersion: params.getWorldStateVersion(),
        replayFromWorldStateVersion: requestedResumeVersion,
        clientSettings: { eventLogRetentionTurns: params.getGameSettings().eventLog.retentionTurns },
      });
      for (const delta of resumeReplay.deltas) send(delta);
    } else {
      send({
        type: "AUTH_OK",
        playerId: payload.id,
        countryId: payload.countryId,
        isAdmin,
        worldBase: {
          ...params.getWorldBase(),
          turnId: params.getTurnId(),
        },
        turnId: params.getTurnId(),
        worldStateVersion: params.getWorldStateVersion(),
        clientSettings: { eventLogRetentionTurns: params.getGameSettings().eventLog.retentionTurns },
      });
    }
    if (isAdmin) {
      await params.sendPendingRegistrationNotificationsToAdminSocket(input.socket, country.id);
    }
    params.broadcast({ type: "PRESENCE", onlinePlayerIds: [...params.onlinePlayers] });
  } catch {
    send({ type: "ERROR", code: "UNAUTHORIZED", message: "Token invalid" });
  }
  return "handled";
}

function handleReplayRequest(input: {
  params: WebSocketRuntimeParams;
  msg: Extract<WsInMessage, { type: "WORLD_DELTA_REPLAY_REQUEST" }>;
  send: (message: WsOutMessage) => void;
  lastAckedWorldStateVersion: number;
}): void {
  const fromWorldStateVersion = Math.floor(input.msg.fromWorldStateVersion ?? 0);
  if (!Number.isFinite(fromWorldStateVersion) || fromWorldStateVersion < 0) {
    input.send({ type: "ERROR", code: "REPLAY_BAD_REQUEST", message: "Invalid replay request version" });
    return;
  }
  const replayBaseVersion =
    input.lastAckedWorldStateVersion > 0
      ? Math.min(fromWorldStateVersion, input.lastAckedWorldStateVersion)
      : fromWorldStateVersion;
  const replay = input.params.getReplayDeltasFromVersion(replayBaseVersion);
  if (!replay.ok) {
    input.send({
      type: "ERROR",
      code: "REPLAY_UNAVAILABLE",
      message: "Replay history is unavailable for requested version",
    });
    return;
  }
  for (const delta of replay.deltas) input.send(delta);
}

export async function submitAiOrderDeltaToRuntime(input: {
  params: WebSocketRuntimeParams;
  msg: OrderDelta;
  send: (message: WsOutMessage) => void;
}): Promise<void> {
  await submitOrderDeltaToRuntime({
    params: input.params,
    msg: input.msg,
    send: input.send,
    playerId: input.msg.order.playerId,
    playerCountryId: input.msg.order.countryId,
  });
}

export async function submitOrderDeltaToRuntime(input: {
  params: WebSocketRuntimeParams;
  msg: OrderDelta;
  send: (message: WsOutMessage) => void;
  playerId: string;
  playerCountryId: string | null;
}): Promise<void> {
  const { params, msg, send, playerId, playerCountryId } = input;
  const delta = msg;
  const turnId = params.getTurnId();
  const worldBase = params.getWorldBase();
  const gameSettings = params.getGameSettings();

  if (!playerCountryId || delta.order.playerId !== playerId || delta.order.countryId !== playerCountryId) {
    send({ type: "ERROR", code: "FORBIDDEN", message: "Order does not match authenticated country" });
    return;
  }

  if (delta.order.turnId !== turnId) {
    send({ type: "ERROR", code: "TURN_MISMATCH", message: "Ход устарел. Перезагрузите страницу и повторите действие." });
    return;
  }

  params.ensureCountryInWorldBase(delta.order.countryId);
  const countryResource = worldBase.resourcesByCountry[delta.order.countryId] as ResourceTotals | undefined;
  if (!countryResource) {
    send({ type: "ERROR", code: "NO_RESOURCES", message: "Ресурсы страны не инициализированы" });
    return;
  }

  if (
    delta.order.type !== "COLONIZE" &&
    delta.order.type !== "BUILD" &&
    delta.order.type !== "ARMY_MOVE" &&
    delta.order.type !== "UNIT_MOVE" &&
    delta.order.type !== "UNIT_ATTACK" &&
    delta.order.type !== "FOUND_CITY" &&
    countryResource.ducats <= 0
  ) {
    send({ type: "ERROR", code: "NO_RESOURCES", message: "Недостаточно дукатов для приказа" });
    return;
  }

  const order: Order = {
    ...delta.order,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const turnOrders = params.getOrdersByTurn().get(turnId) ?? new Map<string, Order[]>();
  const playerOrders = turnOrders.get(playerId) ?? [];

  if (!validateColonizeOrder({ params, delta, send, turnId, worldBase, gameSettings })) return;
  if (!validateUnitMoveOrder({ params, delta, send, worldBase, playerOrders })) return;
  if (!validateUnitAttackOrder({ params, delta, send, worldBase, playerOrders })) return;
  if (!validateFoundCityOrderForSubmit({ params, delta, send, worldBase })) return;
  if (!(await validateBuildOrder({ params, delta, send, worldBase, gameSettings }))) return;
  if (!validateArmyMoveOrder({ params, delta, send, worldBase, playerOrders })) return;

  if (playerOrders.length >= 8) {
    send({ type: "ERROR", code: "RATE_LIMIT", message: "Too many orders this turn" });
    return;
  }

  playerOrders.push(order);
  params.addOrderToTurnIndexes(order);
  turnOrders.set(playerId, playerOrders);
  params.getOrdersByTurn().set(turnId, turnOrders);
  params.savePersistentState();
  params.broadcast({ type: "ORDER_BROADCAST", order });
}

function validateUnitAttackOrder(input: {
  params: WebSocketRuntimeParams;
  delta: OrderDelta;
  send: (message: WsOutMessage) => void;
  worldBase: WorldBase;
  playerOrders: Order[];
}): boolean {
  const { params, delta, send, worldBase, playerOrders } = input;
  if (delta.order.type !== "UNIT_ATTACK") return true;
  const attackOrder = delta.order;
  const attacker = worldBase.divisionsById[attackOrder.attackerUnitId];
  if (!attacker || attacker.countryId !== attackOrder.countryId || (attacker.kind ?? "land") !== "land") {
    send({ type: "ERROR", code: "UNIT_ATTACK_ATTACKER_NOT_FOUND", message: "UNIT_ATTACK_ATTACKER_NOT_FOUND" });
    return false;
  }
  if (attackOrder.targetHexId === attacker.hexId || !params.isContiguousArmyRoute(attacker.hexId, [attackOrder.targetHexId])) {
    send({ type: "ERROR", code: "UNIT_ATTACK_TARGET_INVALID", message: "UNIT_ATTACK_TARGET_INVALID" });
    return false;
  }
  if (attackOrder.targetUnitId) {
    const targetUnit = worldBase.divisionsById[attackOrder.targetUnitId];
    if (!targetUnit || targetUnit.countryId === attacker.countryId || targetUnit.hexId !== attackOrder.targetHexId) {
      send({ type: "ERROR", code: "UNIT_ATTACK_TARGET_INVALID", message: "UNIT_ATTACK_TARGET_INVALID" });
      return false;
    }
  }
  const hasEnemyDivision = Object.values(worldBase.divisionsById).some(
      (division) =>
        (division.kind ?? "land") === "land" &&
      division.hexId === attackOrder.targetHexId &&
      division.countryId !== attacker.countryId &&
      division.strength > 0,
  );
  const targetOwnerId = worldBase.hexOwner[attackOrder.targetHexId] ?? null;
  if (!hasEnemyDivision && (!targetOwnerId || targetOwnerId === attacker.countryId)) {
    send({ type: "ERROR", code: "UNIT_ATTACK_TARGET_INVALID", message: "UNIT_ATTACK_TARGET_INVALID" });
    return false;
  }
  if (
    playerOrders.some(
      (order) =>
        order.countryId === attackOrder.countryId &&
        ((order.type === "UNIT_ATTACK" && order.attackerUnitId === attacker.id) ||
          (order.type === "UNIT_MOVE" && order.unitKind === "division" && order.unitId === attacker.id) ||
          (order.type === "ARMY_MOVE" && typeof order.payload?.divisionId === "string" && order.payload.divisionId === attacker.id)),
    )
  ) {
    send({ type: "ERROR", code: "UNIT_ATTACK_ALREADY_QUEUED", message: "UNIT_ATTACK_ALREADY_QUEUED" });
    return false;
  }
  return true;
}

function validateFoundCityOrderForSubmit(input: {
  params: WebSocketRuntimeParams;
  delta: OrderDelta;
  send: (message: WsOutMessage) => void;
  worldBase: WorldBase;
}): boolean {
  const { params, delta, send, worldBase } = input;
  if (delta.order.type !== "FOUND_CITY") return true;
  const hexRegionById = new Map(params.getHexIndex().map((hex) => [hex.id, hex.regionId ?? null] as const));
  const validation = validateFoundCityOrder({
    order: { ...delta.order, id: "submit-validation", createdAt: new Date(0).toISOString() },
    worldBase,
    getHexRegionId: (hexId) => hexRegionById.get(hexId) ?? null,
    getRegionColonizationConfig: params.getRegionColonizationConfig,
  });
  if (validation.ok) return true;
  send({ type: "ERROR", code: validation.reason, message: validation.reason });
  return false;
}

function validateUnitMoveOrder(input: {
  params: WebSocketRuntimeParams;
  delta: OrderDelta;
  send: (message: WsOutMessage) => void;
  worldBase: WorldBase;
  playerOrders: Order[];
}): boolean {
  const { params, delta, send, worldBase, playerOrders } = input;
  if (delta.order.type !== "UNIT_MOVE") return true;
  if (delta.order.unitKind === "division") {
    const division = worldBase.divisionsById[delta.order.unitId];
    if (!division || division.countryId !== delta.order.countryId || (division.kind ?? "land") !== "land") {
      send({ type: "ERROR", code: "DIVISION_NOT_FOUND", message: "DIVISION_NOT_FOUND" });
      return false;
    }
    const route = params.normalizeArmyMoveRoute(delta.order.payload, delta.order.targetHexId, division.hexId);
    const hexById = new Map(params.getHexIndex().map((hex) => [hex.id, hex] as const));
    const serverRoute = findDivisionRouteToTarget({
      worldBase,
      division,
      targetHexId: delta.order.targetHexId,
      getNeighborHexIds: (hexId) => (hexById.get(hexId)?.neighbors ?? []).filter((neighborId): neighborId is HexId => /^hex:-?\d+:-?\d+$/.test(neighborId)),
      getHexMovementCost: params.getHexMovementCost,
      landDivisionStackLimitPerHex: params.getGameSettings().military.landDivisionStackLimitPerHex,
    });
    const validatedRoute = serverRoute.length > 0 ? serverRoute : route;
    if (validatedRoute.length === 0 || !params.isContiguousArmyRoute(division.hexId, validatedRoute)) {
      send({ type: "ERROR", code: "DIVISION_TARGET_NOT_ADJACENT", message: "DIVISION_TARGET_NOT_ADJACENT" });
      return false;
    }
    if (isPeacefulDivisionStepStackFull(worldBase, division, validatedRoute[0], params.getGameSettings().military.landDivisionStackLimitPerHex)) {
      send({ type: "ERROR", code: "DIVISION_STACK_LIMIT_REACHED", message: "DIVISION_STACK_LIMIT_REACHED" });
      return false;
    }
    if (
      playerOrders.some(
        (order) =>
          order.countryId === delta.order.countryId &&
          ((order.type === "UNIT_MOVE" && order.unitKind === "division" && order.unitId === division.id) ||
            (order.type === "ARMY_MOVE" && typeof order.payload?.divisionId === "string" && order.payload.divisionId === division.id)),
      )
    ) {
      send({ type: "ERROR", code: "DIVISION_ALREADY_QUEUED", message: "DIVISION_ALREADY_QUEUED" });
      return false;
    }
    return true;
  }
  if (delta.order.unitKind === "fleet") {
    const fleet = worldBase.fleetsById[delta.order.unitId];
    if (!fleet || fleet.countryId !== delta.order.countryId) {
      send({ type: "ERROR", code: "FLEET_NOT_FOUND", message: "FLEET_NOT_FOUND" });
      return false;
    }
    const route = normalizeUnitMoveRoute(delta.order.payload, delta.order.targetHexId, fleet.hexId);
    const hexById = new Map(params.getHexIndex().map((hex) => [hex.id, hex] as const));
    const isFleetPassableHex = (hexId: HexId) => isFleetPassableHexEntry(hexById.get(hexId));
    const serverRoute = findFleetRouteToTarget({
      fleet,
      targetHexId: delta.order.targetHexId,
      getNeighborHexIds: (hexId) => (hexById.get(hexId)?.neighbors ?? []).filter((neighborId): neighborId is HexId => /^hex:-?\d+:-?\d+$/.test(neighborId)),
      getHexMovementCost: params.getHexMovementCost,
      isFleetPassableHex,
    });
    const validatedRoute = serverRoute.length > 0 ? serverRoute : route;
    if (validatedRoute.length === 0) {
      send({ type: "ERROR", code: "UNIT_MOVE_TARGET_INVALID", message: "UNIT_MOVE_TARGET_INVALID" });
      return false;
    }
    if (!params.isContiguousArmyRoute(fleet.hexId, validatedRoute)) {
      send({ type: "ERROR", code: "UNIT_MOVE_PATH_NOT_CONTIGUOUS", message: "UNIT_MOVE_PATH_NOT_CONTIGUOUS" });
      return false;
    }
    if (!validatedRoute.every(isFleetPassableHex)) {
      send({ type: "ERROR", code: "FLEET_TARGET_NOT_WATER", message: "FLEET_TARGET_NOT_WATER" });
      return false;
    }
    if (
      playerOrders.some(
        (order) =>
          order.type === "UNIT_MOVE" &&
          order.countryId === delta.order.countryId &&
          order.unitKind === "fleet" &&
          order.unitId === fleet.id,
      )
    ) {
      send({ type: "ERROR", code: "FLEET_ALREADY_QUEUED", message: "FLEET_ALREADY_QUEUED" });
      return false;
    }
    return true;
  }
  if (delta.order.unitKind !== "civilian") {
    send({ type: "ERROR", code: "UNIT_MOVE_KIND_UNSUPPORTED", message: "UNIT_MOVE_KIND_UNSUPPORTED" });
    return false;
  }
  const unit = worldBase.civilianUnitsById[delta.order.unitId];
  if (!unit || unit.countryId !== delta.order.countryId) {
    send({ type: "ERROR", code: "CIVILIAN_UNIT_NOT_FOUND", message: "CIVILIAN_UNIT_NOT_FOUND" });
    return false;
  }
  if (unit.status === "captured") {
    send({ type: "ERROR", code: "CIVILIAN_UNIT_CAPTURED", message: "CIVILIAN_UNIT_CAPTURED" });
    return false;
  }
  const route = normalizeUnitMoveRoute(delta.order.payload, delta.order.targetHexId, unit.hexId);
  const hexById = new Map(params.getHexIndex().map((hex) => [hex.id, hex] as const));
  const serverRoute = findCivilianRouteToTarget({
    worldBase,
    unit,
    targetHexId: delta.order.targetHexId,
    getNeighborHexIds: (hexId) => (hexById.get(hexId)?.neighbors ?? []).filter((neighborId): neighborId is HexId => /^hex:-?\d+:-?\d+$/.test(neighborId)),
    getHexMovementCost: params.getHexMovementCost,
  });
  const validatedRoute = serverRoute.length > 0 ? serverRoute : route;
  if (validatedRoute.length === 0) {
    send({ type: "ERROR", code: "UNIT_MOVE_TARGET_INVALID", message: "UNIT_MOVE_TARGET_INVALID" });
    return false;
  }
  if (!params.isContiguousArmyRoute(unit.hexId, validatedRoute)) {
    send({ type: "ERROR", code: "UNIT_MOVE_PATH_NOT_CONTIGUOUS", message: "UNIT_MOVE_PATH_NOT_CONTIGUOUS" });
    return false;
  }
  if (validatedRoute.some((hexId) => isCivilianHexOccupied(worldBase, hexId, unit.id))) {
    send({ type: "ERROR", code: "CIVILIAN_UNIT_HEX_OCCUPIED", message: "CIVILIAN_UNIT_HEX_OCCUPIED" });
    return false;
  }
  if (
    playerOrders.some(
      (order) =>
        order.type === "UNIT_MOVE" &&
        order.countryId === delta.order.countryId &&
        order.unitKind === "civilian" &&
        order.unitId === unit.id,
    )
  ) {
    send({ type: "ERROR", code: "CIVILIAN_UNIT_ALREADY_QUEUED", message: "CIVILIAN_UNIT_ALREADY_QUEUED" });
    return false;
  }
  return true;
}

function isFleetPassableHexEntry(hex: HexMapIndexEntry | undefined): boolean {
  if (!hex) return false;
  const tokens = [hex.hexType, hex.landscape, hex.continent].map((value) => String(value ?? "").toLowerCase());
  return tokens.some(
    (value) =>
      value === "water" ||
      value === "sea" ||
      value === "ocean" ||
      value === "coast" ||
      value === "coastal_water" ||
      value === "deep_ocean" ||
      value === "lake" ||
      value.endsWith(":water") ||
      value.endsWith(":sea") ||
      value.endsWith(":ocean"),
  );
}

function isPeacefulDivisionStepStackFull(
  worldBase: WorldBase,
  division: Division,
  hexId: HexId | undefined,
  landDivisionStackLimitPerHex: number,
): boolean {
  if (!hexId) return false;
  const targetOwnerId = worldBase.hexOwner[hexId] ?? null;
  const hasEnemyDivision = Object.values(worldBase.divisionsById).some(
    (other) =>
      (other.kind ?? "land") === "land" &&
      other.id !== division.id &&
      other.hexId === hexId &&
      other.countryId !== division.countryId,
  );
  if (hasEnemyDivision || (targetOwnerId && targetOwnerId !== division.countryId)) return false;
  return (
    countLandDivisionsOnHex({
      worldBase,
      hexId,
      countryId: division.countryId,
      excludeDivisionId: division.id,
    }) >= Math.max(1, Math.floor(landDivisionStackLimitPerHex))
  );
}

function validateColonizeOrder(input: {
  params: WebSocketRuntimeParams;
  delta: OrderDelta;
  send: (message: WsOutMessage) => void;
  turnId: number;
  worldBase: WorldBase;
  gameSettings: GameSettings;
}): boolean {
  const { params, delta, send, turnId, worldBase, gameSettings } = input;
  if (delta.order.type !== "COLONIZE") return true;
  const regionConfig = params.getRegionColonizationConfig(delta.order.regionId);
  if (worldBase.regionOwner[delta.order.regionId]) {
    send({ type: "ERROR", code: "REGION_NOT_NEUTRAL", message: "Region is not neutral" });
    return false;
  }
  if (regionConfig.disabled) {
    send({ type: "ERROR", code: "COLONIZATION_DISABLED", message: "Колонизация этого региона запрещена" });
    return false;
  }
  if ((worldBase.colonyProgressByRegion[delta.order.regionId] ?? {})[delta.order.countryId] != null) {
    send({ type: "ERROR", code: "ALREADY_COLONIZING", message: "This region is already in your colonization process" });
    return false;
  }

  const activeColonizeTargets = new Set<string>(params.getActiveColonizeRegionsByCountry().get(delta.order.countryId) ?? []);
  const queuedByCountry = params.getQueuedColonizeRegionsByCountryByTurn().get(turnId)?.get(delta.order.countryId);
  if (queuedByCountry) {
    for (const regionId of queuedByCountry) activeColonizeTargets.add(regionId);
  }
  if (activeColonizeTargets.has(delta.order.regionId)) {
    send({ type: "ERROR", code: "DUPLICATE_COLONIZE", message: "Region is already in your colonization queue" });
    return false;
  }
  if (activeColonizeTargets.size >= gameSettings.colonization.maxActiveColonizations) {
    send({
      type: "ERROR",
      code: "COLONIZE_LIMIT",
      message: `Достигнут лимит одновременной колонизации: ${activeColonizeTargets.size}/${gameSettings.colonization.maxActiveColonizations}`,
    });
    return false;
  }
  return true;
}

async function validateBuildOrder(input: {
  params: WebSocketRuntimeParams;
  delta: OrderDelta;
  send: (message: WsOutMessage) => void;
  worldBase: WorldBase;
  gameSettings: GameSettings;
}): Promise<boolean> {
  const { params, delta, send, worldBase, gameSettings } = input;
  if (delta.order.type !== "BUILD") return true;
  if (!delta.order.targetHexId) {
    send({ type: "ERROR", code: "BUILD_TARGET_HEX_REQUIRED", message: "Target hex is required for building construction" });
    return false;
  }
  const owner = worldBase.regionController[delta.order.regionId] ?? worldBase.regionOwner[delta.order.regionId];
  if (!owner || owner !== delta.order.countryId) {
    send({ type: "ERROR", code: "BUILD_CONFLICT", message: "Регион не принадлежит вашей стране" });
    return false;
  }
  const payload = (delta.order.payload ?? {}) as Record<string, unknown>;
  const buildingId = params.parseRequestedBuildingIdFromPayload(payload);
  const building = gameSettings.content.buildings.find((entry) => entry.id === buildingId);
  if (!buildingId || !building) {
    send({ type: "ERROR", code: "BUILD_INVALID", message: "Некорректное здание для строительства" });
    return false;
  }
  const ownerForProject = params.resolveBuildingOwnerFromPayload(payload, delta.order.countryId);
  if (!ownerForProject) {
    send({ type: "ERROR", code: "BUILD_INVALID", message: "Некорректный владелец проекта" });
    return false;
  }
  const allowedByRules = await params.isCountryAllowedForBuildingWithEngine(building, delta.order.countryId);
  if (!allowedByRules) {
    send({ type: "ERROR", code: "BUILD_RESTRICTED", message: "Ваша страна не может строить это здание" });
    return false;
  }
  const provinceRestriction = params.getHexBuildRestriction(building, delta.order.targetHexId, delta.order.regionId, delta.order.countryId);
  if (provinceRestriction) {
    send({ type: "ERROR", code: "BUILD_RESTRICTED", message: provinceRestriction });
    return false;
  }
  if (!params.isBuildingUnlockedForCountry(building.id, delta.order.countryId)) {
    send({ type: "ERROR", code: "BUILD_LOCKED_BY_TECH", message: "Здание еще не открыто технологией" });
    return false;
  }
  const counts = params.countBuildingOccurrences(buildingId, delta.order.countryId, { includePendingOrders: true });
  const countryLimit = params.getCountryBuildLimit(building, delta.order.countryId);
  const hasCountryLimitOverride = countryLimit !== undefined;
  const globalLimit = params.getGlobalBuildLimit(building);
  if (typeof countryLimit === "number" && counts.byCountry >= countryLimit) {
    send({
      type: "ERROR",
      code: "BUILD_LIMIT_COUNTRY",
      message: `Достигнут лимит здания для страны: ${counts.byCountry}/${countryLimit}`,
    });
    return false;
  }
  if (!hasCountryLimitOverride && globalLimit != null && counts.global >= globalLimit) {
    send({
      type: "ERROR",
      code: "BUILD_LIMIT_GLOBAL",
      message: `Достигнут глобальный лимит здания: ${counts.global}/${globalLimit}`,
    });
    return false;
  }
  return true;
}

function validateArmyMoveOrder(input: {
  params: WebSocketRuntimeParams;
  delta: OrderDelta;
  send: (message: WsOutMessage) => void;
  worldBase: WorldBase;
  playerOrders: Order[];
}): boolean {
  const { params, delta, send, worldBase, playerOrders } = input;
  if (delta.order.type !== "ARMY_MOVE") return true;
  const divisionId = typeof delta.order.payload?.divisionId === "string" ? delta.order.payload.divisionId.trim() : "";
  const division = divisionId ? worldBase.divisionsById[divisionId] : null;
  if (!division || division.countryId !== delta.order.countryId) {
    send({ type: "ERROR", code: "DIVISION_NOT_FOUND", message: "Дивизия не найдена" });
    return false;
  }
  const route = params.normalizeArmyMoveRoute(delta.order.payload, delta.order.targetHexId, division.hexId);
  const hexById = new Map(params.getHexIndex().map((hex) => [hex.id, hex] as const));
  const serverRoute = findDivisionRouteToTarget({
    worldBase,
    division,
    targetHexId: delta.order.targetHexId,
    getNeighborHexIds: (hexId) => (hexById.get(hexId)?.neighbors ?? []).filter((neighborId): neighborId is HexId => /^hex:-?\d+:-?\d+$/.test(neighborId)),
    getHexMovementCost: params.getHexMovementCost,
    landDivisionStackLimitPerHex: params.getGameSettings().military.landDivisionStackLimitPerHex,
  });
  const validatedRoute = serverRoute.length > 0 ? serverRoute : route;
  if (validatedRoute.length === 0 || !params.isContiguousArmyRoute(division.hexId, validatedRoute)) {
    send({ type: "ERROR", code: "DIVISION_TARGET_NOT_ADJACENT", message: "Маршрут дивизии должен идти по соседним hex-клеткам" });
    return false;
  }
  if (isPeacefulDivisionStepStackFull(worldBase, division, validatedRoute[0], params.getGameSettings().military.landDivisionStackLimitPerHex)) {
    send({ type: "ERROR", code: "DIVISION_STACK_LIMIT_REACHED", message: "На гексе достигнут лимит дивизий" });
    return false;
  }
  if (
    playerOrders.some(
      (order) =>
        order.countryId === delta.order.countryId &&
        ((order.type === "ARMY_MOVE" && typeof order.payload?.divisionId === "string" && order.payload.divisionId === division.id) ||
          (order.type === "UNIT_MOVE" && order.unitKind === "division" && order.unitId === division.id)),
    )
  ) {
    send({ type: "ERROR", code: "DIVISION_ALREADY_QUEUED", message: "Для этой дивизии уже есть приказ на этот ход" });
    return false;
  }
  return true;
}

async function handleRequestResolve(input: {
  params: WebSocketRuntimeParams;
  send: (message: WsOutMessage) => void;
  playerCountryId: string | null;
}): Promise<void> {
  const { params, send, playerCountryId } = input;
  const turnId = params.getTurnId();
  if (!playerCountryId) {
    send({ type: "ERROR", code: "UNAUTHORIZED", message: "Country is not resolved from token" });
    return;
  }

  const now = new Date();
  await params.cleanupExpiredPunishments(turnId, now);
  const countries = await params.listResolveStatusCountries();
  const activeCountryIds = new Set(
    countries
      .filter((country) => {
        const blocked = params.getCountryBlockInfo(country, turnId, now).blocked;
        const ignored = params.getCountrySkipInfo(country, turnId).ignored;
        return !blocked && !ignored;
      })
      .map((country) => country.id),
  );

  const readySet = params.getReadySetForTurn(turnId);
  const readySizeBefore = readySet.size;
  if (activeCountryIds.has(playerCountryId)) readySet.add(playerCountryId);
  if (readySet.size !== readySizeBefore) params.savePersistentState();

  const readyCount = countResolveReadyCountries({
    activeCountryIds,
    readySet,
    aiControlledCountryIds: params.getAiControlledCountryIds(),
  });
  const totalCount = activeCountryIds.size;
  if (readyCount < totalCount) {
    send({
      type: "ERROR",
      code: "WAITING_FOR_PLAYERS",
      message: `Ожидание подтверждения хода: ${readyCount}/${totalCount}`,
    });
    return;
  }

  params.broadcastTurnResolveStarted("manual");
  await params.resolveAndBroadcastCurrentTurn();
}

export function countResolveReadyCountries(params: {
  activeCountryIds: Set<string>;
  readySet: Set<string>;
  aiControlledCountryIds: Set<string>;
}): number {
  return [...params.activeCountryIds].filter(
    (countryId) => params.readySet.has(countryId) || params.aiControlledCountryIds.has(countryId),
  ).length;
}
