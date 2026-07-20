import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { Footer, Header } from "#/components/site";
import { imageId, text } from "#/lib/iiif";
import { siteQuery } from "#/lib/queries";
import appCss from "../styles.css?url";
import "exhibition-viewer/dist/index.css";

export interface RouterContext {
	queryClient: QueryClient;
}

const currentUrl = createIsomorphicFn()
	.server(() => getRequestUrl().toString())
	.client(() => window.location.href);

function baseUrl() {
	return new URL(import.meta.env.BASE_URL, currentUrl()).toString();
}

export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: () => ({ baseUrl: baseUrl() }),
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(siteQuery(context.baseUrl)),
	head: ({ loaderData }) => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{
				title: loaderData
					? text(loaderData.info.label, loaderData.defaultLanguage)
					: "Exhibitions",
			},
			{
				name: "description",
				content: loaderData
					? text(loaderData.info.summary, loaderData.defaultLanguage)
					: "",
			},
		],
		links: [
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{ rel: "stylesheet", href: "https://use.typekit.net/xpd0xwa.css" },
			{ rel: "stylesheet", href: appCss },
		],
	}),
	component: SiteLayout,
	errorComponent: ({ error, reset }) => (
		<ErrorState error={error} retry={reset} />
	),
	notFoundComponent: () => (
		<main id="main" className="page">
			<h1>Page not found</h1>
			<p>This page is not part of the current IIIF collection.</p>
			<Link to="/">Return home</Link>
		</main>
	),
	shellComponent: RootDocument,
});

function SiteLayout() {
	const site = Route.useLoaderData();
	const language = site.defaultLanguage;
	const name = text(site.info.label, language) || "Exhibitions";
	const exhibitions = site.entriesByPath.get("exhibitions");
	return (
		<>
			<a className="skip-link" href="#main">
				Skip to content
			</a>
			<Header
				name={name}
				logo={imageId(site.info, "logo")}
				exhibitionsPath={
					exhibitions?.type === "Collection" ? exhibitions.path : undefined
				}
			/>
			<Outlet />
			<Footer
				name={name}
				iiif={site.rootUrl}
				repository={site.repository}
				requiredStatement={site.info.requiredStatement}
				language={language}
			/>
		</>
	);
}

export function ErrorState({
	error,
	retry,
}: {
	error: Error;
	retry: () => void;
}) {
	return (
		<main id="main" className="page error" role="alert">
			<h1>Unable to load the site</h1>
			<p>{error.message}</p>
			<button className="site-button" type="button" onClick={retry}>
				Try again
			</button>
		</main>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
