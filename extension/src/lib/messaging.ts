import { PORT_NAME } from "@lctrainer/shared";
import type { BackgroundToContentMessage, ContentToBackgroundMessage } from "@lctrainer/shared";

export { PORT_NAME };
export type { BackgroundToContentMessage, ContentToBackgroundMessage };

export function connectToBackground(): chrome.runtime.Port {
  return chrome.runtime.connect({ name: PORT_NAME });
}
