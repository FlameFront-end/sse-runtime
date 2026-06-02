import type { AuthOptions } from "../types/public";

export type TokenProvider = () => string | null | undefined | Promise<string | null | undefined>;

export type BearerAuthOptions = {
  readonly headers?: Record<string, string>;
  readonly scheme?: string;
  readonly onUnauthorized?: () => void | Promise<void>;
};

export function createBearerAuth(
  getToken: TokenProvider,
  options: BearerAuthOptions = {}
): { readonly headers: () => Promise<Record<string, string>>; readonly auth: AuthOptions } {
  const scheme = options.scheme ?? "Bearer";

  return {
    headers: async (): Promise<Record<string, string>> => {
      const token = await getToken();
      const base = { ...(options.headers ?? {}) };
      return token ? { ...base, Authorization: `${scheme} ${token}` } : base;
    },
    auth: {
      onUnauthorized: async (): Promise<void> => {
        if (options.onUnauthorized) {
          await options.onUnauthorized();
          return;
        }
        await getToken();
      },
      retryAfterRefresh: true
    }
  };
}
