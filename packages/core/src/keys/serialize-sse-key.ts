export function serializeSSEKey(key: readonly string[]): string {
  return JSON.stringify(key);
}

export function serializeSSECoordination(value: unknown): string {
  return JSON.stringify(value ?? null);
}
