import { ClientOnly } from "@tanstack/react-router";
import {
	LanguageProvider,
	ManifestMetadata,
	SequenceThumbnails,
	SimpleViewerProvider,
	useSimpleViewer,
} from "react-iiif-vault";
import { CanvasPanel } from "react-iiif-vault/canvas-panel";
import { safeHttpUrl, text } from "#/lib/iiif";
import type { ResourcePageData } from "#/lib/site-data";
import {
	Breadcrumbs,
	Metadata,
	RequiredStatement,
	ResourceActions,
} from "./site";

type AnyRecord = Record<string, unknown>;

function values(value: unknown) {
	return Array.isArray(value) ? value : value ? [value] : [];
}

function isPainting(value: unknown) {
	return (
		value === "painting" || (Array.isArray(value) && value.includes("painting"))
	);
}

export function canvasDownload(canvas: unknown) {
	if (!canvas || typeof canvas !== "object") return;
	for (const page of values((canvas as AnyRecord).items)) {
		if (!page || typeof page !== "object") continue;
		for (const annotation of values((page as AnyRecord).items)) {
			if (!annotation || typeof annotation !== "object") continue;
			const painting = annotation as AnyRecord;
			if (!isPainting(painting.motivation)) continue;
			for (const body of values(painting.body)) {
				if (!body || typeof body !== "object") continue;
				const image = body as AnyRecord;
				if (
					image.type !== "Image" &&
					!(
						typeof image.format === "string" &&
						image.format.startsWith("image/")
					)
				)
					continue;
				const dimensions =
					typeof image.width === "number" && typeof image.height === "number"
						? ` (${image.width} × ${image.height})`
						: "";
				for (const candidate of values(image.service)) {
					if (!candidate || typeof candidate !== "object") continue;
					const service = candidate as AnyRecord;
					const id =
						typeof service.id === "string"
							? service.id
							: typeof service["@id"] === "string"
								? service["@id"]
								: "";
					const url = safeHttpUrl(id);
					if (!url) continue;
					const type = service.type || service["@type"];
					url.pathname = `${url.pathname.replace(/\/+$/, "")}/full/${type === "ImageService3" ? "max" : "full"}/0/default.jpg`;
					url.search = "";
					url.hash = "";
					return { url: url.toString(), dimensions };
				}
				if (typeof image.id === "string") {
					const url = safeHttpUrl(image.id);
					if (url) return { url: url.toString(), dimensions };
				}
			}
		}
	}
}

function Viewer() {
	const state = useSimpleViewer();
	return (
		<>
			<div
				className="canvas-panel"
				role="application"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: the viewer handles keyboard pan and zoom
				tabIndex={0}
				aria-label="IIIF canvas viewer"
			>
				<CanvasPanel.Viewer height="100%" width="100%">
					<CanvasPanel.RenderCanvas />
				</CanvasPanel.Viewer>
			</div>
			<div className="canvas-controls">
				<button
					type="button"
					aria-label="Previous canvas"
					disabled={!state.hasPrevious}
					onClick={state.previousCanvas}
				>
					Previous
				</button>
				<span>
					Canvas {state.currentSequenceIndex + 1} of {state.sequence.length}
				</span>
				<button
					type="button"
					aria-label="Next canvas"
					disabled={!state.hasNext}
					onClick={state.nextCanvas}
				>
					Next
				</button>
			</div>
			{state.sequence.length > 1 ? (
				<SequenceThumbnails
					classes={{
						container: "sequence-thumbnails",
						item: "sequence-thumbnail",
						selected: { item: "sequence-thumbnail selected" },
					}}
				/>
			) : null}
			<ManifestMetadata
				allowHtml={false}
				showEmptyMessage={false}
				classes={{ container: "vault-metadata" }}
			/>
		</>
	);
}

export function ManifestPage({
	page,
	language,
}: {
	page: ResourcePageData;
	language: string;
}) {
	const manifest =
		page.resource?.type === "Manifest" ? page.resource : undefined;
	const hasCanvases = Boolean(
		manifest && Array.isArray(manifest.items) && manifest.items.length,
	);
	return (
		<main id="main" className="page manifest-page">
			<Breadcrumbs entries={page.breadcrumbs} language={language} />
			<section className="hero">
				<span className="eyebrow">Manifest</span>
				<h1>{text(page.entry.label, language) || "Untitled manifest"}</h1>
				{text(page.entry.summary, language) ? (
					<p>{text(page.entry.summary, language)}</p>
				) : null}
			</section>
			<RequiredStatement entry={page.entry} language={language} />
			{page.unavailable ? (
				<div className="empty" role="alert">
					<p>
						This manifest is currently unavailable. Showing build-known content.
					</p>
				</div>
			) : null}
			{hasCanvases && page.jsonUrl ? (
				<ClientOnly
					fallback={<p className="viewer-loading">Loading viewer…</p>}
				>
					<LanguageProvider language={language}>
						<SimpleViewerProvider manifest={page.jsonUrl}>
							<Viewer />
						</SimpleViewerProvider>
					</LanguageProvider>
				</ClientOnly>
			) : manifest ? (
				<p className="empty">This Manifest has no canvases to display.</p>
			) : null}
			<Metadata
				resource={page.entry}
				language={language}
				includeMetadata={false}
			/>
			<ResourceActions entry={page.entry} />
		</main>
	);
}
