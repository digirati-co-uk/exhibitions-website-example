# IIIF exhibition static site

A statically prerendered, React-hydrated exhibition website generated from a IIIF Presentation 3 Collection.

## Configure content

Edit `public/site.config.json`:

```json
{
  "collection": "https://example.org/exhibitions",
  "defaultLanguage": "en"
}
```

The root Collection must contain one Collection whose URL ends in `/info`. Its label, summary, logo and metadata describe the site. All other Manifest items are exhibitions; Collection items create nested group pages. Resource URLs become site paths from their final segment, preserving nesting.

Manifest `behavior` selects the viewer: `scroll` uses Scroll Exhibition, `slideshow` uses Delft Slideshow, and all other values use the full-page Delft Exhibition.

## Develop and build

```sh
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm build
pnpm preview
```

The build recursively discovers linked resources and writes prerendered HTML to `dist/client`. It also creates `404.html`, allowing GitHub Pages to hydrate live IIIF resources that were added after the build. Those live resources work immediately, but get route-specific SEO HTML only after the next build.

## GitHub Pages

The included workflow deploys pushes to `main`. Repository variables:

- `SITE_BASE_PATH`: optional base path. It defaults to `/<repository-name>/`; use `/` for a custom domain.
- `SITE_URL`: optional absolute public origin used for canonical URLs.

The collection remains runtime configuration in `site.config.json`; replacing that file changes the content source without recompiling the application code.
