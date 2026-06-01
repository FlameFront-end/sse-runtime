export function combineSignals(first: AbortSignal, second: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([first, second]);
  }

  const controller = new AbortController();

  const forwardAbort = (source: AbortSignal): void => {
    controller.abort(source.reason);
  };

  if (first.aborted) {
    forwardAbort(first);
  } else if (second.aborted) {
    forwardAbort(second);
  } else {
    first.addEventListener("abort", () => forwardAbort(first), { once: true });
    second.addEventListener("abort", () => forwardAbort(second), { once: true });
  }

  return controller.signal;
}
