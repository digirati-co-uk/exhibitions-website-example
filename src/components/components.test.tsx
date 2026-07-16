// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResourcePageData, SiteIndexEntry } from "#/lib/site-data";
import { ExhibitionViewer } from "./exhibition";
import { ManifestPage } from "./manifest";
import { Cards, CollectionPage, Header } from "./site";

vi.mock("react-iiif-vault/canvas-panel", () => ({
	CanvasPanel: ({ manifest }: { manifest: string }) => (
		<div data-testid="canvas-panel" data-manifest={manifest} />
	),
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

	it("renders CanvasPanel with the resolved remote Manifest URL", async () => {
		const entry = manifestEntry;
		const page: ResourcePageData = {
			entry,
			resource: { ...entry, type: "Manifest" },
			jsonUrl: entry.id,
			breadcrumbs: [entry],
		};
		render(<ManifestPage page={page} language="en" />);
		expect(
			(await screen.findByTestId("canvas-panel")).getAttribute("data-manifest"),
		).toBe(entry.id);
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
		expect(screen.queryByTestId("canvas-panel")).toBeNull();
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
