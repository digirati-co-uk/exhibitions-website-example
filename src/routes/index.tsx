import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { Cards, Metadata } from "#/components/site";
import { text } from "#/lib/iiif";
import { siteQuery } from "#/lib/queries";

export const Route = createFileRoute("/")({
	component: Home,
});

const rootRoute = getRouteApi("__root__");

function Home() {
	const context = rootRoute.useRouteContext();
	const { data: site } = useSuspenseQuery(siteQuery(context.configUrl));
	const language = site.config.defaultLanguage;
	return (
		<main id="main" className="page">
			<section className="hero">
				<span className="eyebrow">Exhibitions</span>
				<h1>{text(site.info.label, language) || "Exhibitions"}</h1>
				{text(site.info.summary, language) ? (
					<p>{text(site.info.summary, language)}</p>
				) : null}
			</section>
			<Cards nodes={site.root.children} language={language} />
			<Metadata resource={site.info} language={language} />
		</main>
	);
}
