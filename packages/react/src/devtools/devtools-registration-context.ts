import { createContext } from "react";
import type { SSEClient } from "@flamefrontend/sse-runtime-core";

export type SSEDevtoolsClientInfo = {
  readonly id: string;
  readonly url: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly client: SSEClient<any>;
};

export type SSEDevtoolsRegistration = {
  readonly register: (info: SSEDevtoolsClientInfo) => () => void;
};

export const SSEDevtoolsRegistrationContext = createContext<SSEDevtoolsRegistration | null>(null);
