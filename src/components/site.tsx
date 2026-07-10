import { Link } from "@tanstack/react-router";
import {
	breadcrumbs,
	imageId,
	type SiteData,
	type SiteNode,
	text,
} from "#/lib/iiif";

export function Cards({
	nodes,
	language,
}: {
	nodes: SiteNode[];
	language: string;
}) {
	if (!nodes.length)
		return <p className="empty">There are no exhibitions here yet.</p>;
	return (
		<div className="cards">
			{nodes.map((node) => {
				const image = imageId(node.resource, "thumbnail");
				return (
					<article className="card" key={node.resource.id}>
						{image ? (
							<img src={image} alt="" loading="lazy" />
						) : (
							<div className="card-placeholder" />
						)}
						<div className="card-body">
							<span className="eyebrow">
								{node.resource.type === "Manifest"
									? "Exhibition"
									: "Collection"}
							</span>
							<h2>
								<Link to="/$" params={{ _splat: node.path }}>
									{text(node.resource.label, language) || "Untitled"}
								</Link>
							</h2>
							{text(node.resource.summary, language) ? (
								<p>{text(node.resource.summary, language)}</p>
							) : null}
							{node.error ? (
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
	resource: SiteNode["resource"];
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

export function Breadcrumbs({
	site,
	node,
}: {
	site: SiteData;
	node: SiteNode;
}) {
	return (
		<nav aria-label="Breadcrumb" className="breadcrumbs">
			<ol>
				{breadcrumbs(site.root, node).map((item, index, all) => (
					<li key={item.resource.id}>
						{index === all.length - 1 ? (
							<span aria-current="page">
								{text(item.resource.label, site.config.defaultLanguage) ||
									"Untitled"}
							</span>
						) : (
							<Link
								to={item.path ? "/$" : "/"}
								params={
									item.path ? { _splat: item.path } : (undefined as never)
								}
							>
								{item.path
									? text(item.resource.label, site.config.defaultLanguage)
									: "Home"}
							</Link>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
