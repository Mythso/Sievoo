import { Link } from 'wouter';
import { format } from 'date-fns';
import { Trophy, Scale, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShareButtons } from '@/components/community/ShareButtons';
import { useTrackRecord, type MethodStats } from '@/lib/community-api';
import { useMe } from '@/lib/auth';
import { formatPercent } from '@/lib/format';
import { useLang } from '@/lib/i18n';

function pct(v: number | null) {
  return v == null ? '—' : `${v.toFixed(0)}%`;
}

/**
 * Public accountability page: how the automated DCF and Graham Number calls
 * turned out against real prices, and a leaderboard of community analysts
 * scored the same way.
 */
export default function TrackRecord() {
  const { t } = useLang();
  const { data, isLoading } = useTrackRecord();
  const { data: me } = useMe();

  if (isLoading || !data) {
    return <div className="flex-1 container mx-auto max-w-6xl px-4 py-24 text-center text-muted-foreground">{t('Loading...', 'Laster...')}</div>;
  }

  const byHorizon = data.horizons.map((h) => ({
    horizon: h,
    dcf: data.methods.find((m) => m.method === 'dcf' && m.horizon_days === h) as MethodStats | undefined,
    graham: data.methods.find((m) => m.method === 'graham' && m.horizon_days === h) as MethodStats | undefined,
  }));
  const anyResults = data.methods.some((m) => m.calls > 0);
  const ranked = data.leaderboard.filter((e) => e.ranked);
  const upcoming = data.leaderboard.filter((e) => !e.ranked);

  const horizonLabel = (h: number) => (h >= 365 ? t('1 year', '1 år') : t(`${h} days`, `${h} dager`));

  return (
    <div className="flex-1 container mx-auto max-w-6xl px-4 py-12 space-y-10">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('Track record', 'Treffsikkerhet')}</h1>
        <p className="text-muted-foreground">
          {t(
            "Every valuation Sievoo makes is stored and never edited. Here we check them against what the stock actually did - for the automated DCF, for Benjamin Graham's formula, and for everyone who publishes analyses.",
            'Hver verdsettelse Sievoo gjør lagres og endres aldri. Her sjekker vi dem mot hva aksjen faktisk gjorde - for den automatiske DCF-en, for Benjamin Grahams formel og for alle som publiserer analyser.',
          )}
        </p>
        <p className="text-xs font-mono text-muted-foreground">
          {data.snapshots.toLocaleString()} {t('snapshots', 'målinger')} · {data.companies_tracked} {t('companies', 'selskaper')}
          {data.tracking_since && ` · ${t('since', 'siden')} ${format(new Date(data.tracking_since), 'MMM d, yyyy')}`}
        </p>
      </header>

      <Card className="bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" /> AutoDCF vs. Graham Number
          </CardTitle>
          <CardDescription>
            {t(
              'Hit rate = share of calls where the price then moved the way the valuation implied (up when undervalued, down when overvalued).',
              'Treffprosent = andel kall der kursen deretter beveget seg slik verdsettelsen tilsa (opp når undervurdert, ned når overvurdert).',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {!anyResults ? (
            <div className="p-8 text-sm text-muted-foreground flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              {t(
                `Results appear once valuations are at least ${data.min_call_age_days} days old. The clock is running.`,
                `Resultater vises når verdsettelsene er minst ${data.min_call_age_days} dager gamle. Klokka går.`,
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>{t('Horizon', 'Horisont')}</TableHead>
                  <TableHead className="text-right">{t('DCF hit rate', 'DCF-treff')}</TableHead>
                  <TableHead className="text-right hidden md:table-cell">{t('DCF: avg. return cheap / expensive', 'DCF: snittavkastning billig / dyr')}</TableHead>
                  <TableHead className="text-right">{t('Graham hit rate', 'Graham-treff')}</TableHead>
                  <TableHead className="text-right hidden md:table-cell">{t('Graham: avg. return cheap / expensive', 'Graham: snittavkastning billig / dyr')}</TableHead>
                  <TableHead className="text-right">{t('Calls (DCF / Graham)', 'Kall (DCF / Graham)')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byHorizon.map(({ horizon, dcf, graham }) => (
                  <TableRow key={horizon} className="border-border">
                    <TableCell className="font-mono">{horizonLabel(horizon)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-400">{pct(dcf?.hit_rate ?? null)}</TableCell>
                    <TableCell className="text-right font-mono text-xs hidden md:table-cell">
                      {formatPercent(dcf?.avg_return_when_undervalued)} / {formatPercent(dcf?.avg_return_when_overvalued)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-amber-400">{pct(graham?.hit_rate ?? null)}</TableCell>
                    <TableCell className="text-right font-mono text-xs hidden md:table-cell">
                      {formatPercent(graham?.avg_return_when_undervalued)} / {formatPercent(graham?.avg_return_when_overvalued)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{dcf?.calls ?? 0} / {graham?.calls ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> {t('Analyst leaderboard', 'Toppliste for analytikere')}
          </CardTitle>
          <CardDescription>
            {t(
              `Analyses published from an account are scored ${data.min_call_age_days}+ days later against Sievoo's own recorded prices - never the price the author typed in. ${data.min_calls_for_ranking} scored calls to get ranked.`,
              `Analyser publisert fra en konto måles ${data.min_call_age_days}+ dager senere mot Sievoos egne registrerte kurser - aldri kursen forfatteren skrev inn. ${data.min_calls_for_ranking} målte kall for å bli rangert.`,
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {ranked.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">
              {t('No one has enough scored calls yet - the first spots are open.', 'Ingen har nok målte kall ennå - de første plassene er ledige.')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{t('Analyst', 'Analytiker')}</TableHead>
                  <TableHead className="text-right">{t('Hit rate', 'Treff')}</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">{t('Avg. call return', 'Snittavkastning per kall')}</TableHead>
                  <TableHead className="text-right">{t('Scored', 'Målt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((e, i) => (
                  <TableRow key={e.user_id} className={`border-border ${me?.id === e.user_id ? 'bg-primary/5' : ''}`}>
                    <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Link href={`/u/${e.user_id}`} className="font-semibold hover:text-primary">{e.name}</Link>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-accent">{e.hit_rate.toFixed(0)}%</TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">{formatPercent(e.avg_call_return)}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{e.evaluated}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {upcoming.length > 0 && (
            <div className="border-t border-border p-4 text-xs text-muted-foreground">
              {t('On their way:', 'På vei:')}{' '}
              {upcoming.slice(0, 12).map((e, i) => (
                <span key={e.user_id}>
                  {i > 0 && ', '}
                  <Link href={`/u/${e.user_id}`} className="hover:text-foreground">{e.name}</Link> ({e.evaluated + e.pending})
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-xl border border-primary/30 bg-primary/5 p-6">
        <div>
          <h2 className="text-lg font-bold">{t('Put your name on the board', 'Sett navnet ditt på listen')}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              'Publish valuations from a free account. Every call is scored automatically - no screenshots, no hindsight.',
              'Publiser verdsettelser fra en gratis konto. Hvert kall måles automatisk - ingen skjermbilder, ingen etterpåklokskap.',
            )}
          </p>
        </div>
        <Button asChild className="font-mono text-xs uppercase tracking-wider shrink-0">
          <Link href={me ? '/calculator' : '/account?next=/calculator'}>{me ? t('Value a stock', 'Verdsett en aksje') : t('Create free account', 'Lag gratis konto')}</Link>
        </Button>
      </div>

      <ShareButtons path="/track-record" text="How accurate are DCF and Graham Number valuations? Sievoo checks every call against real prices." />
    </div>
  );
}
