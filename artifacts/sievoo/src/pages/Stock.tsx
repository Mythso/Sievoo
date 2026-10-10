import { Link, useRoute } from 'wouter';
import { format } from 'date-fns';
import { ArrowLeft, Calculator as CalcIcon, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnalysisCard } from '@/components/AnalysisCard';
import { ValuationHistoryChart } from '@/components/community/ValuationHistoryChart';
import { ShareButtons } from '@/components/community/ShareButtons';
import { FollowButton } from '@/components/community/FollowButton';
import { useStock } from '@/lib/community-api';
import { ApiError } from '@/lib/auth';
import { formatMoney, formatPercent, mosClass } from '@/lib/format';
import { useLang } from '@/lib/i18n';

function Stat({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-mono font-bold ${className ?? ''}`}>{value}</div>
      {sub && <div className="text-xs font-mono text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

/**
 * Public page per tracked ticker: latest AutoDCF / AutoValue numbers, the
 * full valuation history, community analyses of the ticker, alerts and
 * share links. The server renders the same content for crawlers.
 */
export default function Stock() {
  const { t } = useLang();
  const [, params] = useRoute('/stock/:ticker');
  const ticker = decodeURIComponent(params?.ticker ?? '').toUpperCase();
  const { data, isLoading, error } = useStock(ticker);

  if (isLoading) {
    return <div className="flex-1 container mx-auto max-w-6xl px-4 py-24 text-center text-muted-foreground">{t('Loading...', 'Laster...')}</div>;
  }

  if (!data) {
    const notTracked = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex-1 container mx-auto max-w-3xl px-4 py-24 text-center space-y-4">
        <h1 className="text-3xl font-bold font-mono">{ticker}</h1>
        <p className="text-muted-foreground">
          {notTracked
            ? t(
                `${ticker} isn't tracked yet. Publish an analysis of it while logged in and Sievoo starts valuing it automatically every week.`,
                `${ticker} følges ikke ennå. Publiser en analyse av den mens du er innlogget, så begynner Sievoo å verdsette den automatisk hver uke.`,
              )
            : t('Could not load this stock right now.', 'Kunne ikke laste aksjen akkurat nå.')}
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild>
            <Link href={`/calculator?ticker=${encodeURIComponent(ticker)}`}>{t('Value it yourself', 'Verdsett den selv')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/stocks">{t('Browse tracked stocks', 'Se aksjene vi følger')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const s = data.stock;
  const cur = s.currency;
  const name = s.company_name ?? s.ticker;
  const calcHref = data.published_analysis_id
    ? `/calculator?fork=${data.published_analysis_id}`
    : `/calculator?ticker=${encodeURIComponent(s.ticker)}`;

  return (
    <div className="flex-1 container mx-auto max-w-6xl px-4 py-10 space-y-8">
      <Link href="/stocks" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" /> {t('All stocks', 'Alle aksjer')}
      </Link>

      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl md:text-5xl font-bold font-mono tracking-tight">{s.ticker}</h1>
            {s.market === 'oslo' && <Badge variant="outline" className="font-mono">Oslo Børs</Badge>}
          </div>
          <p className="text-lg text-muted-foreground">
            {name} · {t('intrinsic value estimate', 'estimat av egenverdi')}
          </p>
          {s.computed_at && (
            <p className="text-xs font-mono text-muted-foreground mt-1">
              {t('Updated', 'Oppdatert')} {format(new Date(s.computed_at), 'MMM d, yyyy')} · {s.runs}{' '}
              {t('valuation runs recorded', 'verdsettelser lagret')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <FollowButton ticker={s.ticker} follow={data.my_follow} followers={data.followers} />
          <Button asChild className="font-mono text-xs uppercase tracking-wider">
            <Link href={calcHref}>
              <CalcIcon className="w-4 h-4 mr-2" /> {t('Run your own DCF', 'Lag din egen DCF')}
            </Link>
          </Button>
        </div>
      </header>

      {s.price == null ? (
        <Card className="bg-card border-border">
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('The first valuation run for this ticker has not completed yet.', 'Den første verdsettelsen av denne tickeren er ikke ferdig ennå.')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t('Price', 'Kurs')} value={formatMoney(s.price, cur)} />
          <Stat
            label={t('DCF value (base)', 'DCF-verdi (basis)')}
            value={formatMoney(s.base_dcf, cur)}
            sub={`${t('Bear', 'Bjørn')} ${formatMoney(s.bear_dcf, cur)} · ${t('Bull', 'Okse')} ${formatMoney(s.bull_dcf, cur)}`}
            className="text-emerald-400"
          />
          <Stat
            label={t('DCF margin of safety', 'DCF-sikkerhetsmargin')}
            value={formatPercent(s.margin_of_safety)}
            className={mosClass(s.margin_of_safety)}
          />
          <Stat
            label="Graham Number"
            value={formatMoney(s.graham_number, cur)}
            sub={`${t('Margin', 'Margin')} ${formatPercent(s.graham_margin_of_safety)}`}
            className="text-amber-400"
          />
        </div>
      )}

      {data.history.length > 0 && (
        <Card className="bg-card border-border shadow-xl">
          <CardHeader className="border-b border-border/50">
            <CardTitle>{t('Price vs. value over time', 'Kurs mot verdi over tid')}</CardTitle>
            <CardDescription>
              {t(
                "Every stored run, never overwritten - so you can judge for yourself which method called it right.",
                'Hver lagrede kjøring, aldri overskrevet - så du selv kan vurdere hvilken metode som traff.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ValuationHistoryChart points={data.history} currency={cur} />
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{t(`Community analyses of ${s.ticker}`, `Analyser av ${s.ticker} fra fellesskapet`)}</h2>
            <p className="text-sm text-muted-foreground">
              {t(
                'Fork any of them into the calculator, change the assumptions and publish your own take.',
                'Ta en kopi inn i kalkulatoren, endre forutsetningene og publiser ditt eget syn.',
              )}
            </p>
          </div>
        </div>
        {data.analyses.length === 0 ? (
          <Card className="bg-card/30 border-dashed border-border">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t(`No one has published a ${s.ticker} analysis yet.`, `Ingen har publisert en analyse av ${s.ticker} ennå.`)}{' '}
              <Link href={calcHref} className="text-primary hover:underline">
                {t('Be the first →', 'Bli den første →')}
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.analyses.map((a) => (
              <AnalysisCard key={a.id} analysis={a} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">{t(`Share ${s.ticker}`, `Del ${s.ticker}`)}</h2>
        <ShareButtons
          path={`/stock/${encodeURIComponent(s.ticker)}`}
          text={
            s.price != null
              ? `${name} (${s.ticker}): DCF ${formatMoney(s.base_dcf, cur)} vs price ${formatMoney(s.price, cur)} (${formatPercent(s.margin_of_safety)} margin of safety)`
              : `${name} (${s.ticker}) valuation on Sievoo`
          }
        />
      </section>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ExternalLink className="w-3 h-3" />
        {t(
          'Automated estimate from public market data (Yahoo Finance). Figures reported in another currency are converted to the trading currency. Not investment advice.',
          'Automatisk estimat fra offentlige markedsdata (Yahoo Finance). Tall rapportert i en annen valuta er omregnet til handelsvalutaen. Ikke investeringsråd.',
        )}
      </p>
    </div>
  );
}
