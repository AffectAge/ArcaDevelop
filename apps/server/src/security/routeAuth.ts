import type express from "express";
import type { AuthHeaderPayload } from "./authHeader";
import { sendForbidden, sendUnauthorized } from "./authResponses";

export type RouteAuthDependencies = {
  parseAuthHeader: (req: express.Request) => AuthHeaderPayload | null;
  isAdminCountry: (countryId: string) => Promise<boolean>;
};

export type RouteAuth = {
  requireAuth: (req: express.Request, res: express.Response) => AuthHeaderPayload | null;
  requireAuthOrCleanup: (
    req: express.Request,
    res: express.Response,
    cleanup: () => void,
  ) => AuthHeaderPayload | null;
  requireAdmin: (req: express.Request, res: express.Response) => Promise<AuthHeaderPayload | null>;
  requireAdminOrCleanup: (
    req: express.Request,
    res: express.Response,
    cleanup: () => void,
  ) => Promise<AuthHeaderPayload | null>;
  requireSelfOrAdmin: (
    req: express.Request,
    res: express.Response,
    targetCountryId: string,
  ) => Promise<AuthHeaderPayload | null>;
};

export function createRouteAuth({ parseAuthHeader, isAdminCountry }: RouteAuthDependencies): RouteAuth {
  return {
    requireAuth(req, res) {
      const auth = parseAuthHeader(req);
      if (!auth) {
        sendUnauthorized(res);
        return null;
      }
      return auth;
    },

    requireAuthOrCleanup(req, res, cleanup) {
      const auth = parseAuthHeader(req);
      if (!auth) {
        cleanup();
        sendUnauthorized(res);
        return null;
      }
      return auth;
    },

    async requireAdmin(req, res) {
      const auth = parseAuthHeader(req);
      if (!auth || !(await isAdminCountry(auth.countryId))) {
        sendForbidden(res);
        return null;
      }
      return auth;
    },

    async requireAdminOrCleanup(req, res, cleanup) {
      const auth = parseAuthHeader(req);
      if (!auth || !(await isAdminCountry(auth.countryId))) {
        cleanup();
        sendForbidden(res);
        return null;
      }
      return auth;
    },

    async requireSelfOrAdmin(req, res, targetCountryId) {
      const auth = parseAuthHeader(req);
      if (!auth) {
        sendUnauthorized(res);
        return null;
      }
      if (auth.countryId !== targetCountryId && !(await isAdminCountry(auth.countryId))) {
        sendForbidden(res);
        return null;
      }
      return auth;
    },
  };
}
