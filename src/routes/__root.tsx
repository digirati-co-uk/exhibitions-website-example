import type { QueryClient } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";
import { text } from "#/lib/iiif";
import { siteQuery } from "#/lib/queries";
import appCss from "../styles.css?url";
import "exhibition-viewer/dist/index.css";

export interface RouterContext {
	queryClient: QueryClient;
}

const currentUrl = createIsomorphicFn()
	.server(() => getRequestUrl().toString())
	.client(() => window.location.href);

function configUrl() {
	return new URL(
		`${import.meta.env.BASE_URL}site.config.json`,
		import.meta.env.VITE_SITE_URL || currentUrl(),
	).toString();
}

export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: () => ({ configUrl: configUrl() }),
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(siteQuery(context.configUrl)),
	head: ({ loaderData }) => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{
				title: loaderData
					? text(loaderData.info.label, loaderData.config.defaultLanguage)
					: "Exhibitions",
			},
			{
				name: "description",
				content: loaderData
					? text(loaderData.info.summary, loaderData.config.defaultLanguage)
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
			<p>This page is not part of the current exhibition collection.</p>
			<Link to="/">Return home</Link>
		</main>
	),
	shellComponent: RootDocument,
});

function SiteLayout() {
	const configUrl = Route.useRouteContext().configUrl;
	const { data } = useSuspenseQuery(siteQuery(configUrl));
	const language = data.config.defaultLanguage;
	const name = text(data.info.label, language) || "Exhibitions";
	const provider = (data.info.provider || [])
		?.map((item) => text(item.label, language))
		.filter(Boolean)
		.join(", ");
	return (
		<>
			<a className="skip-link" href="#main">
				Skip to content
			</a>
			<header className="site-header">
				<Link to="/" className="brand">
					<span className="site-title">{name}</span>
					<img
						className="leeds-logo"
						src={`${import.meta.env.BASE_URL}logo.svg`}
						alt="University of Leeds"
					/>
				</Link>
			</header>
			<Outlet />
			<footer>
				<p>{provider || name}</p>
			</footer>
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
			<h1>Unable to load the exhibitions</h1>
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
