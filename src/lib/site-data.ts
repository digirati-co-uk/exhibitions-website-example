import { createIiifViteClient } from "iiif-hss/vite/client";
import {
	type DescriptiveResource,
	findGithubRepository,
	findRouteService,
	findSiteHomepage,
	type IIIFCollection,
	type IIIFCollectionItem,
	type IIIFManifest,
	isExhibition,
	isReservedPath,
	mapResourceToSite,
	normalizePath,
	pathSegment,
	remoteUrl,
	STATIC_SITE_INFO_BEHAVIOR,
	type StaticSiteRouteService,
	sameResource,
	sourcePath,
} from "./iiif";

export interface HssResource extends DescriptiveResource {
	type: "Collection" | "Manifest";
	"hss:slug": string;
}

export interface HssResourceDescriptor {
	"hss:slug": string;
	id: string;
	type: "Collection" | "Manifest";
	origin: "source" | "generated";
	parents?: string[];
}

export interface HssBuildManifest {
	formatVersion: number;
	mode: "full" | "partial";
	canonicalBaseUrl?: string;
	entrypoints?: {
		resources?: string;
		resourceDescriptors?: string;
	};
}

export interface SiteIndexEntry extends DescriptiveResource {
	type: "Collection" | "Manifest";
	path: string;
	hssSlug?: string;
	isExhibition: boolean;
	unavailable?: string;
}

export interface SiteIndex {
	rootUrl: string;
	info: DescriptiveResource;
	routeService: StaticSiteRouteService;
	homepage?: string;
	repository?: string;
	entriesByPath: Map<string, SiteIndexEntry>;
	entriesById: Map<string, SiteIndexEntry>;
	exhibitions: SiteIndexEntry[];
	defaultLanguage: string;
}

export interface ResourcePageData {
	entry: SiteIndexEntry;
	resource?: IIIFCollection | IIIFManifest;
	jsonUrl?: string;
	children?: SiteIndexEntry[];
	breadcrumbs: SiteIndexEntry[];
	unavailable?: string;
}

interface HssMeta {
	"site:info"?: DescriptiveResource;
}

interface SiteDataOptions {
	baseUrl: string;
	fetchFn?: typeof fetch;
	expectedBasePath?: string;
	siteUrlOverride?: string;
}

function asResource(value: unknown) {
	if (!value || typeof value !== "object") return;
	const resource = value as IIIFCollection | IIIFManifest;
	if (
		!resource.id ||
		(resource.type !== "Collection" && resource.type !== "Manifest")
	)
		return;
	return resource;
}

function asRecord(value: unknown) {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: undefined;
}

function localUrl(baseUrl: string, path: string) {
	return new URL(
		path.replace(/^\/+/, ""),
		`${baseUrl.replace(/\/+$/, "")}/`,
	).toString();
}

async function json(fetchFn: typeof fetch, url: string) {
	const response = await fetchFn(url);
	if (!response.ok)
		throw new Error(`Unable to load ${url} (${response.status})`);
	return response.json() as Promise<unknown>;
}

function copyDescription(
	entry: SiteIndexEntry,
	resource: Partial<DescriptiveResource>,
) {
	return {
		...entry,
		...Object.fromEntries(
			[
				"label",
				"summary",
				"metadata",
				"thumbnail",
				"logo",
				"homepage",
				"seeAlso",
				"service",
				"provider",
				"behavior",
			]
				.filter(
					(field) => resource[field as keyof DescriptiveResource] !== undefined,
				)
				.map((field) => [field, resource[field as keyof DescriptiveResource]]),
		),
	};
}

export function findSiteResources(
	resources: Record<string, HssResource>,
	descriptors: Record<string, HssResourceDescriptor>,
) {
	const matches: Array<{ root: HssResource; info: HssResource }> = [];
	for (const [key, info] of Object.entries(resources)) {
		if (
			info.type !== "Collection" ||
			!info.behavior?.includes(STATIC_SITE_INFO_BEHAVIOR)
		)
			continue;
		const slug = info["hss:slug"] || key;
		const descriptor = descriptors[slug];
		if (descriptor?.origin !== "source" || descriptor.parents?.length !== 1)
			continue;
		const parentSlug = descriptor.parents[0];
		if (!parentSlug) continue;
		const parentDescriptor = descriptors[parentSlug];
		const root = resources[parentSlug];
		if (
			parentDescriptor?.origin !== "source" ||
			parentDescriptor.parents?.length ||
			root?.type !== "Collection" ||
			sourcePath(root.id, info.id) !== "info"
		)
			continue;
		matches.push({ root, info });
	}
	if (matches.length === 0)
		throw new Error(
			"HSS output has no marked direct static-site-info Collection",
		);
	if (matches.length > 1)
		throw new Error(
			"HSS output has more than one marked direct static-site-info Collection",
		);
	return matches[0] as { root: HssResource; info: HssResource };
}

