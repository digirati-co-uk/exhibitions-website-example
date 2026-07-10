export type InternationalString = Record<string, string[]>;

export interface DescriptiveResource {
	id: string;
	type: string;
	label?: InternationalString;
	summary?: InternationalString;
	metadata?: Array<{ label: InternationalString; value: InternationalString }>;
	thumbnail?: Array<{ id: string; type?: string }>;
	logo?: Array<{ id: string; type?: string }>;
	homepage?: Array<{ id: string; label?: InternationalString }>;
	provider?: Array<DescriptiveResource>;
	behavior?: string[];
}

export interface IIIFCollectionItem extends DescriptiveResource {
	type: "Collection" | "Manifest" | string;
}

export interface IIIFCollection extends DescriptiveResource {
	type: "Collection";
	items: IIIFCollectionItem[];
}

export interface IIIFManifest extends DescriptiveResource {
	type: "Manifest";
	items?: unknown[];
}

export interface SiteConfig {
	collection: string;
	defaultLanguage?: string;
}

export interface SiteNode {
	resource: IIIFCollection | IIIFManifest;
	path: string;
	children: SiteNode[];
	error?: string;
}

export interface SiteData {
	config: Required<SiteConfig>;
	info: IIIFCollection;
	root: SiteNode;
}

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

export function slugFromId(id: string) {
	let segment: string;
	try {
		const url = new URL(id);
		segment = url.pathname.replace(/\/+$/, "").split("/").pop() || "";
	} catch {
		segment = id.split(/[?#]/)[0].replace(/\/+$/, "").split("/").pop() || "";
	}
	return decodeURIComponent(segment)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function isInfoId(id: string) {
	return slugFromId(id) === "info";
}

export function viewerType(behavior: string[] = []) {
	if (behavior.includes("slideshow")) return "slideshow" as const;
	if (behavior.includes("scroll")) return "scroll" as const;
	return "exhibition" as const;
}

function normalizeAnnotationBodies(value: unknown) {
	if (!value || typeof value !== "object") return;
	const item = value as Record<string, unknown>;
	if (item.type === "Annotation" && item.body == null) item.body = [];
	for (const child of Object.values(item)) {
		if (Array.isArray(child)) child.forEach(normalizeAnnotationBodies);
		else normalizeAnnotationBodies(child);
	}
}

async function getJson(url: string) {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`Unable to load ${url} (${response.status})`);
	return response.json() as Promise<unknown>;
}

function resource(value: unknown, expected?: "Collection" | "Manifest") {
	if (!value || typeof value !== "object")
		throw new Error("IIIF resource is not an object");
	const item = value as DescriptiveResource;
	if (!item.id || !item.type || (expected && item.type !== expected)) {
		throw new Error(`Expected a IIIF ${expected || "resource"}`);
	}
	if (
		item.type === "Collection" &&
		!Array.isArray((item as IIIFCollection).items)
	) {
		(item as IIIFCollection).items = [];
	}
	if (item.type === "Manifest") normalizeAnnotationBodies(item);
	return item as IIIFCollection | IIIFManifest;
}

export function validateConfig(value: unknown): Required<SiteConfig> {
	if (
		!value ||
		typeof value !== "object" ||
		typeof (value as SiteConfig).collection !== "string"
	) {
		throw new Error("site.config.json must contain a collection URL");
	}
	const config = value as SiteConfig;
	try {
		new URL(config.collection);
	} catch {
		throw new Error("site.config.json collection must be an absolute URL");
	}
	return {
		collection: config.collection,
		defaultLanguage: config.defaultLanguage || "en",
	};
}

export async function loadSite(configUrl: string): Promise<SiteData> {
	const config = validateConfig(await getJson(configUrl));
	const rootCollection = resource(
		await getJson(config.collection),
		"Collection",
	) as IIIFCollection;
	const infoRef = rootCollection.items.find(
		(item) => item.type === "Collection" && isInfoId(item.id),
	);
	if (!infoRef)
		throw new Error(
			"The root collection must contain a Collection ending in /info",
		);
	const info = resource(
		await getJson(infoRef.id),
		"Collection",
	) as IIIFCollection;
	const visited = new Set<string>();

	async function visit(
		item: IIIFCollection | IIIFManifest,
		parentPath: string,
	): Promise<SiteNode> {
		if (visited.has(item.id))
			throw new Error(`Repeated or cyclic IIIF resource: ${item.id}`);
		visited.add(item.id);
		const slug = item.id === rootCollection.id ? "" : slugFromId(item.id);
		if (item.id !== rootCollection.id && (!slug || slug === "info"))
			throw new Error(`Invalid reserved slug for ${item.id}`);
		const path = [parentPath, slug].filter(Boolean).join("/");
		if (item.type === "Manifest") return { resource: item, path, children: [] };

		const supported = item.items
			.filter(
				(child) => child.type === "Collection" || child.type === "Manifest",
			)
			.filter((child) => !isInfoId(child.id));
		const slugs = supported.map((child) => slugFromId(child.id));
		const duplicate = slugs.find(
			(candidate, index) => !candidate || slugs.indexOf(candidate) !== index,
		);
		if (duplicate !== undefined)
			throw new Error(
				`Empty or duplicate sibling slug "${duplicate}" in ${item.id}`,
			);

		const children: SiteNode[] = [];
		for (const child of supported) {
			try {
				const loaded = resource(
					await getJson(child.id),
					child.type as "Collection" | "Manifest",
				);
				children.push(await visit(loaded, path));
			} catch (error) {
				if (child.type === "Collection") {
					children.push({
						resource: child as IIIFCollection,
						path: [path, slugFromId(child.id)].filter(Boolean).join("/"),
						children: [],
						error:
							error instanceof Error
								? error.message
								: "Unable to load collection",
					});
				} else {
					throw error;
				}
			}
		}
		return { resource: item, path, children };
	}

	return { config, info, root: await visit(rootCollection, "") };
}

export function findNode(root: SiteNode, path: string) {
	const normalized = path.replace(/^\/+|\/+$/g, "");
	const stack = [root];
	while (stack.length) {
		const node = stack.pop();
		if (!node) break;
		if (node.path === normalized) return node;
		stack.push(...node.children);
	}
}

export function breadcrumbs(root: SiteNode, target: SiteNode) {
	const result: SiteNode[] = [];
	function walk(node: SiteNode): boolean {
		result.push(node);
		if (node === target) return true;
		for (const child of node.children) if (walk(child)) return true;
		result.pop();
		return false;
	}
	walk(root);
	return result;
}
