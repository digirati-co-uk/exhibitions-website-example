export type InternationalString = Record<string, string[]>;

export const STATIC_SITE_INFO_BEHAVIOR = "static-site-info";
export const STATIC_SITE_ROUTE_PROFILE =
	"https://digirati.com/iiif/static-site-route-service/v1";
export const GITHUB_PROFILE = "https://github.com/";

export interface LinkingResource {
	id: string;
	type?: string;
	format?: string;
	profile?: string | string[];
	label?: InternationalString;
}

export interface Service extends LinkingResource {
	source?: string;
}

export interface StaticSiteRouteService extends Service {
	type: "Service";
	profile: typeof STATIC_SITE_ROUTE_PROFILE;
	source: string;
}

export interface DescriptiveResource {
	id: string;
	type: string;
	label?: InternationalString;
	summary?: InternationalString;
	metadata?: Array<{ label: InternationalString; value: InternationalString }>;
	thumbnail?: Array<{ id: string; type?: string }>;
	logo?: Array<{ id: string; type?: string }>;
	homepage?: LinkingResource[];
	seeAlso?: LinkingResource[];
	service?: Service[];
	provider?: DescriptiveResource[];
	behavior?: string[];
}

export interface IIIFCollectionItem extends DescriptiveResource {
	type: string;
}

export interface IIIFCollection extends DescriptiveResource {
	type: "Collection";
	items?: IIIFCollectionItem[];
}

export interface IIIFManifest extends DescriptiveResource {
	type: "Manifest";
	items?: unknown[];
}

export interface SiteConfig {
	defaultLanguage?: string;
}

export const RESERVED_PATHS = new Set(["info", "collections"]);

export function text(value: InternationalString | undefined, language = "en") {
	if (!value) return "";
	return (
		value[language]?.[0] ||
		value.none?.[0] ||
		Object.values(value).flat()[0] ||
		""
	);
}

export function imageId(
	resource: Pick<DescriptiveResource, "thumbnail" | "logo">,
	field: "thumbnail" | "logo",
) {
	return resource[field]?.[0]?.id;
}

export function isExhibition(behavior: unknown) {
	return Array.isArray(behavior) && behavior.includes("exhibition");
}

export function viewerType(behavior: string[] = []) {
	if (behavior.includes("slideshow")) return "slideshow" as const;
	if (behavior.includes("scroll")) return "scroll" as const;
	return "exhibition" as const;
}

export function normalizePath(path: string) {
	return path
		.split("/")
		.filter(Boolean)
		.map((part) => decodeURIComponent(part))
		.join("/");
}

export function pathSegment(id: string) {
	let pathname = id;
	try {
		pathname = new URL(id).pathname;
	} catch {
		pathname = id.split(/[?#]/)[0];
	}
	const segment = pathname.replace(/\/+$/, "").split("/").pop() || "";
	return decodeURIComponent(segment);
}

function httpUrl(value: string) {
	const url = new URL(value);
	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.username ||
		url.password
	) {
		throw new Error("Expected an HTTP(S) URL without credentials");
	}
	return url;
}

function withoutTrailingSlash(pathname: string) {
	return pathname === "/" ? "" : pathname.replace(/\/+$/, "");
}

function hasProfile(
	resource: { profile?: string | string[] },
	profile: string,
) {
	return Array.isArray(resource.profile)
		? resource.profile.includes(profile)
		: resource.profile === profile;
}

function hasLabel(resource: LinkingResource, value: string) {
	return Object.values(resource.label || {}).some((values) =>
		values?.includes(value),
	);
}

export function findRouteService(
	resource?: Pick<DescriptiveResource, "service"> | null,
): StaticSiteRouteService | null {
	const matches =
		resource?.service?.filter((service) =>
			hasProfile(service, STATIC_SITE_ROUTE_PROFILE),
		) || [];
	if (matches.length > 1)
		throw new Error("Static-site info has more than one route service");
	const service = matches[0];
	if (!service) return null;
	if (service.type !== "Service" || !service.id || !service.source)
		throw new Error("Static-site route service is invalid");
	try {
		httpUrl(service.id);
		httpUrl(service.source);
	} catch {
		throw new Error("Static-site route service is invalid");
	}
	return {
		...service,
		type: "Service",
		profile: STATIC_SITE_ROUTE_PROFILE,
		source: service.source,
	};
}

export function findSiteHomepage(
	resource?: Pick<DescriptiveResource, "homepage"> | null,
) {
	const homepages =
		resource?.homepage?.filter((homepage) => homepage.format === "text/html") ||
		[];
	return (
		homepages.find((homepage) => hasLabel(homepage, "Visit the site")) ||
		homepages[0] ||
		null
	);
}

function isGithubRepository(resource: LinkingResource) {
	try {
		const url = httpUrl(resource.id);
		return (
			url.hostname.toLowerCase() === "github.com" &&
			url.pathname.split("/").filter(Boolean).length === 2
		);
	} catch {
		return false;
	}
}

function isHttpLink(resource: LinkingResource) {
	try {
		httpUrl(resource.id);
		return true;
	} catch {
		return false;
	}
}

export function findGithubRepository(
	resource?: Pick<DescriptiveResource, "seeAlso"> | null,
) {
	const links = resource?.seeAlso || [];
	return (
		links.find(
			(link) => hasProfile(link, GITHUB_PROFILE) && isHttpLink(link),
		) ||
		links.find(isGithubRepository) ||
		null
	);
}

export function sourcePath(rootUrl: string, resourceUrl: string) {
	try {
		const root = httpUrl(rootUrl);
		const resource = httpUrl(resourceUrl);
		if (root.origin !== resource.origin) return;
		const prefix = withoutTrailingSlash(root.pathname);
		const pathname = withoutTrailingSlash(resource.pathname);
		if (pathname === prefix) return "";
		if (!pathname.startsWith(`${prefix}/`)) return;
		return normalizePath(pathname.slice(prefix.length + 1));
	} catch {
		return;
	}
}

export function mapResourceToSite(
	service: StaticSiteRouteService,
	resourcePublicId: string,
) {
	try {
		const target = httpUrl(service.id);
		const source = httpUrl(service.source);
		const resource = httpUrl(resourcePublicId);
		const sourcePathname = withoutTrailingSlash(source.pathname);
		const resourcePathname = withoutTrailingSlash(resource.pathname);
		if (
			resource.origin !== source.origin ||
			(resourcePathname !== sourcePathname &&
				!resourcePathname.startsWith(`${sourcePathname}/`))
		)
			return null;
		const relativePath =
			resourcePathname === sourcePathname
				? ""
				: resourcePathname.slice(sourcePathname.length + 1);
		const targetPath = withoutTrailingSlash(target.pathname);
		target.pathname = relativePath
			? `${targetPath}/${relativePath}`
			: `${targetPath}/`;
		target.search = "";
		target.hash = "";
		return target;
	} catch {
		return null;
	}
}

export function sameResource(left: string, right: string) {
	try {
		const normalize = (value: string) => {
			const url = httpUrl(value);
			url.search = "";
			url.hash = "";
			url.pathname = withoutTrailingSlash(url.pathname);
			return url.toString();
		};
		return normalize(left) === normalize(right);
	} catch {
		return false;
	}
}

export function remoteUrl(rootUrl: string, path: string) {
	const encoded = normalizePath(path)
		.split("/")
		.map(encodeURIComponent)
		.join("/");
	return `${rootUrl.replace(/\/+$/, "")}/${encoded}`;
}

export function isReservedPath(path: string) {
	const first = normalizePath(path).split("/")[0];
	return Boolean(first && RESERVED_PATHS.has(first));
}