export function entriesFromResources(
	rootUrl: string,
	resources: Record<string, HssResource>,
) {
	const entries: SiteIndexEntry[] = [];
	for (const [key, item] of Object.entries(resources)) {
		if (item.type !== "Collection" && item.type !== "Manifest") continue;
		const path = sourcePath(rootUrl, item.id);
		if (path === undefined) continue;
		entries.push({
			...item,
			path,
			hssSlug: item["hss:slug"] || key,
			isExhibition: isExhibition(item.behavior),
		});
	}
	return entries;
}

export function createSiteIndex({
	rootUrl,
	defaultLanguage,
	resources,
	info,
	routeService,
	exhibitionsCollection,
	catalogCollection,
}: {
	rootUrl: string;
	defaultLanguage: string;
	resources: Record<string, HssResource>;
	info: DescriptiveResource;
	routeService: StaticSiteRouteService;
	exhibitionsCollection: IIIFCollection;
	catalogCollection?: IIIFCollection;
}): SiteIndex {
	const entries = entriesFromResources(rootUrl, resources);
	const entriesByPath = new Map<string, SiteIndexEntry>();
	const entriesById = new Map<string, SiteIndexEntry>();
	for (const entry of entries) {
		if (sameResource(entry.id, info.id)) continue;
		if (isReservedPath(entry.path))
			throw new Error(`Reserved route path collision: /${entry.path}`);
		if (entriesByPath.has(entry.path))
			throw new Error(`Duplicate route path: /${entry.path}`);
		entriesByPath.set(entry.path, entry);
		entriesById.set(entry.id, entry);
	}
	const root = entriesByPath.get("");
	if (!root || root.type !== "Collection" || !sameResource(root.id, rootUrl))
		throw new Error(
			"HSS resources do not contain the configured root Collection",
		);
	if (
		info.type !== "Collection" ||
		!info.behavior?.includes(STATIC_SITE_INFO_BEHAVIOR) ||
		sourcePath(rootUrl, info.id) !== "info"
	)
		throw new Error(
			"The configured root must contain one marked direct info Collection",
		);
	if (!sameResource(routeService.source, rootUrl))
		throw new Error(
			"Static-site route service source does not match the root Collection",
		);
	for (const item of catalogCollection?.items || []) {
		const known = entriesById.get(item.id);
		if (!known) continue;
		const updated = copyDescription(known, item);
		entriesById.set(updated.id, updated);
		entriesByPath.set(updated.path, updated);
	}

	const exhibitions: SiteIndexEntry[] = [];
	for (const item of exhibitionsCollection.items || []) {
		if (item.type !== "Manifest") continue;
		const known = entriesById.get(item.id);
		if (!known) continue;
		const updated = copyDescription({ ...known, isExhibition: true }, item);
		entriesById.set(updated.id, updated);
		entriesByPath.set(updated.path, updated);
		exhibitions.push(updated);
	}

	return {
		rootUrl,
		info,
		routeService,
		homepage: findSiteHomepage(info)?.id,
		repository: findGithubRepository(info)?.id,
		entriesByPath,
		entriesById,
		exhibitions,
		defaultLanguage,
	};
}

function breadcrumbs(site: SiteIndex, entry: SiteIndexEntry) {
	const crumbs: SiteIndexEntry[] = [];
	const parts = entry.path.split("/").filter(Boolean);
	const root = site.entriesByPath.get("");
	if (root) crumbs.push(root);
	for (let index = 0; index < parts.length; index++) {
		const found = site.entriesByPath.get(parts.slice(0, index + 1).join("/"));
		if (found) crumbs.push(found);
	}
	if (crumbs.at(-1)?.id !== entry.id) crumbs.push(entry);
	return crumbs;
}

function childEntry(
	site: SiteIndex,
	item: IIIFCollectionItem,
	parentPath: string,
) {
	if (item.type !== "Collection" && item.type !== "Manifest") return;
	if (sameResource(item.id, site.info.id)) return;
	const segment = pathSegment(item.id);
	if (!segment) return;
	const path = normalizePath([parentPath, segment].filter(Boolean).join("/"));
	if (isReservedPath(path)) return;
	const known = site.entriesById.get(item.id);
	return copyDescription(
		known || {
			id: item.id,
			type: item.type,
			path,
			isExhibition: isExhibition(item.behavior),
		},
		item,
	);
}

function normalizedPathname(value: string) {
	const pathname = new URL(value, "https://site.invalid").pathname.replace(
		/\/+$/,
		"",
	);
	return pathname || "/";
}

