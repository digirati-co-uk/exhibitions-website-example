import { describe, expect, it, vi } from "vitest";
import { STATIC_SITE_ROUTE_PROFILE, type StaticSiteRouteService } from "./iiif";
import {
	createSiteData,
	createSiteIndex,
	entriesFromResources,
	findSiteResources,
	type HssResource,
	type HssResourceDescriptor,
} from "./site-data";

const rootUrl = "https://remote.test/root";
const siteUrl = "https://site.test/";
const baseUrl = "https://site.test/";
const routeService = {
	id: siteUrl,
	type: "Service" as const,
	profile: STATIC_SITE_ROUTE_PROFILE,
	source: rootUrl,
} satisfies StaticSiteRouteService;
const info = {
	id: `${rootUrl}/info`,
	type: "Collection" as const,
	label: { en: ["Site"] },
	behavior: ["static-site-info"],
	homepage: [
		{
			id: siteUrl,
			type: "Text",
			format: "text/html",
			label: { en: ["Visit the site"] },
		},
	],
	seeAlso: [
		{
			id: "https://github.com/example/site",
			type: "Text",
			profile: "https://github.com/",
		},
	],
	service: [routeService],
};

const resources: Record<string, HssResource> = {
	"source/root": {
		id: rootUrl,
		type: "Collection",
		label: { en: ["Root"] },
		"hss:slug": "source/root",
	},
	"source/root/info": {
		...info,
		"hss:slug": "source/root/info",
	},
	"source/root/folder": {
		id: `${rootUrl}/folder`,
		type: "Collection",
		label: { en: ["Folder"] },
		"hss:slug": "source/root/folder",
	},
	"source/root/folder/show": {
		id: `${rootUrl}/folder/show`,
		type: "Manifest",
		label: { en: ["Show"] },
		behavior: ["exhibition"],
		requiredStatement: {
			label: { en: ["Credit"] },
			value: { en: ["Example archive"] },
		},
		rights: "https://creativecommons.org/licenses/by/4.0/",
		rendering: [
			{
				id: "https://remote.test/root/folder/show.pdf",
				label: { en: ["Download PDF"] },
			},
		],
		"hss:slug": "source/root/folder/show",
	},
	"source/root/topics/info": {
		id: `${rootUrl}/topics/info`,
		type: "Collection",
		label: { en: ["Information topic"] },
		"hss:slug": "source/root/topics/info",
	},
};

const descriptors: Record<string, HssResourceDescriptor> = {
	"source/root": {
		id: rootUrl,
		type: "Collection",
		origin: "source",
		"hss:slug": "source/root",
	},
	"source/root/info": {
		id: `${rootUrl}/info`,
		type: "Collection",
		origin: "source",
		parents: ["source/root"],
		"hss:slug": "source/root/info",
	},
	"source/root/folder": {
		id: `${rootUrl}/folder`,
		type: "Collection",
		origin: "source",
		parents: ["source/root"],
		"hss:slug": "source/root/folder",
	},
	"source/root/folder/show": {
		id: `${rootUrl}/folder/show`,
		type: "Manifest",
		origin: "source",
		parents: ["source/root/folder"],
		"hss:slug": "source/root/folder/show",
	},
	"source/root/topics/info": {
		id: `${rootUrl}/topics/info`,
		type: "Collection",
		origin: "source",
		parents: ["source/root/topics"],
		"hss:slug": "source/root/topics/info",
	},
};

function index() {
	return createSiteIndex({
		rootUrl,
		defaultLanguage: "en",
		resources,
		info,
		routeService,
		exhibitionsCollection: {
			id: "https://site.test/iiif/collections/exhibitions/collection.json",
			type: "Collection",
			items: [
				{
					id: `${rootUrl}/folder/show`,
					type: "Manifest",
					label: { en: ["Show"] },
				},
			],
		},
		catalogCollection: {
			id: "catalog",
			type: "Collection",
			items: [
				{
					id: `${rootUrl}/folder/show`,
					type: "Manifest",
					thumbnail: [{ id: "https://images.test/show.jpg" }],
				},
			],
		},
	});
}

