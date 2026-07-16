// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResourcePageData, SiteIndexEntry } from "#/lib/site-data";
import { ExhibitionViewer } from "./exhibition";
import { canvasDownload, ManifestPage } from "./manifest";
import { Cards, CollectionPage, externalViewerLinks, Header } from "./site";

vi.mock("react-iiif-vault", () => ({
	LanguageProvider: ({ children }: { children: ReactNode }) => children,
	SimpleViewerProvider: ({
		children,
		manifest,
	}: {
		children: ReactNode;
		manifest: string;
	}) => (
		<div data-testid="simple-viewer" data-manifest={manifest}>
			{children}
		</div>
	),
	ManifestMetadata: () => <table data-testid="manifest-metadata" />,
	SequenceThumbnails: () => <div data-testid="sequence-thumbnails" />,
	useSimpleViewer: () => ({
		sequence: [[0], [1]],
		currentSequenceIndex: 0,
		items: [{ id: "canvas-1" }, { id: "canvas-2" }],
		hasPrevious: false,
		hasNext: true,
		previousCanvas: vi.fn(),
		nextCanvas: vi.fn(),
	}),
}));

vi.mock("react-iiif-vault/canvas-panel", () => ({
	CanvasPanel: {
		Viewer: ({ children }: { children: ReactNode }) => (
			<div data-testid="canvas-panel">{children}</div>
		),
		RenderCanvas: () => <div data-testid="render-canvas" />,
	},
}));

vi.mock("exhibition-viewer/library", () => ({
	DelftExhibition: () => <div data-testid="fullpage" />,
	DelftPresentation: () => <div data-testid="slideshow" />,
	ScrollExhibition: () => <div data-testid="scroll" />,
}));

afterEach(cleanup);

function renderWithRouter(node: ReactNode, path = "/") {
	const root = createRootRoute({ component: () => node });
	const hierarchy = createRoute({
		getParentRoute: () => root,
		path: "$",
	});
	const collections = createRoute({
		getParentRoute: () => root,
		path: "collections",
	});
	const router = createRouter({
		routeTree: root.addChildren([hierarchy, collections]),
		history: createMemoryHistory({ initialEntries: [path] }),
	});
	return render(<RouterProvider router={router} />);
}

const manifestEntry: SiteIndexEntry = {
	id: "https://iiif.test/manifest",
	type: "Manifest",
	path: "manifest",
	label: { en: ["Object"] },
	isExhibition: false,
};

const entries: SiteIndexEntry[] = [
	{
		id: "https://iiif.test/folder",
		type: "Collection",
		path: "folder",
		label: { en: ["Folder"] },
		isExhibition: false,
	},
	{
		id: "https://iiif.test/exhibition",
		type: "Manifest",
		path: "exhibition",
		label: { en: ["Show"] },
		thumbnail: [{ id: "https://images.test/show.jpg" }],
		isExhibition: true,
	},
	manifestEntry,
];

