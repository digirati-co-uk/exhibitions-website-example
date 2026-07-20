import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { type DescriptiveResource, safeHttpUrl, text } from "#/lib/iiif";
import type { ResourcePageData, SiteIndexEntry } from "#/lib/site-data";

export function Header({
	name,
	logo,
	exhibitionsPath,
}: {
	name: string;
	logo?: string;
	exhibitionsPath?: string;
}) {
	return (
		<header className="site-header">
			<div className="header-inner">
				<Link to="/" className="brand">
					<span className="site-title">{name}</span>
				</Link>
				<nav aria-label="Primary" className="site-nav">
					<Link to="/" activeOptions={{ exact: true }}>
						Home
					</Link>
					<Link to="/collections">Collections</Link>
					{exhibitionsPath ? (
						<Link to="/$" params={{ _splat: exhibitionsPath }}>
							Exhibitions
						</Link>
					) : null}
				</nav>
				<img
					className="leeds-logo"
					src={logo || `${import.meta.env.BASE_URL}logo.svg`}
					alt={logo ? `${name} logo` : "University of Leeds"}
				/>
			</div>
		</header>
	);
}

export function Footer({
	name,
	iiif,
	repository,
	requiredStatement,
	language,
}: {
	name: string;
	iiif: string;
	repository?: string;
	requiredStatement?: DescriptiveResource["requiredStatement"];
	language: string;
}) {
	const statement = text(requiredStatement?.value, language);
	return (
		<footer className="site-footer">
			<div className="footer-inner">
				<p className="footer-name">{name}</p>
				<nav aria-label="Site information">
					<a href={iiif} rel="noopener noreferrer">
						IIIF
					</a>
					{repository ? (
						<a href={repository} rel="noopener noreferrer">
							GitHub
						</a>
					) : null}
				</nav>
				{statement ? (
					<div className="footer-statement">
						<strong>
							{text(requiredStatement?.label, language) || "Attribution"}
						</strong>
						{/* The IIIF required statement explicitly permits formatted HTML. */}
						{/* biome-ignore lint/security/noDangerouslySetInnerHtml: required statement is authored IIIF content */}
						<div dangerouslySetInnerHTML={{ __html: statement }} />
					</div>
				) : null}
			</div>
		</footer>
	);
}

function CardThumbnail({ entry }: { entry: SiteIndexEntry }) {
	const [index, setIndex] = useState(0);
	const thumbnail = entry.thumbnail?.[index]?.id;
	return (
		<Link
			to="/$"
			params={{ _splat: entry.path }}
			className="card-thumbnail"
			tabIndex={-1}
			aria-hidden="true"
		>
			{thumbnail ? (
				<img
					src={thumbnail}
					alt=""
					loading="lazy"
					onError={() => setIndex(index + 1)}
				/>
			) : (
				<span className="card-thumbnail-placeholder">{entry.type}</span>
			)}
		</Link>
	);
}

export function Cards({
	entries,
	language,
}: {
	entries: SiteIndexEntry[];
	language: string;
}) {
	if (!entries.length)
		return <p className="empty">There is nothing here yet.</p>;
	return (
		<div className="cards">
			{entries.map((entry) => {
				return (
					<article className="card" key={entry.id}>
						<CardThumbnail entry={entry} />
						<div className="card-body">
							<span className="eyebrow">
								{entry.type === "Collection"
									? "Collection"
									: entry.isExhibition
										? "Exhibition"
										: "Manifest"}
							</span>
							<h2>
								<Link to="/$" params={{ _splat: entry.path }}>
									{text(entry.label, language) || "Untitled"}
								</Link>
							</h2>
							{text(entry.summary, language) ? (
								<p>{text(entry.summary, language)}</p>
							) : null}
							{entry.unavailable ? (
								<p role="alert">This collection is currently unavailable.</p>
							) : null}
						</div>
					</article>
				);
			})}
		</div>
	);
}

