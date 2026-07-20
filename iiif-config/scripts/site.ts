import { extract } from "iiif-hss";

const fields = [
  "id",
  "type",
  "label",
  "summary",
  "metadata",
  "thumbnail",
  "logo",
  "provider",
  "requiredStatement",
  "rights",
  "rendering",
  "homepage",
  "seeAlso",
  "service",
  "behavior",
] as const;

function descriptive(resource: Record<string, unknown>) {
  return Object.fromEntries(
    fields
      .filter((field) => resource[field] !== undefined)
      .map((field) => [field, resource[field]]),
  );
}

extract(
  {
    id: "site",
    name: "Site metadata and virtual collections",
    types: ["Collection", "Manifest"],
  },
  async (_resource, api) => {
    const resource = api.resource as Record<string, unknown>;
    const exhibition =
      resource.type === "Manifest" &&
      Array.isArray(resource.behavior) &&
      resource.behavior.includes("exhibition");
    const featured =
      (resource.type === "Manifest" || resource.type === "Collection") &&
      Array.isArray(resource.behavior) &&
      resource.behavior.includes("featured");
    const info =
      resource.type === "Collection" &&
      Array.isArray(resource.behavior) &&
      resource.behavior.includes("static-site-info");

    return {
      meta: {
        "site:exhibition": exhibition,
        "site:featured": featured,
        "site:resource": descriptive(resource),
        ...(info ? { "site:info": descriptive(resource) } : {}),
      },
      collections: [
        ...(exhibition ? ["exhibitions"] : []),
        ...(featured ? ["featured"] : []),
      ],
    };
  },
);
