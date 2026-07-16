import { Link } from "@tanstack/react-router";
import { type DescriptiveResource, imageId, text } from "#/lib/iiif";
import type { ResourcePageData, SiteIndexEntry } from "#/lib/site-data";

export function Header({
	name,
	logo,
	repository,
	exhibitionsPath,
}: {
	name: string;
	logo?: string;
	repository?: string;
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
					{repository ? (
						<a href={repository} rel="noopener noreferrer">
							Source on GitHub
						</a>
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
				const thumbnail = imageId(entry, "thumbnail");
				return (
					<article className="card" key={entry.id}>
						{thumbnail ? (
							<Link
								to="/$"
								params={{ _splat: entry.path }}
								className="card-thumbnail"
								tabIndex={-1}
								aria-hidden="true"
							>
								<img src={thumbnail} alt="" loading="lazy" />
							</Link>
						) : null}
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
}: {
	resource: DescriptiveResource;
	language: string;
}) {
	if (!resource.metadata?.length) return null;
	return (
		<dl className="metadata">
			{resource.metadata.map((entry) => (
				<div
					key={`${text(entry.label, language)}:${text(entry.value, language)}`}
				>
					<dt>{text(entry.label, language)}</dt>
					<dd>{text(entry.value, language)}</dd>
				</div>
			))}
		</dl>
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