export function Metadata({
	resource,
	language,
	includeMetadata = true,
}: {
	resource: DescriptiveResource;
	language: string;
	includeMetadata?: boolean;
}) {
	const providers = resource.provider?.filter((provider) => provider.id) || [];
	const rights = resource.rights ? safeHttpUrl(resource.rights) : null;
	const links = [
		...(resource.homepage || []),
		...(resource.seeAlso || []),
		...(resource.rendering || []),
	].filter((link) => safeHttpUrl(link.id));
	if (
		!(includeMetadata && resource.metadata?.length) &&
		!providers.length &&
		!rights &&
		!links.length
	)
		return null;
	return (
		<dl className="metadata">
			{providers.map((provider) => (
				<div key={provider.id}>
					<dt>Provider</dt>
					<dd>{text(provider.label, language) || provider.id}</dd>
				</div>
			))}
			{rights ? (
				<div>
					<dt>Rights</dt>
					<dd>
						<a href={rights.toString()} rel="noopener noreferrer">
							{resource.rights}
						</a>
					</dd>
				</div>
			) : null}
			{includeMetadata
				? (resource.metadata || []).map((entry) => (
						<div
							key={`${text(entry.label, language)}:${text(entry.value, language)}`}
						>
							<dt>{text(entry.label, language)}</dt>
							<dd>{text(entry.value, language)}</dd>
						</div>
					))
				: null}
		</dl>
	);
}

export function RequiredStatement({
	entry,
	language,
}: {
	entry: SiteIndexEntry;
	language: string;
}) {
	const value = text(entry.requiredStatement?.value, language);
	if (!value) return null;
	return (
		<aside className="required-statement">
			<strong>
				{text(entry.requiredStatement?.label, language) || "Attribution"}
			</strong>
			<p>{value}</p>
		</aside>
	);
}

export function externalViewerLinks(manifestId: string) {
	const manifest = safeHttpUrl(manifestId);
	if (!manifest) return [];
	const query = (base: string, key: string) => {
		const url = new URL(base);
		url.searchParams.set(key, manifest.toString());
		return url.toString();
	};
	const universalViewer = new URL("https://www.universalviewer.dev");
	universalViewer.hash = `?${new URLSearchParams({ manifest: manifest.toString() })}`;
	return [
		{
			label: "Theseus",
			href: query("https://theseusviewer.org/", "iiif-content"),
		},
		{
			label: "Mirador",
			href: query("https://projectmirador.org/embed/", "iiif-content"),
		},
		{ label: "Universal Viewer", href: universalViewer.toString() },
	];
}

export function ResourceActions({ entry }: { entry: SiteIndexEntry }) {
	const [copyStatus, setCopyStatus] = useState("");
	const source = safeHttpUrl(entry.id);
	return (
		<section className="resource-actions" aria-label="Resource actions">
			<button
				type="button"
				onClick={async () => {
					try {
						if (!navigator.clipboard) throw new Error("Clipboard unavailable");
						await navigator.clipboard.writeText(window.location.href);
						setCopyStatus("Page URL copied");
					} catch {
						setCopyStatus("Unable to copy page URL");
					}
				}}
			>
				Copy page URL
			</button>
			{source ? (
				<a href={source.toString()} rel="noopener noreferrer">
					Open IIIF JSON
				</a>
			) : null}
			{externalViewerLinks(entry.id).map((link) => (
				<a
					key={link.label}
					href={link.href}
					target="_blank"
					rel="noopener noreferrer"
				>
					Open in {link.label}
				</a>
			))}
			<output className="copy-status" aria-live="polite">
				{copyStatus}
			</output>
		</section>
	);
}

export function CollectionPage({
	page,
	language,
}: {
	page: ResourcePageData;
	language: string;
}) {
	return (
		<main id="main" className="page">
			<Breadcrumbs entries={page.breadcrumbs} language={language} />
			<section className="hero">
				<span className="eyebrow">Collection</span>
				<h1>{text(page.entry.label, language) || "Untitled collection"}</h1>
				{text(page.entry.summary, language) ? (
					<p>{text(page.entry.summary, language)}</p>
				) : null}
			</section>
			{page.unavailable ? (
				<p className="empty" role="alert">
					This collection is currently unavailable. Try again later.
				</p>
			) : (
				<Cards entries={page.children || []} language={language} />
			)}
			<Metadata resource={page.entry} language={language} />
		</main>
	);
}

export function Breadcrumbs({
	entries,
	language,
}: {
	entries: SiteIndexEntry[];
	language: string;
}) {
	return (
		<nav aria-label="Breadcrumb" className="breadcrumbs">
			<ol>
				{entries.map((entry, index) => (
					<li key={entry.id}>
						{index === entries.length - 1 ? (
							<span aria-current="page">
								{text(entry.label, language) || "Untitled"}
							</span>
						) : (
							<Link
								to={entry.path ? "/$" : "/"}
								params={
									entry.path ? { _splat: entry.path } : (undefined as never)
								}
							>
								{entry.path ? text(entry.label, language) : "Home"}
							</Link>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
