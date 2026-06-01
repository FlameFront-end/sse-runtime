import { useRef } from "react";
import type { MutableRefObject } from "react";

export function useLatestRef<Value>(value: Value): MutableRefObject<Value> {
  const valueRef = useRef(value);
  valueRef.current = value;

  return valueRef;
}
