import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Cards } from "#/components/site";
import { homeQuery, siteQuery } from "#/lib/queries";
import type { SiteIndex } from "#/lib/site-data";

const rootRoute = getRouteApi("__root__");

export const Route = createFileRoute("/collections")({
	loader: async ({ context }) => {
		const site = await context.queryClient.ensureQueryData(
			siteQuery(context.baseUrl),
		);
		return context.queryClient.fetchQuery(homeQuery(context.baseUrl, site));
	},
	head: ({ match }) => {
		const site = match.context.queryClient.getQueryData<SiteIndex>([
			"site",
			match.context.baseUrl,
		]);
		const canonical = site
			? new URL("collections/", site.routeService.id).toString()
			: undefined;
		return {
			meta: [
				{ title: "Collections" },
				{
					name: "description",
					content: "Browse the top-level IIIF collection.",
				},
				...(canonical ? [{ property: "og:url", content: canonical }] : []),
			],
			links: canonical ? [{ rel: "canonical", href: canonical }] : [],
		};
	},
	component: Collections,
});

function Collections() {
	const page = Route.useLoaderData();
	const site = rootRoute.useLoaderData();
	return (
		<main id="main" className="page">
			<section className="hero">
				<span className="eyebrow">Browse</span>
				<h1>Collections</h1>
				<p>Browse the top-level IIIF collection.</p>
			</section>
			<Cards entries={page.children || []} language={site.defaultLanguage} />
		</main>
	);
}