describe("site components", () => {
	it("labels Collections, Exhibitions, and ordinary Manifests", async () => {
		const { container } = renderWithRouter(
			<Cards entries={entries} language="en" />,
		);
		expect(await screen.findByText("Collection")).toBeTruthy();
		expect(screen.getByText("Exhibition")).toBeTruthy();
		expect(screen.getByText("Manifest")).toBeTruthy();
		expect(
			container.querySelector(".card-thumbnail img")?.getAttribute("src"),
		).toBe("https://images.test/show.jpg");
	});

	it("exposes Home and Exhibitions navigation with active state", async () => {
		renderWithRouter(
			<Header
				name="Site"
				logo="https://images.test/logo.svg"
				repository="https://github.com/example/site"
				exhibitionsPath="exhibitions"
			/>,
			"/exhibitions",
		);
		const navigation = await screen.findByRole("navigation", {
			name: "Primary",
		});
		expect(navigation.textContent).toContain("Home");
		expect(navigation.textContent).toContain("Collections");
		expect(navigation.textContent).toContain("Exhibitions");
		expect(
			screen
				.getByRole("link", { name: "Exhibitions" })
				.getAttribute("aria-current"),
		).toBe("page");
		expect(
			screen.getByRole("link", { name: "Source on GitHub" }),
		).toHaveProperty("href", "https://github.com/example/site");
		expect(screen.getByAltText("Site logo")).toHaveProperty(
			"src",
			"https://images.test/logo.svg",
		);
	});

	it("hides Exhibitions navigation without a source Collection", async () => {
		renderWithRouter(<Header name="Site" />);
		expect(
			await screen.findByRole("navigation", { name: "Primary" }),
		).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Exhibitions" })).toBeNull();
	});

	it("renders multi-canvas controls, metadata, and a safe image download", async () => {
		const entry = {
			...manifestEntry,
			requiredStatement: {
				label: { en: ["Credit"] },
				value: { en: ["Example archive"] },
			},
			rights: "https://creativecommons.org/licenses/by/4.0/",
		};
		const page: ResourcePageData = {
			entry,
			resource: {
				...entry,
				type: "Manifest",
				items: [
					{
						id: "canvas-1",
						items: [
							{
								items: [
									{
										motivation: "painting",
										body: {
											id: "https://images.test/full.jpg",
											type: "Image",
											width: 1200,
											height: 800,
										},
									},
								],
							},
						],
					},
					{ id: "canvas-2" },
				],
			},
			jsonUrl: entry.id,
			breadcrumbs: [entry],
		};
		render(<ManifestPage page={page} language="en" />);
		expect(
			(await screen.findByTestId("simple-viewer")).getAttribute(
				"data-manifest",
			),
		).toBe(entry.id);
		expect(screen.getByRole("application")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Previous canvas" }),
		).toHaveProperty("disabled", true);
		expect(screen.getByText("Canvas 1 of 2")).toBeTruthy();
		expect(screen.getByTestId("sequence-thumbnails")).toBeTruthy();
		expect(screen.getByTestId("manifest-metadata")).toBeTruthy();
		expect(screen.getByText("Example archive")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "Full image (1200 × 800)" }),
		).toHaveProperty("href", "https://images.test/full.jpg");
	});

	it("shows a clear no-canvas state", () => {
		render(
			<ManifestPage
				page={{
					entry: manifestEntry,
					resource: { ...manifestEntry, type: "Manifest", items: [] },
					jsonUrl: manifestEntry.id,
					breadcrumbs: [manifestEntry],
				}}
				language="en"
			/>,
		);
		expect(
			screen.getByText("This Manifest has no canvases to display."),
		).toBeTruthy();
		expect(screen.queryByTestId("simple-viewer")).toBeNull();
	});

	it("keeps unavailable Manifest context without mounting CanvasPanel", () => {
		const entry = manifestEntry;
		render(
			<ManifestPage
				page={{ entry, breadcrumbs: [entry], unavailable: "Offline" }}
				language="en"
			/>,
		);
		expect(screen.getByRole("heading", { name: "Object" })).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toContain("build-known");
		expect(screen.queryByTestId("canvas-panel")).toBeNull();
	});

	it("reports copy success without changing the action label", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		render(
			<ManifestPage
				page={{
					entry: manifestEntry,
					resource: { ...manifestEntry, type: "Manifest", items: [] },
					breadcrumbs: [manifestEntry],
				}}
				language="en"
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Copy page URL" }));
		expect(await screen.findByText("Page URL copied")).toBeTruthy();
		expect(writeText).toHaveBeenCalledWith(window.location.href);
	});

	it("keeps unavailable Collection page context", () => {
		const entry = entries[0];
		if (!entry) throw new Error("Collection fixture is missing");
		render(
			<CollectionPage
				page={{ entry, breadcrumbs: [entry], unavailable: "Offline" }}
				language="en"
			/>,
		);
		expect(screen.getByRole("heading", { name: "Folder" })).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toContain("unavailable");
	});

	it("selects the existing exhibition viewer presets", () => {
		const { rerender } = render(
			<ExhibitionViewer
				manifest={{
					id: "show",
					type: "Manifest",
					behavior: ["exhibition", "slideshow", "scroll"],
				}}
				language="en"
			/>,
		);
		expect(screen.getByTestId("slideshow")).toBeTruthy();
		rerender(
			<ExhibitionViewer
				manifest={{
					id: "show",
					type: "Manifest",
					behavior: ["exhibition", "scroll"],
				}}
				language="en"
			/>,
		);
		expect(screen.getByTestId("scroll")).toBeTruthy();
	});
});

describe("Manifest helpers", () => {
	it("resolves Image API 3, legacy Image API 2, and direct image bodies", () => {
		const canvas = (body: unknown, motivation: unknown = "painting") => ({
			items: [{ items: [{ motivation, body }] }],
		});
		expect(
			canvasDownload(
				canvas({
					type: "Image",
					service: { id: "https://images.test/v3", type: "ImageService3" },
				}),
			)?.url,
		).toBe("https://images.test/v3/full/max/0/default.jpg");
		expect(
			canvasDownload(
				canvas({
					format: "image/jpeg",
					service: {
						"@id": "https://images.test/v2/",
						"@type": "ImageService2",
					},
				}),
			)?.url,
		).toBe("https://images.test/v2/full/full/0/default.jpg");
		expect(
			canvasDownload(
				canvas(
					[{ id: "https://images.test/direct.jpg", type: "Image" }],
					["painting"],
				),
			)?.url,
		).toBe("https://images.test/direct.jpg");
	});

	it("rejects unsafe, non-image, and non-painting downloads", () => {
		const canvas = (annotation: unknown) => ({
			items: [{ items: [annotation] }],
		});
		expect(
			canvasDownload(
				canvas({
					motivation: "painting",
					body: { type: "Image", id: "https://user:secret@images.test/a" },
				}),
			),
		).toBeUndefined();
		expect(
			canvasDownload(
				canvas({
					motivation: "commenting",
					body: { type: "Image", id: "https://images.test/a" },
				}),
			),
		).toBeUndefined();
		expect(
			canvasDownload(
				canvas({
					motivation: "painting",
					body: { type: "Text", id: "https://images.test/a" },
				}),
			),
		).toBeUndefined();
	});

	it("builds external viewer URLs without double encoding", () => {
		const manifest = "https://iiif.test/manifest/a%20b";
		const links = externalViewerLinks(manifest);
		expect(new URL(links[0]?.href || "").searchParams.get("iiif-content")).toBe(
			manifest,
		);
		expect(new URL(links[1]?.href || "").searchParams.get("iiif-content")).toBe(
			manifest,
		);
		expect(
			new URLSearchParams(new URL(links[2]?.href || "").hash.slice(2)).get(
				"manifest",
			),
		).toBe(manifest);
		expect(externalViewerLinks("javascript:alert(1)")).toEqual([]);
	});
});
