import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { contentMap } from '@/pages/Article';
import { contentMapNo } from '@/pages/article-content-no';

const SITE_URL = 'https://sievoo.com';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const DEFAULT_DESCRIPTION =
  'Free value-investing tools: DCF calculator, Graham Number screen, FIRE planner, portfolio allocation and an automated valuation watchlist. No narratives, only math.';

type PageMeta = {
  title: string;
  description: string;
  noindex?: boolean;
  image?: string;
  /** hreflang alternates: [langCode, path] */
  alternates?: [string, string][];
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
  '/stocks': {
    title: 'Stock Valuations – DCF & Graham Number for US and Oslo Børs Stocks | Sievoo',
    description:
      'Intrinsic value estimates for US and Oslo Børs stocks: discounted cash flow, Graham Number and margin of safety, re-calculated automatically every week.',
    image: `${SITE_URL}/api/og/page/stocks.png`,
  },
  '/track-record': {
    title: 'Track Record: How Accurate Are DCF and Graham Valuations? | Sievoo',
    description:
      'Every Sievoo valuation is stored and checked against what the stock actually did 30, 90 and 365 days later - for the automated DCF, the Graham Number and every community analyst.',
    image: `${SITE_URL}/api/og/page/track-record.png`,
  },
  '/no/academy': {
    title: 'Sievoo Akademi – DCF, Graham-tallet og sikkerhetsmargin',
    description:
      'Praktiske guider på norsk om DCF-verdsettelse, Graham-tallet, sikkerhetsmargin, Mr. Market, vollgraver, aktivaallokering og 4 %-regelen.',
    alternates: [['en', '/academy'], ['nb', '/no/academy']],
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
    alternates: [['en', '/academy'], ['nb', '/no/academy']],
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

  const articleMatch = path.match(/^\/(no\/)?academy\/([^/]+)$/);
  if (articleMatch) {
    const isNo = !!articleMatch[1];
    const slug = articleMatch[2];
    const article = isNo ? contentMapNo[slug] : contentMap[slug];
    if (article) {
      const firstParagraph = article.body.find((block) => block.startsWith('<p>'));
      const alternates: [string, string][] = [];
      if (contentMap[slug]) alternates.push(['en', `/academy/${slug}`]);
      if (contentMapNo[slug]) alternates.push(['nb', `/no/academy/${slug}`]);
      return {
        title: `${article.title} | ${isNo ? 'Sievoo Akademi' : 'Sievoo Academy'}`,
        description: truncate(stripHtml(firstParagraph ?? article.title)),
        alternates,
      };
    }
  }

  // Dynamic pages: the server injects the exact title/description for
  // these (see vite-plugin-seo.ts); this is the client-side fallback used
  // when navigating inside the app.
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/stock\/([^/]+)$/))) {
    const ticker = decodeURIComponent(m[1]).toUpperCase();
    return {
      title: `${ticker} Intrinsic Value – DCF & Graham Number | Sievoo`,
      description: `${ticker} fair value estimate: automated DCF, Graham Number, margin of safety and full valuation history, plus community analyses.`,
      image: `${SITE_URL}/api/og/stock/${encodeURIComponent(ticker)}.png`,
    };
  }
  if ((m = path.match(/^\/analysis\/(\d+)$/))) {
    return {
      title: 'Community Stock Analysis | Sievoo',
      description: 'A published DCF valuation with bear, base and bull cases, margin of safety and discussion.',
      image: `${SITE_URL}/api/og/analysis/${m[1]}.png`,
    };
  }
  if ((m = path.match(/^\/u\/(\d+)$/))) {
    return {
      title: 'Value Investor Profile | Sievoo',
      description: 'Published valuations and a track record scored against real prices.',
      image: `${SITE_URL}/api/og/user/${m[1]}.png`,
    };
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

function setAlternates(alternates: [string, string][] | undefined) {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
  if (!alternates || alternates.length < 2) return;
  for (const [lang, path] of alternates) {
    const el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', lang);
    el.setAttribute('href', `${SITE_URL}${path}`);
    document.head.appendChild(el);
  }
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

    // On a first page load the server already wrote exact tags for this
    // path (dynamic pages); keep them instead of overwriting with the
    // generic client-side fallback.
    const ssr = document.head.querySelector<HTMLMetaElement>('meta[name="sievoo-ssr-path"]');
    if (ssr) {
      const ssrPath = ssr.getAttribute('content');
      ssr.remove();
      if (ssrPath === path) return;
    }

    const meta = resolveMeta(path);
    const image = meta.image ?? OG_IMAGE;
    const url = `${SITE_URL}${path === '/' ? '/' : path}`;

    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('name', 'robots', meta.noindex ? 'noindex, nofollow' : 'index, follow');
    upsertCanonical(url);

    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', image);
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:image', image);
    upsertMeta('property', 'og:locale', path.startsWith('/no/') ? 'nb_NO' : 'en_US');
    setAlternates(meta.alternates);
  }, [location]);

  return null;
}
