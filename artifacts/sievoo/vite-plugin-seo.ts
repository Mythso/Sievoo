import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

import { buildXml, collectPaths } from './vite-plugin-sitemap';

/**
 * Server-side SEO for the dynamic, data-driven pages (/stock/:ticker,
 * /stocks, /analysis/:id, /u/:id, /track-record).
 *
 * The app is a client-rendered SPA served by `vite preview`, so without
 * this every crawler and link-preview bot (X, Reddit, Slack, Facebook,
 * LinkedIn...) would see the generic homepage title and share image for
 * every URL. For those routes this middleware asks the API
 * (GET /api/seo/render) for the page's title, description, canonical URL,
 * share image and a plain-HTML version of its content, and injects them
 * into index.html. React replaces the injected content once it boots.
 *
 * It also serves /sitemap.xml with the static pages (from the build-time
 * sitemap) plus every tracked stock, published analysis and active
 * profile (GET /api/seo/sitemap), so new pages get crawled without a deploy.
 *
 * Everything fails open: if the API is slow or down, the normal SPA shell
 * is served.
 */

const DYNAMIC_ROUTE = /^\/(stocks|track-record|stock\/[A-Za-z0-9.\-%]+|analysis\/\d+|u\/\d+)\/?$/;
const API_TIMEOUT_MS = 2500;
const SITEMAP_TTL_MS = 15 * 60 * 1000;

interface SeoPage {
  status: number;
  title: string;
  description: string;
  canonical: string;
  image: string;
  noindex?: boolean;
  html: string;
}

function attr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setMeta(html: string, attrName: 'name' | 'property', key: string, content: string): string {
  const tag = `<meta ${attrName}="${key}" content="${attr(content)}" />`;
  const re = new RegExp(`<meta\\s+${attrName}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`);
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

export function injectSeo(template: string, page: SeoPage, requestPath: string): string {
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(page.title)}</title>`);
  html = setMeta(html, 'name', 'description', page.description);
  html = setMeta(html, 'name', 'robots', page.noindex ? 'noindex, follow' : 'index, follow');
  html = html.replace(/<link\s+rel="canonical"[^>]*>/, `<link rel="canonical" href="${attr(page.canonical)}" />`);
  html = setMeta(html, 'property', 'og:title', page.title);
  html = setMeta(html, 'property', 'og:description', page.description);
  html = setMeta(html, 'property', 'og:url', page.canonical);
  html = setMeta(html, 'property', 'og:image', page.image);
  html = setMeta(html, 'property', 'og:image:alt', page.title);
  html = setMeta(html, 'name', 'twitter:title', page.title);
  html = setMeta(html, 'name', 'twitter:description', page.description);
  html = setMeta(html, 'name', 'twitter:image', page.image);
  // Tells SeoHead (client) that the tags above already match this path.
  html = setMeta(html, 'name', 'sievoo-ssr-path', requestPath.replace(/\/+$/, '') || '/');
  return html.replace('<div id="root"></div>', `<div id="root">${page.html}</div>`);
}

async function fetchJson<T>(url: string): Promise<{ status: number; body: T | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (res.status === 204) return { status: 204, body: null };
    return { status: res.status, body: res.ok ? ((await res.json()) as T) : null };
  } finally {
    clearTimeout(timer);
  }
}

type Middleware = (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void;

function createMiddleware(opts: { srcDir: string; getTemplate: (url: string) => Promise<string | null> }): Middleware {
  const apiBase = process.env.API_URL?.replace(/\/+$/, '') ?? null;
  let sitemapCache: { xml: string; expiresAt: number } | null = null;

  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/sitemap.xml') {
      (async () => {
        if (!sitemapCache || sitemapCache.expiresAt < Date.now()) {
          const staticPaths = collectPaths(opts.srcDir);
          let dynamic: { path: string; lastmod: string | null }[] = [];
          if (apiBase) {
            try {
              const { body } = await fetchJson<{ entries: { path: string; lastmod: string | null }[] }>(`${apiBase}/api/seo/sitemap`);
              dynamic = body?.entries ?? [];
            } catch {
              // fall back to static pages only
            }
          }
          sitemapCache = { xml: buildXml([...staticPaths, ...dynamic]), expiresAt: Date.now() + (dynamic.length ? SITEMAP_TTL_MS : 60_000) };
        }
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=900');
        res.end(req.method === 'HEAD' ? undefined : sitemapCache.xml);
      })().catch(next);
      return;
    }

    if (!DYNAMIC_ROUTE.test(pathname)) return next();

    (async () => {
      const template = await opts.getTemplate(req.url ?? pathname);
      if (!template) return next();

      let html = template;
      let status = 200;
      if (apiBase) {
        try {
          const { status: apiStatus, body } = await fetchJson<SeoPage>(
            `${apiBase}/api/seo/render?path=${encodeURIComponent(pathname)}`,
          );
          if (apiStatus === 200 && body) {
            html = injectSeo(template, body, pathname);
            status = body.status;
          }
        } catch {
          // API slow/unavailable - serve the plain SPA shell
        }
      }

      res.statusCode = status;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.end(req.method === 'HEAD' ? undefined : html);
    })().catch(next);
  };
}

export function seoPlugin(srcDir: string): Plugin {
  return {
    name: 'sievoo-seo',
    // `vite preview` (production on Railway): serve the built index.html.
    configurePreviewServer(server: PreviewServer) {
      const indexPath = path.join(server.config.build.outDir, 'index.html');
      let cached: string | null = null;
      server.middlewares.use(
        createMiddleware({
          srcDir,
          getTemplate: async () => {
            if (cached == null && fs.existsSync(indexPath)) cached = fs.readFileSync(indexPath, 'utf8');
            return cached;
          },
        }),
      );
    },
    // `vite dev`: same behaviour, with the dev-transformed index.html.
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        createMiddleware({
          srcDir,
          getTemplate: async (url) => {
            const raw = fs.readFileSync(path.join(server.config.root, 'index.html'), 'utf8');
            return server.transformIndexHtml(url, raw);
          },
        }),
      );
    },
  };
}
