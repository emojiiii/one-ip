import type { Reroute } from "@sveltejs/kit/hooks";
import { unlocalizedPath } from "./lib/i18n";

export const reroute: Reroute = ({ url }) => unlocalizedPath(url.pathname);
