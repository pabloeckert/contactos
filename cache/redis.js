import redis from 'redis';
import NodeCache from 'node-cache';

let redisClient = null;
let fallbackCache = null;

export async function initCache() {
  try {
    if (process.env.REDIS_URL) {
      redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        socket: { connectTimeout: 5000, reconnectStrategy: (retries) => Math.min(retries * 50, 500) }
      });
      
      redisClient.on('error', (err) => {
        console.warn('⚠️ Redis error, falling back to in-memory cache:', err.message);
        useNodeCache();
      });
      
      await redisClient.connect();
      console.log('✅ Redis cache initialized');
    } else {
      useNodeCache();
    }
  } catch (error) {
    console.warn('⚠️ Redis unavailable, using in-memory cache');
    useNodeCache();
  }
}

function useNodeCache() {
  fallbackCache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL || 3600) });
  console.log('✅ In-memory cache initialized');
}

export async function cacheGet(key) {
  if (redisClient) {
    return await redisClient.get(key);
  }
  return fallbackCache?.get(key);
}

export async function cacheSet(key, value, ttl = null) {
  const options = ttl ? { EX: ttl } : {};
  if (redisClient) {
    await redisClient.set(key, JSON.stringify(value), options);
  } else {
    fallbackCache?.set(key, value, ttl);
  }
}

export async function cacheDel(key) {
  if (redisClient) {
    await redisClient.del(key);
  } else {
    fallbackCache?.del(key);
  }
}

export async function cacheFlush() {
  if (redisClient) {
    await redisClient.flushAll();
  } else {
    fallbackCache?.flushAll();
  }
}