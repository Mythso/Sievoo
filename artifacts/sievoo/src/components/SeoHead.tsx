import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { contentMap } from '@/pages/Article';

const SITE_URL = 'https://sievoo.com';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const DEFAULT_DESCRIPTION =
  'Free value-investing tools: DCF calculator, Graham Number screen, FIRE planner, portfolio allocation and an automated valuation watchlist. No narratives, only math.';

type PageMeta = {
  title: string;
  description: string;
  noindex?: boolean;
};

const ROUTE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Sievoo – DCF Valuation, Graham Number & Value Investing Tools',
    description: DEFAULT_DESCRIPTION,
  },
  '/calculator': {
    title: 'DCF Calculator – WACC, FCF & Terminal Value | Sievoo',
    description:
      'Value any stock with a full DCF model: CAPM/WACC, free cash flow projections, terminal value and Bear/Base/Bull scenarios, plus four quality gates.',
  },
  '/graham-calculator': {
    title: 'Graham Number Calculator & Defensive Investor Checklist | Sievoo',
    description:
      "Calculate the Graham Number and margin of safety for any stock, and run Benjamin Graham's seven-point defensive investor checklist.",
  },
  '/watchlist': {
    title: 'Value Investing Watchlist – Automated DCF & Graham Valuations | Sievoo',
    description:
      'Followed and trending companies, re-valued automatically with a DCF and the Graham Number. Track price against intrinsic value over time.',
  },
  '/fire': {
    title: 'FIRE Calculator – 4% Rule & 25x Expenses | Sievoo',
    description:
      'Plan financial independence with the 25x expenses rule, a 4% withdrawal simulation, Rule of 110 allocation and your estimated completion year.',
  },
  '/portfolio': {
    title: 'Portfolio Allocation Dashboard | Sievoo',
    description:
      'Compare actual vs. target weights from the Sievoo allocation formula, get live directives per position and track dry powder for rebalancing.',
  },
  '/academy': {
    title: 'Value Investing Academy – DCF, Graham & Margin of Safety | Sievoo',
    description:
      'Practical guides to DCF valuation, the Graham Number, margin of safety, Mr. Market, moats, asset allocation and the 4% rule.',
  },
  '/contact': {
    title: 'Contact | Sievoo',
    description: 'Get in touch with Sievoo with questions, feedback or ideas.',
  },
  '/about': {
    title: 'About Sievoo',
    description:
      'Sievoo is a numbers-driven toolkit for value investors: transparent valuation models, no narratives, only math.',
  },
  '/privacy': {
    title: 'Privacy Policy | Sievoo',
    description: 'How Sievoo collects, uses and protects your data.',
  },
  '/terms': {
    title: 'Terms of Service | Sievoo',
    description: 'The terms that apply when using Sievoo.',
  },
  '/disclaimer': {
    title: 'Disclaimer | Sievoo',
    description: 'Sievoo provides educational tools only and does not give investment advice.',
  },
  '/admin': { title: 'Admin | Sievoo', description: DEFAULT_DESCRIPTION, noindex: true },
  '/account': { title: 'Account | Sievoo', description: DEFAULT_DESCRIPTION, noindex: true },
};

const NOT_FOUND_META: PageMeta = {
  title: 'Page not found | Sievoo',
  description: DEFAULT_DESCRIPTION,
  noindex: true,
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max = 158): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

function resolveMeta(path: string): PageMeta {
  const exact = ROUTE_META[path];
  if (exact) return exact;

  const articleMatch = path.match(/^\/academy\/([^/]+)$/);
  if (articleMatch) {
    const article = contentMap[articleMatch[1]];
    if (article) {
      const firstParagraph = article.body.find((block) => block.startsWith('<p>'));
      return {
        title: `${article.title} | Sievoo Academy`,
        description: truncate(stripHtml(firstParagraph ?? article.title)),
      };
    }
  }

  return NOT_FOUND_META;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Keeps <title>, description, canonical, robots and Open Graph / Twitter tags
 * in sync with the current route. The static defaults live in index.html so
 * crawlers that do not run JavaScript still get sensible tags.
 */
export function SeoHead() {
  const [location] = useLocation();

  useEffect(() => {
    const path = location !== '/' ? location.replace(/\/+$/, '') : '/';
    const meta = resolveMeta(path);
    const url = `${SITE_URL}${path === '/' ? '/' : path}`;

    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'robots', meta.noindex ? 'noindex, nofollow' : 'index, follow');
    upsertCanonical(url);

    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', OG_IMAGE);
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:image', OG_IMAGE);
  }, [location]);

  return null;
}
