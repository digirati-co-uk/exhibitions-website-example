import { createFileRoute, notFound } from "@tanstack/react-router";
import { ExhibitionViewer } from "#/components/exhibition";
import { Breadcrumbs, Cards, Metadata } from "#/components/site";
import {
	findNode,
	type IIIFManifest,
	imageId,
	type SiteData,
	text,
} from "#/lib/iiif";
import { siteQuery } from "#/lib/queries";

export const Route = createFileRoute("/$")({
	loader: async ({ context, params }) => {
		const site = await context.queryClient.fetchQuery(
			siteQuery(context.configUrl),
		);
		const node = findNode(site.root, params._splat || "");
		if (!node) throw notFound();
		return node;
	},
	head: ({ loaderData, match }) => {
		if (!loaderData) return {};
		const site = match.context.queryClient.getQueryData<SiteData>([
			"site",
			match.context.configUrl,
		]);
		if (!site) return {};
		const language = site.config.defaultLanguage;
		const title = text(loaderData.resource.label, language) || "Untitled";
		const siteTitle = text(site.info.label, language) || "Exhibitions";
		const description =
			text(loaderData.resource.summary, language) ||
			text(site.info.summary, language);
		const image =
			imageId(loaderData.resource, "thumbnail") || imageId(site.info, "logo");
		const canonical = import.meta.env.VITE_SITE_URL
			? new URL(
					`${import.meta.env.BASE_URL}${loaderData.path}`,
					import.meta.env.VITE_SITE_URL,
				).toString()
			: undefined;
		return {
			meta: [
				{ title: `${title} | ${siteTitle}` },
				{ name: "description", content: description },
				{ property: "og:title", content: title },
				{ property: "og:description", content: description },
				{
					property: "og:type",
					content:
						loaderData.resource.type === "Manifest" ? "article" : "website",
				},
				...(image ? [{ property: "og:image", content: image }] : []),
			],
			links: canonical ? [{ rel: "canonical", href: canonical }] : [],
		};
	},
	component: ResourcePage,
});

function ResourcePage() {
	const node = Route.useLoaderData();
	const site = Route.useRouteContext().queryClient.getQueryData<SiteData>([
		"site",
		Route.useRouteContext().configUrl,
	]);
	if (!site) throw new Error("Site data is unavailable");
	const language = site.config.defaultLanguage;
	if (node.resource.type === "Manifest")
		return (
			<main id="main" className="exhibition-page">
				<ExhibitionViewer
					manifest={node.resource as IIIFManifest}
					language={language}
				/>
			</main>
		);
	return (
		<main id="main" className="page">
			<Breadcrumbs site={site} node={node} />
			<section className="hero">
				<span className="eyebrow">Collection</span>
				<h1>{text(node.resource.label, language) || "Untitled collection"}</h1>
				{text(node.resource.summary, language) ? (
					<p>{text(node.resource.summary, language)}</p>
				) : null}
			</section>
			{node.error ? (
				<p role="alert">
					This collection is currently unavailable. Try again later.
				</p>
			) : (
				<Cards nodes={node.children} language={language} />
			)}
			<Metadata resource={node.resource} language={language} />
		</main>
	);
}
