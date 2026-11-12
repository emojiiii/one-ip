export type StatusSummary = {
  status: { indicator: string; description: string };
  fetchedAt: string;
};

export async function fetchStatusSummary(ids: readonly string[], signal: AbortSignal) {
  const query = new URLSearchParams({ ids: ids.join(",") });
  const response = await fetch(`/api/status/summary?${query}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(24_000)]),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result: { services: Record<string, StatusSummary | null> } = await response.json();
  return result.services;
}
