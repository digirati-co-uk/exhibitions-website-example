import {
	ClientOnly,
	createFileRoute,
	getRouteApi,
	notFound,
} from "@tanstack/react-router";
import { ExhibitionViewer } from "#/components/exhibition";
import { ManifestPage } from "#/components/manifest";
import { CollectionPage } from "#/components/site";
import { imageId, mapResourceToSite, text } from "#/lib/iiif";
import { resourceQuery, siteQuery } from "#/lib/queries";
import type { SiteIndex } from "#/lib/site-data";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/$")({
	loader: async ({ context, params }) => {
		const site = await context.queryClient.ensureQueryData(
			siteQuery(context.baseUrl),
		);
		const page = await context.queryClient.fetchQuery(
			resourceQuery(context.baseUrl, site, params._splat || ""),
		);
		if (!page) throw notFound();
		return page;
	},
	head: ({ loaderData, match }) => {
		if (!loaderData) return {};
		const site = match.context.queryClient.getQueryData<SiteIndex>([
			"site",
			match.context.baseUrl,
		]);
		if (!site) return {};
		const language = site.defaultLanguage;
		const title = text(loaderData.entry.label, language) || "Untitled";
		const siteTitle = text(site.info.label, language) || "Exhibitions";
		const description =
			text(loaderData.entry.summary, language) ||
			text(site.info.summary, language);
		const image =
			imageId(loaderData.entry, "thumbnail") || imageId(site.info, "logo");
		const canonical = mapResourceToSite(
			site.routeService,
			loaderData.entry.id,
		)?.toString();
		return {
			meta: [
				{ title: `${title} | ${siteTitle}` },
				{ name: "description", content: description },
				{ property: "og:title", content: title },
				{ property: "og:description", content: description },
				...(canonical ? [{ property: "og:url", content: canonical }] : []),
				{
					property: "og:type",
					content: loaderData.entry.type === "Manifest" ? "article" : "website",
				},
				...(image ? [{ property: "og:image", content: image }] : []),
			],
			links: canonical ? [{ rel: "canonical", href: canonical }] : [],
		};
	},
	component: ResourcePage,
});

function ResourcePage() {
	const page = Route.useLoaderData();
	const site = rootRoute.useLoaderData();
	if (page.entry.type === "Collection")
		return <CollectionPage page={page} language={site.defaultLanguage} />;
	if (page.entry.isExhibition && page.resource?.type === "Manifest")
		return (
			<main id="main" className="exhibition-page">
				<ClientOnly
					fallback={<p className="viewer-loading">Loading exhibition…</p>}
				>
					<ExhibitionViewer
						manifest={page.resource}
						language={site.defaultLanguage}
					/>
				</ClientOnly>
			</main>
		);
	return <ManifestPage page={page} language={site.defaultLanguage} />;
}
