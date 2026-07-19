type HexMapPerfLocation = Pick<Location, "pathname" | "search">;

const PERF_FIXTURE_PATH_PATTERN = /^\/fixtures\/(?:default|200k)$/;

export function resolveHexMapPerfApiBase(location: HexMapPerfLocation, fallbackApiBase: string): string {
  const requestedApiBase = new URLSearchParams(location.search).get("perfApiBase");
  if (location.pathname !== "/hex-perf" || requestedApiBase == null) return fallbackApiBase;

  let parsed: URL;
  try {
    parsed = new URL(requestedApiBase);
  } catch {
    throw new Error("HEX_MAP_PERF_API_BASE_REJECTED");
  }
  if (
    parsed.protocol !== "http:" ||
    !isLoopbackHostname(parsed.hostname) ||
    parsed.port.length === 0 ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    !PERF_FIXTURE_PATH_PATTERN.test(parsed.pathname)
  ) {
    throw new Error("HEX_MAP_PERF_API_BASE_REJECTED");
  }
  return parsed.href.replace(/\/$/, "");
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}
