import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private memory = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const url = this.configService.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn(
        'REDIS_URL is not set — using in-memory fallback (not shared across processes)',
      );
      return;
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });

    this.client
      .connect()
      .then(() => this.logger.log('Connected to Redis'))
      .catch((err) => {
        this.logger.error('Redis connection failed — using in-memory fallback', err);
        this.client?.disconnect();
        this.client = null;
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  isAvailable(): boolean {
    return this.client?.status === 'ready';
  }

  async get(key: string): Promise<string | null> {
    if (this.client?.status === 'ready') {
      return this.client.get(key);
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client?.status === 'ready') {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return;
    }
    this.memory.set(key, {
      value,
      expiresAt:
        ttlSeconds && ttlSeconds > 0
          ? Date.now() + ttlSeconds * 1000
          : Number.MAX_SAFE_INTEGER,
    });
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    if (this.client?.status === 'ready') {
      await this.client.del(...keys);
      return;
    }
    for (const key of keys) {
      this.memory.delete(key);
    }
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    if (this.client?.status === 'ready') {
      await this.client.zadd(key, score, member);
      return;
    }
    const zkey = `zset:${key}`;
    const raw = this.memory.get(zkey);
    const items: Array<{ score: number; member: string }> = raw
      ? (JSON.parse(raw.value) as Array<{ score: number; member: string }>)
      : [];
    const idx = items.findIndex((i) => i.member === member);
    if (idx >= 0) items[idx].score = score;
    else items.push({ score, member });
    this.memory.set(zkey, {
      value: JSON.stringify(items),
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    if (this.client?.status === 'ready') {
      return this.client.zrevrange(key, start, stop);
    }
    const zkey = `zset:${key}`;
    const raw = this.memory.get(zkey);
    if (!raw) return [];
    const items = JSON.parse(raw.value) as Array<{ score: number; member: string }>;
    return items
      .sort((a, b) => b.score - a.score)
      .slice(start, stop + 1)
      .map((i) => i.member);
  }

  async zrem(key: string, member: string): Promise<void> {
    if (this.client?.status === 'ready') {
      await this.client.zrem(key, member);
      return;
    }
    const zkey = `zset:${key}`;
    const raw = this.memory.get(zkey);
    if (!raw) return;
    const items = (
      JSON.parse(raw.value) as Array<{ score: number; member: string }>
    ).filter((i) => i.member !== member);
    this.memory.set(zkey, {
      value: JSON.stringify(items),
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (this.client?.status === 'ready') {
      await this.client.expire(key, ttlSeconds);
      return;
    }
    const entry = this.memory.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
    const zkey = `zset:${key}`;
    const zentry = this.memory.get(zkey);
    if (zentry) {
      zentry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }

  /** Cache-aside helper for JSON payloads. */
  async getOrSetJson<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        await this.del(key);
      }
    }
    const value = await factory();
    await this.set(key, JSON.stringify(value), ttlSeconds);
    return value;
  }

  async invalidatePattern(prefix: string): Promise<void> {
    if (this.client?.status === 'ready') {
      const stream = this.client.scanStream({ match: `${prefix}*`, count: 100 });
      const keys: string[] = [];
      for await (const batch of stream) {
        keys.push(...(batch as string[]));
      }
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return;
    }
    for (const key of [...this.memory.keys()]) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
      }
    }
  }
}
