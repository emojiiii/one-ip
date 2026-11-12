export async function runProbeBatch<T>(
  items: readonly T[],
  concurrency: number,
  signal: AbortSignal,
  probe: (item: T) => Promise<void>,
) {
  let next = 0;
  const lane = async () => {
    while (!signal.aborted && next < items.length) {
      await probe(items[next++]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, lane),
  );
}
