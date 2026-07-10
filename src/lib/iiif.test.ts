import { afterEach, describe, expect, it, vi } from "vitest";
import {
	findNode,
	imageId,
	loadSite,
	slugFromId,
	text,
	validateConfig,
	viewerType,
} from "./iiif";

afterEach(() => vi.unstubAllGlobals());

describe("IIIF helpers", () => {
	it("selects language and fallbacks", () => {
		expect(text({ en: ["English"], nl: ["Nederlands"] }, "nl")).toBe(
			"Nederlands",
		);
		expect(text({ none: ["Neutral"] }, "fr")).toBe("Neutral");
		expect(text(undefined)).toBe("");
		expect(imageId({ thumbnail: [{ id: "image.jpg" }] }, "thumbnail")).toBe(
			"image.jpg",
		);
	});

	it("normalizes slugs and viewer behaviors", () => {
		expect(slugFromId("https://example.org/A%20Great_Show/?v=1")).toBe(
			"a-great-show",
		);
		expect(viewerType(["slideshow"])).toBe("slideshow");
		expect(viewerType(["scroll"])).toBe("scroll");
		expect(viewerType(["fullpage"])).toBe("exhibition");
	});

	it("validates configuration", () => {
		expect(validateConfig({ collection: "https://example.org/root" })).toEqual({
			collection: "https://example.org/root",
			defaultLanguage: "en",
		});
		expect(() => validateConfig({ collection: "/root" })).toThrow(
			"absolute URL",
		);
	});
});

describe("collection traversal", () => {
	it("builds nested routes, excludes info, and tolerates a failed child collection", async () => {
		const resources: Record<string, unknown> = {
			"https://site/config.json": { collection: "https://iiif/root" },
			"https://iiif/root": {
				id: "https://iiif/root",
				type: "Collection",
				items: [
					{ id: "https://iiif/root/info", type: "Collection" },
					{ id: "https://iiif/group", type: "Collection" },
					{ id: "https://iiif/broken", type: "Collection" },
					{ id: "https://iiif/ignored", type: "Canvas" },
				],
			},
			"https://iiif/root/info": {
				id: "https://iiif/root/info",
				type: "Collection",
				label: { en: ["Site"] },
				items: [],
			},
			"https://iiif/group": {
				id: "https://iiif/group",
				type: "Collection",
				items: [{ id: "https://iiif/show", type: "Manifest" }],
			},
			"https://iiif/show": {
				id: "https://iiif/show",
				type: "Manifest",
				label: { en: ["Show"] },
				items: [],
			},
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: string) =>
				resources[url]
					? new Response(JSON.stringify(resources[url]))
					: new Response("", { status: 503 }),
			),
		);
		const site = await loadSite("https://site/config.json");
		expect(site.root.children.map((node) => node.path)).toEqual([
			"group",
			"broken",
		]);
		expect(findNode(site.root, "group/show")?.resource.type).toBe("Manifest");
		expect(findNode(site.root, "broken")?.error).toContain("503");
	});

	it("rejects duplicate sibling slugs", async () => {
		const resources: Record<string, unknown> = {
			config: { collection: "https://iiif/root" },
			"https://iiif/root": {
				id: "https://iiif/root",
				type: "Collection",
				items: [
					{ id: "https://iiif/root/info", type: "Collection" },
					{ id: "https://one/same", type: "Manifest" },
					{ id: "https://two/same", type: "Manifest" },
				],
			},
			"https://iiif/root/info": {
				id: "https://iiif/root/info",
				type: "Collection",
				items: [],
			},
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async (url: string) => new Response(JSON.stringify(resources[url])),
			),
		);
		await expect(loadSite("config")).rejects.toThrow("duplicate sibling slug");
	});

	it("normalizes omitted annotation bodies for viewers", async () => {
		const resources: Record<string, unknown> = {
			config: { collection: "https://iiif/root" },
			"https://iiif/root": {
				id: "https://iiif/root",
				type: "Collection",
				items: [
					{ id: "https://iiif/root/info", type: "Collection" },
					{ id: "https://iiif/show", type: "Manifest" },
				],
			},
			"https://iiif/root/info": {
				id: "https://iiif/root/info",
				type: "Collection",
			},
			"https://iiif/show": {
				id: "https://iiif/show",
				type: "Manifest",
				items: [{ type: "Annotation", id: "a" }],
			},
		};
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async (url: string) => new Response(JSON.stringify(resources[url])),
			),
		);
		const site = await loadSite("config");
		const annotation = (
			findNode(site.root, "show")?.resource as {
				items: Array<{ body?: unknown[] }>;
			}
		).items[0];
		expect(annotation.body).toEqual([]);
	});
});
