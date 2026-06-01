import type { AuthOptions } from "../types/public";

export async function refreshAuth(options: AuthOptions): Promise<boolean> {
  if (!options.onUnauthorized) {
    return false;
  }

  await options.onUnauthorized();

  return options.retryAfterRefresh ?? true;
}
