import type express from "express";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { createAuthHeaderParser, createAuthTokenParser, parseAuthHeaderWithSecret, parseAuthTokenWithSecret } from "./authHeader";

const secret = "test-secret";

describe("authHeader", () => {
  it("parses valid bearer tokens", () => {
    const token = jwt.sign({ id: "player-1", countryId: "country-1", isAdmin: true }, secret);

    expect(parseAuthHeaderWithSecret(requestWithAuth(`Bearer ${token}`), secret)).toEqual({
      id: "player-1",
      countryId: "country-1",
      isAdmin: true,
    });
    expect(parseAuthTokenWithSecret(token, secret)).toEqual({
      id: "player-1",
      countryId: "country-1",
      isAdmin: true,
    });
  });

  it("returns null for missing or malformed authorization headers", () => {
    expect(parseAuthHeaderWithSecret(requestWithAuth(null), secret)).toBeNull();
    expect(parseAuthHeaderWithSecret(requestWithAuth("Token abc"), secret)).toBeNull();
    expect(parseAuthHeaderWithSecret(requestWithAuth("Bearer bad-token"), secret)).toBeNull();
    expect(parseAuthTokenWithSecret("bad-token", secret)).toBeNull();
  });

  it("returns null for tokens without required identity fields", () => {
    const token = jwt.sign({ id: "player-1" }, secret);

    expect(parseAuthHeaderWithSecret(requestWithAuth(`Bearer ${token}`), secret)).toBeNull();
  });

  it("creates reusable parsers for route contexts", () => {
    const token = jwt.sign({ id: "player-2", countryId: "country-2", isAdmin: false }, secret);
    const parseAuthHeader = createAuthHeaderParser(secret);

    expect(parseAuthHeader(requestWithAuth(`Bearer ${token}`))).toEqual({
      id: "player-2",
      countryId: "country-2",
      isAdmin: false,
    });
    expect(createAuthTokenParser(secret)(token)).toEqual({
      id: "player-2",
      countryId: "country-2",
      isAdmin: false,
    });
  });
});

function requestWithAuth(value: string | null): express.Request {
  return {
    header(name: string): string | undefined {
      if (name.toLowerCase() !== "authorization") return undefined;
      return value ?? undefined;
    },
  } as express.Request;
}
