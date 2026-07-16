import { readFile } from "node:fs/promises";
import { join } from "node:path";

const INFO_BEHAVIOR = "static-site-info";
const ROUTE_PROFILE =
	"https://digirati.com/iiif/static-site-route-service/v1";

function httpUrl(value) {
	const url = new URL(value);
	if (
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.username ||
		url.password
	)
		throw new Error("Expected an HTTP(S) URL without credentials");
	return url;
}

function sameResource(left, right) {
	try {
		const normalize = (value) => {
			const url = httpUrl(value);
			url.search = "";
			url.hash = "";
			url.pathname = url.pathname.replace(/\/+$/, "");
			return url.toString();
		};
		return normalize(left) === normalize(right);
	} catch {
		return false;
	}
}

function hasProfile(resource, profile) {
	return Array.isArray(resource?.profile)
		? resource.profile.includes(profile)
		: resource?.profile === profile;
}

async function readJson(path) {
	return JSON.parse(await readFile(path, "utf8"));
}

export async function readSiteContract(iiifRoot) {
	const build = await readJson(join(iiifRoot, "meta/build.json"));
	if (
		build.formatVersion !== 1 ||
		build.mode !== "full" ||
		!build.entrypoints?.resources ||
		!build.entrypoints?.resourceDescriptors
	)
		throw new Error("HSS output is not a complete format 1 build");
	const resources = await readJson(join(iiifRoot, build.entrypoints.resources));
	const descriptors = await readJson(
		join(iiifRoot, build.entrypoints.resourceDescriptors),
	);
	const matches = Object.entries(resources).flatMap(([key, info]) => {
		if (
			info.type !== "Collection" ||
			!info.behavior?.includes(INFO_BEHAVIOR)
		)
			return [];
		const slug = info["hss:slug"] || key;
		const descriptor = descriptors[slug];
		if (descriptor?.origin !== "source" || descriptor.parents?.length !== 1)
			return [];
		const parentSlug = descriptor.parents[0];
		const rootDescriptor = descriptors[parentSlug];
		const root = resources[parentSlug];
		if (
			rootDescriptor?.origin !== "source" ||
			rootDescriptor.parents?.length ||
			root?.type !== "Collection"
		)
			return [];
		try {
			const rootUrl = httpUrl(root.id);
			const infoUrl = httpUrl(info.id);
			const prefix = rootUrl.pathname.replace(/\/+$/, "");
			if (
				rootUrl.origin !== infoUrl.origin ||
				infoUrl.pathname.replace(/\/+$/, "") !== `${prefix}/info`
			)
				return [];
		} catch {
			return [];
		}
		return [{ root, info, slug }];
	});
	if (matches.length !== 1)
		throw new Error(
			matches.length
				? "HSS output has more than one marked direct info Collection"
				: "HSS output has no marked direct info Collection",
		);
	const match = matches[0];
	const meta = await readJson(join(iiifRoot, match.slug, "meta.json"));
	const info = meta["site:info"];
	if (!info || !sameResource(info.id, match.info.id))
		throw new Error("The marked info Collection is missing site metadata");
	const services = (info.service || []).filter((service) =>
		hasProfile(service, ROUTE_PROFILE),
	);
	if (services.length !== 1)
		throw new Error("Static-site info must have exactly one route service");
	const service = services[0];
	if (
		service.type !== "Service" ||
		!service.id ||
		!service.source ||
		!sameResource(service.source, match.root.id)
	)
		throw new Error("Static-site route service is invalid");
	httpUrl(service.id);
	return { rootId: match.root.id, siteUrl: service.id };
}

export function createDeployment({
	rootId,
	siteUrl,
	packageJson,
	env = process.env,
	now = new Date(),
}) {
	const repository = env.GITHUB_REPOSITORY;
	const revision = env.GITHUB_SHA;
	const server = env.GITHUB_SERVER_URL || "https://github.com";
	const deployment = {
		schemaVersion: 1,
		deployedAt: now.toISOString(),
		source: { id: rootId },
		site: { url: siteUrl },
		...(revision
			? {
					revision: {
						id: revision,
						...(env.GITHUB_REF_NAME ? { branch: env.GITHUB_REF_NAME } : {}),
						...(repository
							? { url: `${server}/${repository}/commit/${revision}` }
							: {}),
					},
				}
			: {}),
		...(env.GITHUB_RUN_ID && repository
			? {
					build: {
						provider: "github-actions",
						url: `${server}/${repository}/actions/runs/${env.GITHUB_RUN_ID}`,
					},
				}
			: {}),
		generator: {
			name: packageJson.name,
			...(packageJson.version ? { version: packageJson.version } : {}),
		},
	};
	validateDeployment(deployment);
	return deployment;
}

export function validateDeployment(value) {
	const timestamp =
		typeof value?.deployedAt === "string" &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
			value.deployedAt,
		);
	if (
		value?.schemaVersion !== 1 ||
		!timestamp ||
		Number.isNaN(Date.parse(value.deployedAt)) ||
		typeof value.generator?.name !== "string" ||
		!value.generator.name
	)
		throw new Error("Deployment record is invalid");
	httpUrl(value.source?.id);
	if (value.site?.url) httpUrl(value.site.url);
	if (value.revision) {
		if (!/^[0-9a-f]{7,64}$/i.test(value.revision.id || ""))
			throw new Error("Deployment revision is invalid");
		if (value.revision.url) httpUrl(value.revision.url);
		if (
			value.revision.branch !== undefined &&
			(typeof value.revision.branch !== "string" || !value.revision.branch)
		)
			throw new Error("Deployment revision branch is invalid");
	}
	if (
		value.build?.provider !== undefined &&
		(typeof value.build.provider !== "string" || !value.build.provider)
	)
		throw new Error("Deployment build provider is invalid");
	if (value.build?.url) httpUrl(value.build.url);
	return value;
}
