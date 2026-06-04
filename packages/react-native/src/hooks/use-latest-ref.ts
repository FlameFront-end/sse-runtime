import { useRef } from "react";

export function useLatestRef<T>(value: T): { readonly current: T } {
  const valueRef = useRef(value);
  valueRef.current = value;

  return valueRef;
}