function response(value: unknown, status = 200) {
	return new Response(status === 204 ? null : JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function mockFetch(values: Record<string, unknown>) {
	return vi.fn(async (input: string | URL | Request) => {
		const url = input.toString();
		return url in values ? response(values[url]) : response({}, 404);
	}) as unknown as typeof fetch;
}

function indexArtifacts(prefix = baseUrl) {
	return {
		[`${prefix}site.config.json`]: { defaultLanguage: "en" },
		[`${prefix}iiif/meta/build.json`]: {
			formatVersion: 1,
			mode: "full",
			canonicalBaseUrl: `${prefix}iiif`,
			entrypoints: {
				resources: "meta/resources.json",
				resourceDescriptors: "meta/resource-descriptors.json",
			},
		},
		[`${prefix}iiif/meta/resources.json`]: resources,
		[`${prefix}iiif/meta/resource-descriptors.json`]: descriptors,
		[`${prefix}iiif/source/root/info/meta.json`]: { "site:info": info },
		[`${prefix}iiif/collections/exhibitions/collection.json`]: {
			id: "exhibitions",
			type: "Collection",
			items: [],
		},
		[`${prefix}iiif/manifests/collection.json`]: {
			id: "manifests",
			type: "Collection",
			items: [],
		},
	};
}

describe("HSS output format 1 site index", () => {
	it("discovers the marked direct info child through resource descriptors", () => {
		expect(findSiteResources(resources, descriptors)).toEqual({
			root: resources["source/root"],
			info: resources["source/root/info"],
		});
	});

	it("does not accept a nested marked info Collection as site configuration", () => {
		const nested = {
			...resources,
			"source/root/info": { ...resources["source/root/info"], behavior: [] },
			"source/root/topics/info": {
				...resources["source/root/topics/info"],
				behavior: ["static-site-info"],
			},
		};
		expect(() => findSiteResources(nested, descriptors)).toThrow(
			"no marked direct",
		);
	});

	it("rejects more than one marked direct info Collection", () => {
		const duplicateResources = {
			...resources,
			"other/root": {
				id: "https://other.test/root",
				type: "Collection" as const,
				"hss:slug": "other/root",
			},
			"other/root/info": {
				...info,
				id: "https://other.test/root/info",
				"hss:slug": "other/root/info",
			},
		};
		const duplicateDescriptors = {
			...descriptors,
			"other/root": {
				id: "https://other.test/root",
				type: "Collection" as const,
				origin: "source" as const,
				"hss:slug": "other/root",
			},
			"other/root/info": {
				id: "https://other.test/root/info",
				type: "Collection" as const,
				origin: "source" as const,
				parents: ["other/root"],
				"hss:slug": "other/root/info",
			},
		};
		expect(() =>
			findSiteResources(duplicateResources, duplicateDescriptors),
		).toThrow("more than one marked direct");
	});

	it("indexes public IDs while preserving opaque HSS slugs and exact info hiding", () => {
		expect(
			entriesFromResources(rootUrl, resources).map((entry) => [
				entry.path,
				entry.hssSlug,
			]),
		).toContainEqual(["folder/show", "source/root/folder/show"]);
		const site = index();
		expect(site.entriesByPath.has("info")).toBe(false);
		expect(site.entriesByPath.has("topics/info")).toBe(true);
		expect(site.entriesByPath.get("folder/show")?.isExhibition).toBe(true);
		expect(site.entriesByPath.get("folder/show")?.thumbnail?.[0]?.id).toBe(
			"https://images.test/show.jpg",
		);
		expect(
			site.entriesByPath.get("folder/show")?.requiredStatement?.value?.en?.[0],
		).toBe("Example archive");
		expect(site.entriesByPath.get("folder/show")?.rights).toBe(
			"https://creativecommons.org/licenses/by/4.0/",
		);
		expect(
			site.entriesByPath.get("folder/show")?.rendering?.[0]?.label?.en?.[0],
		).toBe("Download PDF");
		expect(site.repository).toBe("https://github.com/example/site");
	});

	it("allows a source exhibitions Collection", () => {
		const site = createSiteIndex({
			rootUrl,
			defaultLanguage: "en",
			resources: {
				...resources,
				exhibitions: {
					id: `${rootUrl}/exhibitions`,
					type: "Collection",
					"hss:slug": "source/root/exhibitions",
				},
			},
			info,
			routeService,
			exhibitionsCollection: { id: "ex", type: "Collection", items: [] },
		});
		expect(site.entriesByPath.get("exhibitions")?.type).toBe("Collection");
	});

	it("fails duplicate, reserved, and route-service source paths clearly", () => {
		const duplicated = {
			...resources,
			duplicate: {
				...resources["source/root/folder/show"],
				"hss:slug": "duplicate",
			},
		};
		expect(() =>
			createSiteIndex({
				rootUrl,
				defaultLanguage: "en",
				resources: duplicated,
				info,
				routeService,
				exhibitionsCollection: { id: "ex", type: "Collection", items: [] },
			}),
		).toThrow("Duplicate route path");
		expect(() =>
			createSiteIndex({
				rootUrl,
				defaultLanguage: "en",
				resources: {
					...resources,
					reserved: {
						id: `${rootUrl}/collections/item`,
						type: "Manifest",
						"hss:slug": "reserved",
					},
				},
				info,
				routeService,
				exhibitionsCollection: { id: "ex", type: "Collection", items: [] },
			}),
		).toThrow("Reserved route path collision");
		expect(() =>
			createSiteIndex({
				rootUrl,
				defaultLanguage: "en",
				resources,
				info,
				routeService: { ...routeService, source: "https://remote.test/other" },
				exhibitionsCollection: { id: "ex", type: "Collection", items: [] },
			}),
		).toThrow("source does not match");
	});

	it("loads only public local artifacts for the root index", async () => {
		const fetchFn = mockFetch(indexArtifacts());
		await createSiteData({ baseUrl, fetchFn }).loadIndex();
		expect(
			vi
				.mocked(fetchFn)
				.mock.calls.some(([url]) =>
					url.toString().startsWith("https://remote.test"),
				),
		).toBe(false);
		expect(
			vi
				.mocked(fetchFn)
				.mock.calls.some(([url]) => url.toString().includes("config/stores")),
		).toBe(false);
	});

	it("validates homepage, deployment base path, and HSS canonical base", async () => {
		await expect(
			createSiteData({
				baseUrl,
				fetchFn: mockFetch(indexArtifacts()),
				expectedBasePath: "/wrong/",
			}).loadIndex(),
		).rejects.toThrow("SITE_BASE_PATH");
		const badInfo = {
			...info,
			homepage: [{ id: "https://other.test/", format: "text/html" }],
		};
		await expect(
			createSiteData({
				baseUrl,
				fetchFn: mockFetch({
					...indexArtifacts(),
					[`${baseUrl}iiif/source/root/info/meta.json`]: {
						"site:info": badInfo,
					},
				}),
			}).loadIndex(),
		).rejects.toThrow("homepage does not match");
	});
});

describe("shallow page loading", () => {
	it("homepage loads only the root Collection", async () => {
		const fetchFn = mockFetch({
			[`${baseUrl}iiif/source/root/meta.json`]: {
				"hss:runtime": {
					type: "Collection",
					source: { type: "remote", url: rootUrl },
					saveToDisk: false,
				},
			},
			[rootUrl]: {
				id: rootUrl,
				type: "Collection",
				items: [
					{
						id: `${rootUrl}/folder`,
						type: "Collection",
						label: { en: ["Folder"] },
					},
				],
			},
		});
		const page = await createSiteData({ baseUrl, fetchFn }).loadHome(index());
		expect(page.children?.map((entry) => entry.path)).toEqual(["folder"]);
		expect(
			vi
				.mocked(fetchFn)
				.mock.calls.map(([url]) => url.toString())
				.filter((url) => url.startsWith("https://remote.test")),
		).toEqual([rootUrl]);
	});

	it("known routes use meta.json and load only their remote source", async () => {
		const fetchFn = mockFetch({
			[`${baseUrl}iiif/source/root/folder/meta.json`]: {
				"hss:runtime": {
					type: "Collection",
					source: { type: "remote", url: `${rootUrl}/folder` },
					saveToDisk: false,
				},
			},
			[`${rootUrl}/folder`]: {
				id: `${rootUrl}/folder`,
				type: "Collection",
				items: [{ id: `${rootUrl}/folder/show`, type: "Manifest" }],
			},
		});
		const page = await createSiteData({ baseUrl, fetchFn }).loadResource(
			index(),
			"folder",
		);
		expect(page?.jsonUrl).toBe(`${rootUrl}/folder`);
		expect(page?.children).toHaveLength(1);
	});

	it("enriches a build-known entry with live Manifest presentation fields", async () => {
		const manifestUrl = `${rootUrl}/folder/show`;
		const fetchFn = mockFetch({
			[`${baseUrl}iiif/source/root/folder/show/meta.json`]: {
				"hss:runtime": {
					type: "Manifest",
					source: { type: "remote", url: manifestUrl },
					saveToDisk: false,
				},
			},
			[manifestUrl]: {
				id: manifestUrl,
				type: "Manifest",
				requiredStatement: {
					label: { en: ["Attribution"] },
					value: { en: ["Live archive"] },
				},
				rights: "https://rights.test/live",
				rendering: [
					{ id: "https://files.test/live.pdf", label: { en: ["Live PDF"] } },
				],
				items: [],
			},
		});
		const page = await createSiteData({ baseUrl, fetchFn }).loadResource(
			index(),
			"folder/show",
		);
		expect(page?.entry.requiredStatement?.value?.en?.[0]).toBe("Live archive");
		expect(page?.entry.rights).toBe("https://rights.test/live");
		expect(page?.entry.rendering?.[0]?.label?.en?.[0]).toBe("Live PDF");
	});

	it("falls back directly for a post-build root-relative resource", async () => {
		const url = `${rootUrl}/new-show`;
		const fetchFn = mockFetch({
			[url]: { id: url, type: "Manifest", behavior: ["exhibition"] },
		});
		const page = await createSiteData({ baseUrl, fetchFn }).loadResource(
			index(),
			"new-show",
		);
		expect(page?.entry.isExhibition).toBe(true);
		expect(vi.mocked(fetchFn)).toHaveBeenCalledTimes(1);
	});

	it("uses bounded ancestor traversal for a non-root-relative child", async () => {
		const externalFolder = "https://external.test/folder";
		const externalShow = "https://external.test/show";
		const fetchFn = mockFetch({
			[`${baseUrl}iiif/source/root/meta.json`]: {
				"hss:runtime": {
					type: "Collection",
					source: { type: "remote", url: rootUrl },
					saveToDisk: false,
				},
			},
			[rootUrl]: {
				id: rootUrl,
				type: "Collection",
				items: [{ id: externalFolder, type: "Collection" }],
			},
			[externalFolder]: {
				id: externalFolder,
				type: "Collection",
				items: [{ id: externalShow, type: "Manifest" }],
			},
			[externalShow]: { id: externalShow, type: "Manifest" },
		});
		const site = index();
		site.entriesByPath.delete("folder");
		site.entriesByPath.delete("folder/show");
		const page = await createSiteData({ baseUrl, fetchFn }).loadResource(
			site,
			"folder/show",
		);
		expect(page?.entry.id).toBe(externalShow);
		expect(page?.breadcrumbs.map((entry) => entry.path)).toEqual([
			"",
			"folder",
			"folder/show",
		]);
	});

	it("loads local Featured and Exhibitions without remote Manifests", async () => {
		const fetchFn = mockFetch({
			[`${baseUrl}iiif/collections/exhibitions/collection.json`]: {
				id: "ex",
				type: "Collection",
				items: [],
			},
			[`${baseUrl}iiif/collections/featured/collection.json`]: {
				id: "featured",
				type: "Collection",
				items: [
					{
						id: `${rootUrl}/folder/show`,
						type: "Manifest",
						label: { en: ["Featured show"] },
					},
				],
			},
		});
		expect(
			await createSiteData({ baseUrl, fetchFn }).loadExhibitions(index()),
		).toHaveLength(1);
		expect(
			(await createSiteData({ baseUrl, fetchFn }).loadFeatured(index())).map(
				(entry) => entry.path,
			),
		).toEqual(["folder/show"]);
		expect(
			vi
				.mocked(fetchFn)
				.mock.calls.some(([url]) =>
					url.toString().startsWith("https://remote.test"),
				),
		).toBe(false);
	});
});
