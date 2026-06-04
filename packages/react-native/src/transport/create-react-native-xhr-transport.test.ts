import { describe, expect, it, vi } from "vitest";

import { createReactNativeXHRTransport } from "./create-react-native-xhr-transport";

const XHR_UNSENT = 0;
const XHR_OPENED = 1;
const XHR_HEADERS_RECEIVED = 2;
const XHR_LOADING = 3;
const XHR_DONE = 4;

describe("createReactNativeXHRTransport", () => {
  it("opens an SSE GET request with default and custom headers", async () => {
    const xhr = new FakeXMLHttpRequest();
    const transport = createReactNativeXHRTransport({
      createXMLHttpRequest: () => asXMLHttpRequest(xhr)
    });
    const abortController = new AbortController();

    const responsePromise = transport({
      url: "https://example.com/sse",
      headers: { Authorization: "Bearer token" },
      credentials: "include",
      signal: abortController.signal
    });

    expect(xhr.method).toBe("GET");
    expect(xhr.url).toBe("https://example.com/sse");
    expect(xhr.async).toBe(true);
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.headers).toEqual({
      Accept: "text/event-stream",
      Authorization: "Bearer token",
      "Cache-Control": "no-store"
    });

    xhr.receiveHeaders(200);

    const response = await responsePromise;

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.body).not.toBeNull();
  });

  it("streams incremental responseText chunks as Uint8Array values", async () => {
    const xhr = new FakeXMLHttpRequest();
    const transport = createReactNativeXHRTransport({
      createXMLHttpRequest: () => asXMLHttpRequest(xhr)
    });

    const responsePromise = transport({
      url: "/stream",
      signal: new AbortController().signal
    });

    xhr.receiveHeaders(200);
    const response = await responsePromise;
    const reader = response.body!.getReader();

    xhr.receiveProgress("data: one\n\n");
    xhr.receiveProgress("data: one\n\ndata: two\n\n");
    xhr.finish();

    await expect(readText(reader)).resolves.toEqual("data: one\n\n");
    await expect(readText(reader)).resolves.toEqual("data: two\n\n");
    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
  });

  it("aborts the XHR request when the signal aborts before headers arrive", async () => {
    const xhr = new FakeXMLHttpRequest();
    const transport = createReactNativeXHRTransport({
      createXMLHttpRequest: () => asXMLHttpRequest(xhr)
    });
    const abortController = new AbortController();

    const responsePromise = transport({
      url: "/stream",
      signal: abortController.signal
    });

    abortController.abort();

    await expect(responsePromise).rejects.toThrow("SSE request aborted");
    expect(xhr.abort).toHaveBeenCalledTimes(1);
  });
});

async function readText(
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string | undefined> {
  const chunk = await reader.read();

  return chunk.value ? new TextDecoder().decode(chunk.value) : undefined;
}

function asXMLHttpRequest(xhr: FakeXMLHttpRequest): XMLHttpRequest {
  return xhr as unknown as XMLHttpRequest;
}

class FakeXMLHttpRequest {
  readonly abort = vi.fn(() => {
    this.readyState = XHR_DONE;
    this.onabort?.();
  });

  async = false;
  headers: Record<string, string> = {};
  method = "";
  onabort: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onprogress: (() => void) | null = null;
  onreadystatechange: (() => void) | null = null;
  readyState = XHR_UNSENT;
  responseText = "";
  status = 0;
  url = "";
  withCredentials = false;

  open(method: string, url: string, async: boolean): void {
    this.method = method;
    this.url = url;
    this.async = async;
    this.readyState = XHR_OPENED;
  }

  send(): void {
    this.readyState = XHR_LOADING;
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  receiveHeaders(status: number): void {
    this.status = status;
    this.readyState = XHR_HEADERS_RECEIVED;
    this.onreadystatechange?.();
  }

  receiveProgress(responseText: string): void {
    this.responseText = responseText;
    this.readyState = XHR_LOADING;
    this.onprogress?.();
  }

  finish(): void {
    this.readyState = XHR_DONE;
    this.onreadystatechange?.();
  }
}
