# IIIF exhibition static site

A statically prerendered, React-hydrated browser for one IIIF Presentation 3 Collection. [`iiif-hss`](https://www.npmjs.com/package/iiif-hss) builds the local content index; Collections and Manifests stay remote and are loaded only when their page needs them.

## Configure content

Set the remote root Collection in `iiif-config/stores/content.json`:

```json
{
  "type": "iiif-remote",
  "url": "https://example.org/iiif/root",
  "saveManifests": false,
  "run": ["site"]
}
```

The root must have one direct child Collection at `<root URL>/info` whose `behavior` contains the exact token `static-site-info`. Its label, summary, metadata, logo, provider, homepage, repository link, and route service define the site identity. A minimal route contract is:

```json
{
  "id": "https://example.org/iiif/root/info",
  "type": "Collection",
  "behavior": ["static-site-info"],
  "homepage": [
    {
      "id": "https://example.github.io/exhibitions/",
      "type": "Text",
      "format": "text/html",
      "label": { "en": ["Visit the site"] }
    }
  ],
  "seeAlso": [
    {
      "id": "https://github.com/example/exhibitions",
      "type": "Text",
      "format": "text/html",
      "profile": "https://github.com/"
    }
  ],
  "service": [
    {
      "id": "https://example.github.io/exhibitions/",
      "type": "Service",
      "profile": "https://digirati.com/iiif/static-site-route-service/v1",
      "source": "https://example.org/iiif/root"
    }
  ]
}
```

The route service maps the root public IIIF ID and every descendant ID onto the same relative site path. Its target is the canonical site base. When a `Visit the site` homepage is present it must match that target. `public/site.config.json` contains presentation-only runtime settings such as `defaultLanguage`.

Collections are browsed one level at a time. Resource URLs beneath the root URL become hierarchy routes:

- `/` displays the build-indexed Featured collection.
- `/collections` loads the root Collection and its direct children.
- `/folder` loads that Collection.
- `/folder/subfolder` loads the nested Collection.
- `/folder/subfolder/manifest` loads that Manifest.

Build-known grid cards use thumbnails from HSS's local Manifest index, without loading child Manifests at runtime.

Only the exact marked direct info Collection is hidden. A nested Collection such as `/topics/info` remains browsable. `/collections` and `/exhibitions` are reserved application tabs.

## Manifest viewers

A Manifest is an exhibition only when its `behavior` array contains the exact value `exhibition`. Other values, including case variants, do not classify it as an exhibition.

After classification, exhibition behavior selects the preset in this order:

1. `slideshow`
2. `scroll`
3. the full-page exhibition viewer

Ordinary Manifests use `react-iiif-vault`'s `CanvasPanel` with its default paging and media behavior.

The Exhibitions tab comes from `/iiif/collections/exhibitions/collection.json`, generated during the HSS build. It links to each Manifest's canonical hierarchy URL; it does not create duplicate exhibition routes.

The homepage comes from `/iiif/collections/featured/collection.json`. A Manifest is included when its `behavior` contains the exact value `featured`; it may also be an exhibition. The Featured collection is build-indexed and updates on the next build.

## Runtime changes and rebuilds

Collection pages request only their own live remote Collection and display its direct references. New root-relative resources therefore appear in browsing immediately, and a new Manifest's live `behavior` chooses its viewer when visited. Non-root-relative dynamic children are resolved by walking only the requested ancestor chain.

The Exhibitions tab, sitemap metadata, prerendered SEO, and build-known breadcrumbs update on the next build. Post-build hierarchy routes hydrate through `404.html`; they receive route-specific prerendered metadata after rebuilding.

The published HSS tree uses output format 1. The application reads `meta/build.json`, `meta/resources.json`, `meta/resource-descriptors.json`, and per-resource runtime metadata. Store configuration, request credentials, source paths, and debug metadata stay private and are not copied into the deployed tree.

## Develop and build

```sh
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm build
pnpm preview
```

The build writes HSS artifacts and prerendered pages to `dist/client`, including `dist/client/iiif`, hierarchy pages, the Exhibitions page, and `404.html`.
It also writes a portal-contract v1 `deploy.json` at the configured site base. This public deployment record contains the build time, validated root/site pair, and available Git/CI provenance so the customer portal can show what is deployed. The host must serve it as JSON and allow cross-origin `GET` requests from the portal (or `*`).
`serve.json` also makes `pnpm dlx serve dist/client` use that fallback for post-build routes.

Production builds fail early when the marked info Collection or route service is missing, when the service source is not the configured root, or when the deployment base disagrees with the route-service target.

## Customization boundary

- `src/components/` contains UI and viewer presentation.
- `src/routes/` composes prepared page models into routes and metadata.
- `src/lib/site-data.ts` owns HSS, local indexing, network loading, URL resolution, and bounded fallback behavior.
- `iiif-config/` owns the remote store and build-time extraction.

## GitHub Pages

The included workflow deploys pushes to `main`. Repository variables:

- `SITE_BASE_PATH`: deployment base path. It defaults to `/<repository-name>/`; use `/` for a custom domain. It must match the route-service target path.
- `SITE_URL`: optional explicit deployment-origin override. When present, its origin plus `SITE_BASE_PATH` must equal the route-service target. Without it, the build reads the canonical target from the info Collection.

For a project Pages URL such as `https://example.github.io/my-site/`, use `SITE_URL=https://example.github.io` and `SITE_BASE_PATH=/my-site/`. For a custom domain, use its origin and set `SITE_BASE_PATH=/`.
