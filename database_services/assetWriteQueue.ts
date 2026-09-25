const queues = new Map<string, Promise<void>>();

/**
 * Serialize asset mutations for one quest so record, undo, delete, merge,
 * and exit-time verse normalize cannot PATCH/DELETE the same rows at once.
 */
export function enqueueAssetWrite<T>(
  questId: string | undefined,
  work: () => Promise<T>
): Promise<T> {
  if (!questId) return work();

  const previous = queues.get(questId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(work);
  queues.set(
    questId,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

export function whenAssetWritesIdle(
  questId: string | undefined
): Promise<void> {
  if (!questId) return Promise.resolve();
  return queues.get(questId) ?? Promise.resolve();
}
