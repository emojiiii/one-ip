import { json } from "./http.js";

export async function cachedJson(url, ttl, load, cacheable = () => true) {
  return json(await cachedData(url, ttl, load, cacheable));
}

export async function cachedData(url, ttl, load, cacheable = () => true) {
  const cache = globalThis.caches?.default;
  const cacheUrl = new URL(url);
  cacheUrl.search = "";
  cacheUrl.hash = "";
  const key = new Request(cacheUrl);
  const cached = await cache?.match(key).catch(() => undefined);
  if (cached) {
    const data = await cached.json().catch(() => undefined);
    if (data !== undefined) return data;
  }
  const data = await load();
  if (cache && cacheable(data)) {
    const entry = json(data);
    entry.headers.set("Cache-Control", `public, max-age=${ttl}`);
    await cache.put(key, entry).catch(() => {});
  }
  return data;
}
