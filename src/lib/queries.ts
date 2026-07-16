import { queryOptions } from "@tanstack/react-query";
import { createSiteData, type SiteIndex } from "./site-data";

function runtimeBaseUrl(baseUrl: string) {
	return typeof window === "undefined"
		? baseUrl
		: new URL(import.meta.env.BASE_URL, window.location.href).toString();
}

export function siteQuery(baseUrl: string) {
	return queryOptions({
		queryKey: ["site", baseUrl],
		queryFn: () =>
			createSiteData({
				baseUrl: runtimeBaseUrl(baseUrl),
				expectedBasePath: import.meta.env.PROD
					? import.meta.env.BASE_URL
					: undefined,
				siteUrlOverride: import.meta.env.VITE_SITE_URL,
			}).loadIndex(),
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export function homeQuery(baseUrl: string, site: SiteIndex) {
	return queryOptions({
		queryKey: ["home", baseUrl, site.routeService.source, site.routeService.id],
		queryFn: () =>
			createSiteData({ baseUrl: runtimeBaseUrl(baseUrl) }).loadHome(site),
		staleTime: 0,
	});
}

export function resourceQuery(baseUrl: string, site: SiteIndex, path: string) {
	return queryOptions({
		queryKey: [
			"resource",
			baseUrl,
			site.routeService.source,
			site.routeService.id,
			path,
		],
		queryFn: async () =>
			(await createSiteData({
				baseUrl: runtimeBaseUrl(baseUrl),
			}).loadResource(site, path)) ?? null,
		staleTime: 0,
	});
}

export function exhibitionsQuery(baseUrl: string, site: SiteIndex) {
	return queryOptions({
		queryKey: [
			"exhibitions",
			baseUrl,
			site.routeService.source,
			site.routeService.id,
		],
		queryFn: () =>
			createSiteData({ baseUrl: runtimeBaseUrl(baseUrl) }).loadExhibitions(
				site,
			),
		staleTime: Number.POSITIVE_INFINITY,
	});
}

export function featuredQuery(baseUrl: string, site: SiteIndex) {
	return queryOptions({
		queryKey: [
			"featured",
			baseUrl,
			site.routeService.source,
			site.routeService.id,
		],
		queryFn: () =>
			createSiteData({ baseUrl: runtimeBaseUrl(baseUrl) }).loadFeatured(site),
		staleTime: Number.POSITIVE_INFINITY,
	});
}
