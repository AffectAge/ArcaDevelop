import { describe, expect, it } from "vitest";
import { ScenarioCompilationError, compileScenario } from "./engine";
import {
  createEngineV2DemoSession,
  createSetTaxRateCommand,
  engineV2DemoScenario,
} from "./demo";

describe("Arcanorum Engine v2", () => {
  it("compiles Victoria-style scenario data into normalized world tables", () => {
    const world = compileScenario(engineV2DemoScenario);

    expect(world.meta.scenarioId).toBe("engine-v2-demo");
    expect(world.meta.date).toBe("1836-01-01");
    expect(world.tables.regions["region:north"].provinceIds).toEqual([
      "province:1",
      "province:2",
    ]);
    expect(world.tables.pops["pop:arc:1:farmers"].employmentBuildingId).toBe(
      "building:farm:1",
    );
  });

  it("rejects broken scenario references before a game session starts", () => {
    const broken = structuredClone(engineV2DemoScenario);
    broken.history.countries[0].capitalProvinceId = "province:missing";

    expect(() => compileScenario(broken)).toThrowError(ScenarioCompilationError);
    try {
      compileScenario(broken);
    } catch (error) {
      const compilationError = error as ScenarioCompilationError;
      expect(compilationError.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "MISSING_REFERENCE",
            path: "history.countries.arc.capitalProvinceId",
          }),
        ]),
      );
    }
  });

  it("queues authoritative commands and resolves them through deterministic systems", async () => {
    const session = createEngineV2DemoSession();
    const initial = session.getSnapshot();
    const command = createSetTaxRateCommand({
      id: "command:arc:tax:1",
      actorCountryId: "arc",
      expectedVersion: initial.meta.version,
      taxRate: 0.5,
    });

    const accepted = session.submitCommand(command);
    expect(accepted).toMatchObject({ status: "accepted", queuePosition: 1 });
    expect(session.submitCommand(command)).toEqual(accepted);

    const delta = await session.resolveTurn();
    const snapshot = session.getSnapshot();

    expect(delta).toMatchObject({
      fromVersion: 1,
      toVersion: 2,
      resolvedTurn: 1,
      date: "1836-01-08",
      resolvedCommandIds: ["command:arc:tax:1"],
      rejectedCommands: [],
    });
    expect(snapshot.tables.countries.arc.taxRate).toBe(0.5);
    expect(snapshot.tables.countries.arc.treasury).toBe(1_040);
    expect(snapshot.meta.turn).toBe(1);
    expect(delta.tables.countries?.arc).toMatchObject({ taxRate: 0.5, treasury: 1_040 });
    expect(delta.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "country.tax_rate_changed",
        "economy.tax_income",
      ]),
    );
  });

  it("rejects stale client commands by world version", async () => {
    const session = createEngineV2DemoSession();
    await session.resolveTurn();

    const result = session.submitCommand(
      createSetTaxRateCommand({
        id: "command:arc:stale",
        actorCountryId: "arc",
        expectedVersion: 1,
        taxRate: 0.4,
      }),
    );

    expect(result).toMatchObject({
      status: "rejected",
      code: "WORLD_VERSION_MISMATCH",
      worldVersion: 2,
    });
  });

  it("replays the same scenario and command stream deterministically", async () => {
    const left = createEngineV2DemoSession();
    const right = createEngineV2DemoSession();
    const command = createSetTaxRateCommand({
      id: "command:arc:tax:deterministic",
      actorCountryId: "arc",
      expectedVersion: 1,
      taxRate: 0.35,
    });

    left.submitCommand(command);
    right.submitCommand(command);

    expect(await left.resolveTurn()).toEqual(await right.resolveTurn());
    expect(left.getSnapshot()).toEqual(right.getSnapshot());
  });
});
