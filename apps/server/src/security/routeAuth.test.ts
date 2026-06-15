import type express from "express";
import { describe, expect, it, vi } from "vitest";
import type { AuthHeaderPayload } from "./authHeader";
import { createRouteAuth } from "./routeAuth";

describe("routeAuth", () => {
  const playerAuth: AuthHeaderPayload = { id: "player-1", countryId: "country:player", isAdmin: false };
  const adminAuth: AuthHeaderPayload = { id: "admin-1", countryId: "country:admin", isAdmin: true };

  it("returns auth payload for authenticated routes", () => {
    const res = createResponse();
    const routeAuth = createRouteAuth({
      parseAuthHeader: () => playerAuth,
      isAdminCountry: vi.fn(),
    });

    expect(routeAuth.requireAuth({} as express.Request, res)).toBe(playerAuth);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("sends unauthorized when auth is missing", () => {
    const res = createResponse();
    const routeAuth = createRouteAuth({
      parseAuthHeader: () => null,
      isAdminCountry: vi.fn(),
    });

    expect(routeAuth.requireAuth({} as express.Request, res)).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "UNAUTHORIZED" });
  });

  it("cleans up when auth is missing on upload-aware auth routes", () => {
    const res = createResponse();
    const cleanup = vi.fn();
    const routeAuth = createRouteAuth({
      parseAuthHeader: () => null,
      isAdminCountry: vi.fn(),
    });

    expect(routeAuth.requireAuthOrCleanup({} as express.Request, res, cleanup)).toBeNull();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("does not clean up when upload-aware auth succeeds", () => {
    const res = createResponse();
    const cleanup = vi.fn();
    const routeAuth = createRouteAuth({
      parseAuthHeader: () => playerAuth,
      isAdminCountry: vi.fn(),
    });

    expect(routeAuth.requireAuthOrCleanup({} as express.Request, res, cleanup)).toBe(playerAuth);
    expect(cleanup).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows server-confirmed admins", async () => {
    const res = createResponse();
    const isAdminCountry = vi.fn().mockResolvedValue(true);
    const routeAuth = createRouteAuth({
      parseAuthHeader: () => adminAuth,
      isAdminCountry,
    });

    await expect(routeAuth.requireAdmin({} as express.Request, res)).resolves.toBe(adminAuth);
    expect(isAdminCountry).toHaveBeenCalledWith("country:admin");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("forbids missing or non-admin users on admin routes", async () => {
    const missingRes = createResponse();
    const playerRes = createResponse();
    const routeAuth = createRouteAuth({
      parseAuthHeader: vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(playerAuth),
      isAdminCountry: vi.fn().mockResolvedValue(false),
    });

    await expect(routeAuth.requireAdmin({} as express.Request, missingRes)).resolves.toBeNull();
    await expect(routeAuth.requireAdmin({} as express.Request, playerRes)).resolves.toBeNull();
    expect(missingRes.status).toHaveBeenCalledWith(403);
    expect(playerRes.status).toHaveBeenCalledWith(403);
  });

  it("cleans up when upload-aware admin routes are forbidden", async () => {
    const res = createResponse();
    const cleanup = vi.fn();
    const routeAuth = createRouteAuth({
      parseAuthHeader: () => playerAuth,
      isAdminCountry: vi.fn().mockResolvedValue(false),
    });

    await expect(routeAuth.requireAdminOrCleanup({} as express.Request, res, cleanup)).resolves.toBeNull();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("does not clean up when upload-aware admin routes are allowed", async () => {
    const res = createResponse();
    const cleanup = vi.fn();
    const routeAuth = createRouteAuth({
      parseAuthHeader: () => adminAuth,
      isAdminCountry: vi.fn().mockResolvedValue(true),
    });

    await expect(routeAuth.requireAdminOrCleanup({} as express.Request, res, cleanup)).resolves.toBe(adminAuth);
    expect(cleanup).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows own country or server-confirmed admin access", async () => {
    const ownRes = createResponse();
    const adminRes = createResponse();
    const isAdminCountry = vi.fn().mockResolvedValue(true);
    const routeAuth = createRouteAuth({
      parseAuthHeader: vi.fn().mockReturnValueOnce(playerAuth).mockReturnValueOnce(adminAuth),
      isAdminCountry,
    });

    await expect(routeAuth.requireSelfOrAdmin({} as express.Request, ownRes, "country:player")).resolves.toBe(playerAuth);
    await expect(routeAuth.requireSelfOrAdmin({} as express.Request, adminRes, "country:other")).resolves.toBe(adminAuth);
    expect(isAdminCountry).toHaveBeenCalledTimes(1);
    expect(isAdminCountry).toHaveBeenCalledWith("country:admin");
  });

  it("rejects self-or-admin access without auth or permission", async () => {
    const missingRes = createResponse();
    const forbiddenRes = createResponse();
    const routeAuth = createRouteAuth({
      parseAuthHeader: vi.fn().mockReturnValueOnce(null).mockReturnValueOnce(playerAuth),
      isAdminCountry: vi.fn().mockResolvedValue(false),
    });

    await expect(routeAuth.requireSelfOrAdmin({} as express.Request, missingRes, "country:other")).resolves.toBeNull();
    await expect(routeAuth.requireSelfOrAdmin({} as express.Request, forbiddenRes, "country:other")).resolves.toBeNull();
    expect(missingRes.status).toHaveBeenCalledWith(401);
    expect(forbiddenRes.status).toHaveBeenCalledWith(403);
  });
});

function createResponse(): express.Response {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as express.Response;
}
