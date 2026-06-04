import { createContext } from "react";
import type { SSEClient } from "@flamefrontend/sse-runtime-core";

export type ReactNativeSSEDevtoolsClientInfo = {
  readonly id: string;
  readonly url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly client: SSEClient<any>;
};

export type ReactNativeSSEDevtoolsRegistration = {
  readonly register: (info: ReactNativeSSEDevtoolsClientInfo) => () => void;
};

export const ReactNativeSSEDevtoolsRegistrationContext =
  createContext<ReactNativeSSEDevtoolsRegistration | null>(null);
