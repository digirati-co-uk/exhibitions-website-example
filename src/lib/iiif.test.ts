import { describe, expect, it } from "vitest";
import {
	findGithubRepository,
	findRouteService,
	findSiteHomepage,
	GITHUB_PROFILE,
	imageId,
	isExhibition,
	isReservedPath,
	mapResourceToSite,
	pathSegment,
	remoteUrl,
	STATIC_SITE_ROUTE_PROFILE,
	type StaticSiteRouteService,
	sourcePath,
	text,
	viewerType,
} from "./iiif";

const routeService = {
	id: "https://example.github.io/exhibitions/",
	type: "Service" as const,
	profile: STATIC_SITE_ROUTE_PROFILE,
	source: "https://iiif.example/58/my-site/",
} satisfies StaticSiteRouteService;

describe("IIIF presentation helpers", () => {
	it("selects international strings with predictable fallbacks", () => {
		expect(text({ en: ["English"], nl: ["Nederlands"] }, "nl")).toBe(
			"Nederlands",
		);
		expect(text({ none: ["Neutral"] }, "fr")).toBe("Neutral");
		expect(text({ de: ["Deutsch"] }, "fr")).toBe("Deutsch");
		expect(text(undefined)).toBe("");
		expect(imageId({ thumbnail: [{ id: "image.jpg" }] }, "thumbnail")).toBe(
			"image.jpg",
		);
	});

	it("requires the exact exhibition behavior", () => {
		expect(isExhibition(["exhibition"])).toBe(true);
		expect(isExhibition(["scroll", "exhibition"])).toBe(true);
		expect(isExhibition(["Exhibition"])).toBe(false);
		expect(isExhibition(["exhibition-page"])).toBe(false);
		expect(isExhibition(undefined)).toBe(false);
	});

	it("prioritizes slideshow, then scroll, then the full-page viewer", () => {
		expect(viewerType(["scroll", "slideshow"])).toBe("slideshow");
		expect(viewerType(["scroll"])).toBe("scroll");
		expect(viewerType(["fullpage"])).toBe("exhibition");
	});

	it("maps root-relative resource URLs and reserves application paths", () => {
		const root = "https://example.org/iiif/root";
		expect(sourcePath(root, root)).toBe("");
		expect(sourcePath(root, `${root}/folder/a%20show`)).toBe("folder/a show");
		expect(sourcePath(root, "https://elsewhere.test/show")).toBeUndefined();
		expect(remoteUrl(root, "folder/a show")).toBe(`${root}/folder/a%20show`);
		expect(pathSegment("https://example.org/folder/a%20show?x=1")).toBe(
			"a show",
		);
		expect(isReservedPath("info")).toBe(true);
		expect(isReservedPath("exhibitions/new")).toBe(false);
		expect(isReservedPath("collections")).toBe(true);
		expect(isReservedPath("folder/info")).toBe(false);
	});

	it("selects the portal-owned homepage, repository, and route service", () => {
		const unrelated = { id: "https://example.org/other", type: "Text" };
		const info = {
			service: [
				{ id: "https://example.org/search", profile: "search" },
				routeService,
			],
			homepage: [
				{ ...unrelated, format: "text/html" },
				{
					id: routeService.id,
					type: "Text",
					format: "text/html",
					label: { en: ["Visit the site"] },
				},
			],
			seeAlso: [
				unrelated,
				{
					id: "https://github.com/example/site",
					profile: GITHUB_PROFILE,
				},
			],
		};
		expect(findRouteService(info)).toMatchObject(routeService);
		expect(findSiteHomepage(info)?.id).toBe(routeService.id);
		expect(findGithubRepository(info)?.id).toBe(
			"https://github.com/example/site",
		);
	});

	it("rejects ambiguous or invalid route services", () => {
		expect(() =>
			findRouteService({ service: [routeService, routeService] }),
		).toThrow("more than one");
		expect(() =>
			findRouteService({ service: [{ ...routeService, source: "ftp://bad" }] }),
		).toThrow("invalid");
	});

	it("maps source IDs to the same project paths as the portal", () => {
		expect(
			mapResourceToSite(
				routeService,
				"https://iiif.example/58/my-site",
			)?.toString(),
		).toBe(routeService.id);
		expect(
			mapResourceToSite(
				routeService,
				"https://iiif.example/58/my-site/folder/a%20show",
			)?.toString(),
		).toBe("https://example.github.io/exhibitions/folder/a%20show/");
	});

	it("rejects lookalike, unrelated, and credential-bearing route IDs", () => {
		expect(
			mapResourceToSite(routeService, "https://iiif.example/58/my-site-2/item"),
		).toBeNull();
		expect(
			mapResourceToSite(routeService, "https://other.example/58/my-site"),
		).toBeNull();
		expect(
			mapResourceToSite(
				routeService,
				"https://user:secret@iiif.example/58/my-site",
			),
		).toBeNull();
	});
});
