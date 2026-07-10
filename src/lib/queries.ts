import { queryOptions } from "@tanstack/react-query";
import { loadSite } from "./iiif";

export function siteQuery(configUrl: string) {
	return queryOptions({
		queryKey: ["site", configUrl],
		queryFn: () => loadSite(configUrl),
		staleTime: 0,
	});
}
