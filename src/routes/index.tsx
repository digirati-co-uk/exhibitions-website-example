import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Cards, Metadata } from "#/components/site";
import { text } from "#/lib/iiif";
import { featuredQuery, siteQuery } from "#/lib/queries";
import type { SiteIndex } from "#/lib/site-data";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		const site = await context.queryClient.ensureQueryData(
			siteQuery(context.baseUrl),
		);
		return context.queryClient.ensureQueryData(
			featuredQuery(context.baseUrl, site),
		);
	},
	head: ({ match }) => {
		const site = match.context.queryClient.getQueryData<SiteIndex>([
			"site",
			match.context.baseUrl,
		]);
		return site
			? {
					meta: [{ property: "og:url", content: site.routeService.id }],
					links: [{ rel: "canonical", href: site.routeService.id }],
				}
			: {};
	},
	component: Home,
});

function Home() {
	const entries = Route.useLoaderData();
	const site = rootRoute.useLoaderData();
	const language = site.defaultLanguage;
	return (
		<main id="main" className="page">
			<section className="hero">
				<span className="eyebrow">Featured</span>
				<h1>{text(site.info.label, language) || "Exhibitions"}</h1>
				{text(site.info.summary, language) ? (
					<p>{text(site.info.summary, language)}</p>
				) : null}
			</section>
			<Cards entries={entries} language={language} />
			<Metadata resource={site.info} language={language} />
		</main>
	);
}
