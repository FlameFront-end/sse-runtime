export type AuthOptions = {
  readonly onUnauthorized?: () => Promise<void>;
  readonly retryAfterRefresh?: boolean;
};
