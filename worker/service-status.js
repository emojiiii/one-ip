import { getAiStatus } from "./ai-status.js";
import { cachedData } from "./cache.js";
import { getCloudStatus } from "./cloud-status.js";
import { HttpError } from "./http.js";
import services from "./services.json" with { type: "json" };

const catalog = new Map(services.map((service) => [service.id, service]));
const cloudProviders = new Set([
  "aws",
  "google-cloud",
  "oracle-cloud",
  "34",
  "aliyun",
  "tencent-cloud",
  "azure",
]);
const indicators = new Set([
  "none",
  "minor",
  "major",
  "critical",
  "maintenance",
]);
const batchSize = 12;
const concurrency = 4;

export async function serviceStatus(id, origin) {
  const service = catalog.get(id);
  if (!service) throw new HttpError(404, "未知服务");
  if (!service.url)
    throw new HttpError(
      503,
      "该服务未提供已接入的公开状态接口，请查看官方状态页",
    );
  return cachedData(
    new URL(`/api/status/${id}`, origin),
    60,
    async () => {
      const data = await (service.group === "VPS" || cloudProviders.has(id)
        ? getCloudStatus(service)
        : getAiStatus(service));
      return {
        ...normalizeStatus(data),
        fetchedAt: new Date().toISOString(),
        source: service.url,
      };
    },
    (data) => indicators.has(data.status?.indicator),
  );
}

export async function statusSummary(url) {
  // A cache miss can use three subrequests per service before provider-specific
  // lookups and redirects, so cap each batch for the Workers Free plan.
  const requested = url.searchParams.get("ids")?.split(",", batchSize + 1);
  if (
    !requested ||
    requested.length > batchSize ||
    requested.some((id) => !catalog.has(id))
  )
    throw new HttpError(400, `请指定不超过 ${batchSize} 个有效的服务 ID`);

  const ids = [...new Set(requested)];
  const entries = {};
  let next = 0;
  async function collect() {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        const { status, fetchedAt } = await serviceStatus(id, url.origin);
        entries[id] = indicators.has(status?.indicator)
          ? {
              status: {
                indicator: status.indicator,
                description: status.description,
              },
              fetchedAt,
            }
          : null;
      } catch {
        entries[id] = null;
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(ids.length, concurrency) }, collect),
  );
  return { services: entries };
}

export function normalizeStatus(data) {
  if (data.status?.indicator) return data;
  const states = {
    UP: { indicator: "none", description: "正常运行" },
    HASISSUES: { indicator: "minor", description: "存在服务故障" },
    UNDERMAINTENANCE: { indicator: "maintenance", description: "维护中" },
  };
  const status = states[data.page?.status];
  if (!status) return data;
  const incidents = [
    ...(data.activeIncidents ?? []).filter(
      (item) => item.status !== "RESOLVED",
    ),
    ...(data.activeMaintenances ?? []).filter(
      (item) => item.status === "INPROGRESS",
    ),
  ];
  return {
    status,
    incidents: incidents.map((item) => ({
      id: item.id ?? item.url,
      name: item.name,
      status: item.status,
      updated_at: item.updatedAt ?? item.started ?? item.start,
      shortlink: item.url,
    })),
  };
}
