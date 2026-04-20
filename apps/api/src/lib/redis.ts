import { Redis } from "ioredis";

let _redis: Redis | null = null;
let _available = true;

export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    _redis = new Redis(url, {
      maxRetriesPerRequest: null,
      // Stop retrying connection after first failure in dev (no Redis installed)
      retryStrategy: (times) => {
        if (times > 3) {
          _available = false;
          return null; // stop retrying
        }
        return Math.min(times * 500, 2000);
      },
      lazyConnect: true,
    });
    _redis.on("error", () => {
      // Silenced — logged once at startup by the worker
    });
  }
  return _redis;
}

export function isRedisAvailable(): boolean {
  return _available;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit().catch(() => {});
    _redis = null;
  }
}
