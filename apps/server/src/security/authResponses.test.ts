import type express from "express";
import { describe, expect, it, vi } from "vitest";
import { sendForbidden, sendUnauthorized } from "./authResponses";

describe("authResponses", () => {
  it("sends stable unauthorized responses", () => {
    const res = createResponse();

    expect(sendUnauthorized(res)).toBe(res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "UNAUTHORIZED" });
  });

  it("sends stable forbidden responses", () => {
    const res = createResponse();

    expect(sendForbidden(res)).toBe(res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "FORBIDDEN" });
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
