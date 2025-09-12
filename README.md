# Sitemap Proxy (Next.js)

A minimal Next.js app that proxies a Webflow sitemap, applies custom rules, and serves a final sitemap or a sitemap index if the number of URLs exceeds a configurable limit.

- Proxies from your Webflow site’s auto-generated `sitemap.xml`
- Removes entries that match glob patterns (supports `*` and `**`)
- Optionally adds extra URLs
- Optionally rewrites the domain of all URLs
- Splits the final set into multiple sub-sitemaps when the total exceeds the limit (default 45,000)
- Exposed under a basePath so you can host it at `/config` alongside your Webflow site

## How it works
1. Fetches the source sitemap from your Webflow site (`ORIGIN_DOMAIN`), parses it, and materializes entries.
2. Applies modifications in this order:
   - Remove URLs matching configured patterns
   - Add custom URLs
   - Replace origin domain with a new domain (optional)
3. If the final URL count is greater than the configured limit, returns a sitemap index listing chunked sub-sitemaps.

### Routes
- Sitemap index or single sitemap: `/config/sitemap.xml`
- Sub-sitemaps (when needed): `/config/sitemap/[n].xml` (e.g. `/config/sitemap/1.xml`)

> Note: The app’s basePath is `/config` (see `next.config.ts`). Adjust links accordingly if you change it.

## Configuration

### Environment variables
- `ORIGIN_DOMAIN` (required): The fully-qualified origin domain to proxy from. Example: `https://www.yourdomain.com`
- `SITEMAP_LIMIT` (optional): Integer; maximum URLs per sitemap file. Default: `45000`

### App configuration file
Edit `app/sitemap.xml/config.ts`:

- `getUrlsToRemove()`
  - Returns glob patterns to exclude from the sitemap
  - Patterns are combined with `ORIGIN_DOMAIN`
  - Glob syntax:
    - `*` matches any single path segment (no `/`)
    - `**` matches across segments (including `/`)
  - Examples (assuming `ORIGIN_DOMAIN=https://example.com`):
    - `"/work/*"` → matches `https://example.com/work/anything` (one segment)
    - `"/**/blog"` → matches any URL ending in `/blog` at any depth

- `getUrlsToAdd()`
  - Returns absolute or path-based URLs to add
  - Path-based URLs will be prefixed with `ORIGIN_DOMAIN`

- `getDomainToReplace()`
  - Return a fully-qualified domain (e.g., `https://www.newdomain.com`) to rewrite all URLs that start with `ORIGIN_DOMAIN`
  - Return `""` to disable

- `getSourceSitemapUrl()` / `getOriginDomain()` / `getSitemapLimit()`
  - Internal helpers that read from env and provide defaults

## Local development
```bash
npm install
npm run dev
```

Visit:
- `http://localhost:3000/config/sitemap.xml` → sitemap or sitemap index
- `http://localhost:3000/config/sitemap/1.xml` → first chunk (only if index is returned)

The basePath is set to `/config` in `next.config.ts`. If you change it, the routes and index links will change accordingly.

## Deploying
You can deploy wherever you host Next.js apps. To deploy alongside your Webflow site on Webflow Cloud, see the docs:

- Webflow Cloud overview: https://developers.webflow.com/webflow-cloud/intro

## Webflow project settings and robots.txt
- Keep Webflow’s auto-generated sitemap enabled (so the source `sitemap.xml` remains available at `ORIGIN_DOMAIN`).
- Disable the setting that auto-inserts the Webflow sitemap into `robots.txt`.
- Manually add a `robots.txt` line that points to this app’s sitemap (usually `https://yourdomain.com/config/sitemap.xml`). For example:
  ```
  Sitemap: https://yourdomain.com/config/sitemap.xml
  ```

## License
MIT — see `LICENSE.md`.
