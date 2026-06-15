import Redis from "ioredis";

export function connectOptionalRedis(redisUrl: string | null | undefined): Redis | null {
  const redis = redisUrl ? new Redis(redisUrl, { lazyConnect: true }) : null;
  if (redis) {
    redis.connect().catch(() => {
      // Redis is an optional acceleration layer and can be unavailable in local setup.
    });
  }
  return redis;
}
