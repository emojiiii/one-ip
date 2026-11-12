export async function hasValidUpdate(url: string, currentVersion: string, signal: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(url, { cache: 'no-store', signal });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('version' in data)) return false;
    return typeof data.version === 'string' && data.version.length > 0 && data.version !== currentVersion;
  } catch {
    return false;
  }
}