export function createSiteData(options: SiteDataOptions) {
	const fetchFn = options.fetchFn || fetch;
	const iiifBase =
		typeof window === "undefined"
			? new URL("/iiif", options.baseUrl).toString()
			: localUrl(options.baseUrl, "iiif");
	const client = createIiifViteClient({
		baseUrl: iiifBase,
		fetchFn,
		cache: false,
	});

	async function loadIndex() {
		const [
			configValue,
			buildValue,
			resourcesValue,
			exhibitionsValue,
			catalogValue,
		] = await Promise.all([
			json(fetchFn, localUrl(options.baseUrl, "site.config.json")),
			client.getBuildManifest(),
			client.getResources(),
			json(
				fetchFn,
				localUrl(iiifBase, "collections/exhibitions/collection.json"),
			),
			json(fetchFn, localUrl(iiifBase, "manifests/collection.json")),
		]);
		const config = asRecord(configValue);
		const build = asRecord(buildValue) as HssBuildManifest | undefined;
		if (
			build?.formatVersion !== 1 ||
			build.mode !== "full" ||
			typeof build.entrypoints?.resourceDescriptors !== "string"
		)
			throw new Error("HSS output is not a complete format 1 build");
		const resources = asRecord(resourcesValue) as
			| Record<string, HssResource>
			| undefined;
		if (!resources) throw new Error("HSS resource lookup is unavailable");
		const descriptorsValue = await json(
			fetchFn,
			localUrl(iiifBase, build.entrypoints.resourceDescriptors),
		);
		const descriptors = asRecord(descriptorsValue) as
			| Record<string, HssResourceDescriptor>
			| undefined;
		if (!descriptors)
			throw new Error("HSS resource descriptors are unavailable");
		const { root, info: infoSnippet } = findSiteResources(
			resources,
			descriptors,
		);
		const infoMeta = asRecord(
			await json(
				fetchFn,
				localUrl(iiifBase, `${infoSnippet["hss:slug"]}/meta.json`),
			),
		) as HssMeta | undefined;
		const info = infoMeta?.["site:info"];
		if (!info || !sameResource(info.id, infoSnippet.id))
			throw new Error("The marked info Collection is missing site metadata");
		const routeService = findRouteService(info);
		if (!routeService)
			throw new Error("Static-site info is missing its route service");
		if (!sameResource(routeService.source, root.id))
			throw new Error(
				"Static-site route service source does not match the root Collection",
			);
		if (!mapResourceToSite(routeService, root.id))
			throw new Error("Static-site route service does not map the site root");
		const homepage = findSiteHomepage(info);
		if (homepage && !sameResource(homepage.id, routeService.id))
			throw new Error(
				"Static-site homepage does not match the route service target",
			);
		if (
			options.expectedBasePath &&
			normalizedPathname(options.expectedBasePath) !==
				normalizedPathname(routeService.id)
		)
			throw new Error(
				"SITE_BASE_PATH does not match the route service target path",
			);
		if (options.siteUrlOverride) {
			const override = new URL(
				options.expectedBasePath || "/",
				`${options.siteUrlOverride.replace(/\/+$/, "")}/`,
			).toString();
			if (!sameResource(override, routeService.id))
				throw new Error(
					"VITE_SITE_URL does not match the route service target",
				);
		}
		if (options.expectedBasePath) {
			const expectedHssBase = new URL(
				"iiif",
				`${routeService.id.replace(/\/+$/, "")}/`,
			);
			if (
				build.canonicalBaseUrl &&
				!sameResource(build.canonicalBaseUrl, expectedHssBase.toString())
			)
				throw new Error(
					"HSS canonical base URL does not match the deployed site /iiif path",
				);
		}
		const exhibitionsCollection = asResource(exhibitionsValue);
		if (exhibitionsCollection?.type !== "Collection")
			throw new Error("The generated Exhibitions Collection is malformed");
		const catalogCollection = asResource(catalogValue);
		if (catalogCollection?.type !== "Collection")
			throw new Error("The generated Manifest index is malformed");
		return createSiteIndex({
			rootUrl: root.id,
			defaultLanguage:
				typeof config?.defaultLanguage === "string"
					? config.defaultLanguage
					: "en",
			resources,
			info,
			routeService,
			exhibitionsCollection,
			catalogCollection,
		});
	}

	async function pageFromResource(
		site: SiteIndex,
		entry: SiteIndexEntry,
		resource: IIIFCollection | IIIFManifest,
		jsonUrl?: string,
		extraBreadcrumbs?: SiteIndexEntry[],
	): Promise<ResourcePageData> {
		const liveEntry = copyDescription(
			{
				...entry,
				isExhibition:
					resource.type === "Manifest" && isExhibition(resource.behavior),
			},
			resource,
		);
		return {
			entry: liveEntry,
			resource,
			jsonUrl: jsonUrl || resource.id,
			children:
				resource.type === "Collection"
					? (resource.items || [])
							.map((item) => childEntry(site, item, liveEntry.path))
							.filter((item): item is SiteIndexEntry => Boolean(item))
					: undefined,
			breadcrumbs: extraBreadcrumbs || breadcrumbs(site, liveEntry),
		};
	}

	async function loadHome(site: SiteIndex) {
		const root = site.entriesByPath.get("");
		if (!root) throw new Error("The root IIIF Collection is unavailable");
		return loadKnown(site, root);
	}

	async function loadKnown(site: SiteIndex, entry: SiteIndexEntry) {
		try {
			const loaded = await client.loadResource(
				entry.hssSlug || entry.id,
				entry.type,
			);
			const resource = asResource(loaded.resource);
			if (!resource) throw new Error("Remote IIIF resource is unavailable");
			return pageFromResource(
				site,
				entry,
				resource,
				loaded.links.remoteJson || loaded.links.json || undefined,
			);
		} catch (error) {
			const unavailable =
				error instanceof Error
					? error.message
					: "Remote IIIF resource is unavailable";
			return {
				entry,
				breadcrumbs: breadcrumbs(site, entry),
				unavailable,
			} satisfies ResourcePageData;
		}
	}

	async function loadDynamic(site: SiteIndex, path: string) {
		try {
			const direct = await client.loadResource(remoteUrl(site.rootUrl, path));
			const resource = asResource(direct.resource);
			if (resource && sourcePath(site.rootUrl, resource.id) === path) {
				const entry: SiteIndexEntry = {
					id: resource.id,
					type: resource.type,
					path,
					isExhibition:
						resource.type === "Manifest" && isExhibition(resource.behavior),
				};
				return pageFromResource(site, entry, resource, resource.id);
			}
		} catch {
			// A non-root-relative child needs bounded ancestor traversal below.
		}

		const parts = path.split("/").filter(Boolean);
		const rootEntry = site.entriesByPath.get("");
		if (!rootEntry) return;
		const rootLoaded = await client.loadCollection(
			rootEntry.hssSlug || rootEntry.id,
		);
		let collection = asResource(rootLoaded.resource);
		if (collection?.type !== "Collection") return;
		const dynamicBreadcrumbs = [rootEntry];
		const visited = new Set([collection.id]);
		let parentPath = "";

		for (let index = 0; index < parts.length; index++) {
			const item = (collection.items || []).find(
				(candidate) =>
					(candidate.type === "Collection" || candidate.type === "Manifest") &&
					pathSegment(candidate.id) === parts[index],
			);
			if (!item) return;
			const entry = childEntry(site, item, parentPath);
			if (!entry) return;
			if (index === parts.length - 1) {
				const loaded = await client.loadResource(
					item.id,
					item.type as "Collection" | "Manifest",
				);
				const resource = asResource(loaded.resource);
				if (!resource) return;
				return pageFromResource(site, entry, resource, resource.id, [
					...dynamicBreadcrumbs,
					entry,
				]);
			}
			if (item.type !== "Collection" || visited.has(item.id)) return;
			visited.add(item.id);
			dynamicBreadcrumbs.push(entry);
			parentPath = entry.path;
			const loaded = await client.loadCollection(item.id);
			collection = asResource(loaded.resource);
			if (collection?.type !== "Collection") return;
		}
	}

	async function loadResource(site: SiteIndex, requestedPath: string) {
		const path = normalizePath(requestedPath);
		if (!path || isReservedPath(path)) return;
		const known = site.entriesByPath.get(path);
		return known ? loadKnown(site, known) : loadDynamic(site, path);
	}

	async function loadExhibitions(site: SiteIndex) {
		const loaded = await client.loadCollection("collections/exhibitions");
		const collection = asResource(loaded.resource);
		if (collection?.type !== "Collection")
			throw new Error("The generated Exhibitions Collection is unavailable");
		return site.exhibitions;
	}

	async function loadFeatured(site: SiteIndex) {
		const loaded = await client.loadCollection("collections/featured");
		const collection = asResource(loaded.resource);
		if (!collection) return [];
		if (collection.type !== "Collection")
			throw new Error("The generated Featured Collection is malformed");
		return (collection.items || [])
			.map((item) => childEntry(site, item, ""))
			.filter((item): item is SiteIndexEntry => Boolean(item));
	}

	return { loadIndex, loadHome, loadResource, loadExhibitions, loadFeatured };
}
