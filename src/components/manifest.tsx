import { ClientOnly } from "@tanstack/react-router";
import { CanvasPanel } from "react-iiif-vault/canvas-panel";
import { text } from "#/lib/iiif";
import type { ResourcePageData } from "#/lib/site-data";
import { Breadcrumbs, Metadata } from "./site";

export function ManifestPage({
	page,
	language,
}: {
	page: ResourcePageData;
	language: string;
}) {
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
			{page.unavailable || !page.jsonUrl ? (
				<p className="empty" role="alert">
					This manifest is currently unavailable. Try again later.
				</p>
			) : (
				<div className="canvas-panel">
					<ClientOnly
						fallback={<p className="viewer-loading">Loading viewer…</p>}
					>
						<CanvasPanel manifest={page.jsonUrl} height={720} />
					</ClientOnly>
				</div>
			)}
			<Metadata resource={page.entry} language={language} />
		</main>
	);
}
