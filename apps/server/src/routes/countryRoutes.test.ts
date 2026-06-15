import express from "express";
import { describe, expect, it, vi } from "vitest";
import { registerCountryRoutes } from "./countryRoutes";

describe("countryRoutes", () => {
  it("cleans expired punishments before serving countries", async () => {
    const cleanupExpiredPunishments = vi.fn().mockResolvedValue(undefined);
    const listCountries = vi.fn().mockResolvedValue([{ id: "country:a", name: "A" }]);
    const app = express();
    registerCountryRoutes(app, {
      getTurnId: () => 12,
      cleanupExpiredPunishments,
      listCountries,
    });

    const response = await request(app, "/countries");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "country:a", name: "A" }]);
    expect(cleanupExpiredPunishments).toHaveBeenCalledWith(12, expect.any(Date));
    expect(listCountries).toHaveBeenCalledOnce();
  });
});

async function request(app: express.Express, path: string): Promise<Response> {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind to a port");
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
