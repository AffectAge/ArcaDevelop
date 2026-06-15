import express from "express";
import { describe, expect, it, vi } from "vitest";
import type { RouteAuth } from "../security/routeAuth";
import {
  adminUiNotificationSchema,
  registerAdminUiNotificationRoutes,
  type AdminUiNotificationRoutesDependencies,
} from "./adminUiNotificationRoutes";

describe("adminUiNotificationRoutes", () => {
  it("validates admin UI notification payloads", () => {
    expect(adminUiNotificationSchema.safeParse({ category: "system", title: "Title", message: "Message" }).success).toBe(true);
    expect(adminUiNotificationSchema.safeParse({ category: "other", title: "", message: "" }).success).toBe(false);
  });

  it("broadcasts admin UI notifications", async () => {
    const deps = makeDeps();
    const app = makeApp(deps);

    const response = await request(app, "/admin/ui-notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "system", title: "Title", message: "Message" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      notification: {
        id: "notification:1",
        category: "system",
        createdAt: "2026-06-13T00:00:00.000Z",
        title: "Title",
        message: "Message",
        action: { type: "message" },
      },
    });
    expect(deps.broadcastUiNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: "notification:1", action: { type: "message" } }),
    );
  });
});

function makeApp(deps: AdminUiNotificationRoutesDependencies): express.Express {
  const app = express();
  app.use(express.json());
  registerAdminUiNotificationRoutes(app, deps);
  return app;
}

function makeDeps(): AdminUiNotificationRoutesDependencies {
  return {
    routeAuth: {
      requireAuth: vi.fn(),
      requireAuthOrCleanup: vi.fn(),
      requireAdmin: vi.fn().mockResolvedValue({ countryId: "country:admin", isAdmin: true }),
      requireAdminOrCleanup: vi.fn(),
      requireSelfOrAdmin: vi.fn(),
    } as unknown as RouteAuth,
    createId: () => "notification:1",
    getNowIso: () => "2026-06-13T00:00:00.000Z",
    broadcastUiNotification: vi.fn(),
  };
}

async function request(app: express.Express, path: string, init?: RequestInit): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
