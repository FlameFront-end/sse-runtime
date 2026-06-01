export type FetchTransportOptions = {
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly credentials?: RequestCredentials;
  readonly signal: AbortSignal;
};

export type SSETransport = (options: FetchTransportOptions) => Promise<Response>;

const DEFAULT_SSE_HEADERS: Record<string, string> = {
  Accept: "text/event-stream",
  "Cache-Control": "no-store"
};

export async function createFetchTransport(options: FetchTransportOptions): Promise<Response> {
  return fetch(options.url, {
    headers: { ...DEFAULT_SSE_HEADERS, ...options.headers },
    credentials: options.credentials,
    signal: options.signal
  });
}
