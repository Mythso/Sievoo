import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

/**
 * Generates sitemap.xml from the source on every build, so new routes in
 * App.tsx and new Academy articles in pages/Article.tsx are picked up
 * automatically on the next deploy. At runtime, vite-plugin-seo.ts serves
 * /sitemap.xml with these static pages plus the dynamic ones from the API.
 */

const SITE_URL = 'https://sievoo.com';

// Routes that should never be indexed.
const EXCLUDED_PATHS = new Set(['/admin', '/account']);

function collectPaths(srcDir: string): string[] {
  const appSource = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf8');
  const articleSource = fs.readFileSync(path.join(srcDir, 'pages', 'Article.tsx'), 'utf8');

  // Static routes: <Route path="/x" ...>, skipping parameterised and excluded ones.
  const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((p) => !p.includes(':') && !EXCLUDED_PATHS.has(p));

  // Academy articles: top-level keys of contentMap ("  'slug': {").
  const mapSource = articleSource.slice(articleSource.indexOf('contentMap'));
  const slugs = [...mapSource.matchAll(/^ {2}['"]([a-z0-9-]+)['"]\s*:\s*\{/gm)].map((m) => m[1]);

  if (routes.length < 3 || slugs.length === 0) {
    throw new Error(
      `[sitemap] Parsed ${routes.length} routes and ${slugs.length} Academy articles — ` +
        'check that App.tsx and pages/Article.tsx still follow the expected format.',
    );
  }

  // Norwegian article versions (pages/article-content-no.ts), same key format.
  const noSource = fs.readFileSync(path.join(srcDir, 'pages', 'article-content-no.ts'), 'utf8');
  const noSlugs = [...noSource.matchAll(/^ {2}['"]([a-z0-9-]+)['"]\s*:\s*\{/gm)].map((m) => m[1]);

  const articlePaths = [...slugs.map((slug) => `/academy/${slug}`), ...noSlugs.map((slug) => `/no/academy/${slug}`)];
  const academyIndex = routes.indexOf('/academy');
  const paths =
    academyIndex === -1
      ? [...routes, ...articlePaths]
      : [...routes.slice(0, academyIndex + 1), ...articlePaths, ...routes.slice(academyIndex + 1)];

  return [...new Set(paths)];
}

function buildXml(paths: (string | { path: string; lastmod?: string | null })[]): string {
  const urls = paths
    .map((p) => {
      const entry = typeof p === 'string' ? { path: p, lastmod: null } : p;
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${SITE_URL}${entry.path}</loc>${lastmod}\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export { collectPaths, buildXml };

export function sitemapPlugin(srcDir: string): Plugin {
  return {
    name: 'sievoo-sitemap',
    generateBundle() {
      const paths = collectPaths(srcDir);
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildXml(paths) });
      this.info(`sitemap.xml generated with ${paths.length} URLs`);
    },
  };
}
