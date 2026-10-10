import { Link, useRoute } from 'wouter';
import { format } from 'date-fns';
import { keepPreviousData } from '@tanstack/react-query';
import { Trophy, Target, FileText, ThumbsUp, Clock } from 'lucide-react';
import { useListAnalyses, getListAnalysesQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AnalysisCard } from '@/components/AnalysisCard';
import { ShareButtons } from '@/components/community/ShareButtons';
import { useProfile } from '@/lib/community-api';
import { useMe } from '@/lib/auth';
import { formatMoney, formatPercent } from '@/lib/format';
import { useLang } from '@/lib/i18n';

/** Public profile: an account's published analyses and its scored track record. */
export default function Profile() {
  const { t } = useLang();
  const [, params] = useRoute('/u/:id');
  const id = Number(params?.id);
  const { data: me } = useMe();
  const { data: profile, isLoading } = useProfile(id);
  const listParams = { user_id: id, limit: 48, offset: 0, sort: 'newest' as const };
  const { data: analyses } = useListAnalyses(listParams, {
    query: { queryKey: getListAnalysesQueryKey(listParams), enabled: !!profile, placeholderData: keepPreviousData },
  });

  if (isLoading) {
    return <div className="flex-1 container mx-auto max-w-6xl px-4 py-24 text-center text-muted-foreground">{t('Loading...', 'Laster...')}</div>;
  }
  if (!profile) {
    return <div className="flex-1 container mx-auto max-w-6xl px-4 py-24 text-center">{t('Profile not found.', 'Fant ikke profilen.')}</div>;
  }

  const track = profile.track;
  const isMe = me?.id === profile.id;

  const stats = [
    { icon: FileText, label: t('Analyses', 'Analyser'), value: String(profile.analyses_count) },
    { icon: ThumbsUp, label: t('Likes received', 'Likes mottatt'), value: String(profile.total_likes) },
    {
      icon: Target,
      label: t('Hit rate', 'Treffprosent'),
      value: track && track.evaluated > 0 ? `${track.hit_rate.toFixed(0)}%` : '—',
      sub: track && track.evaluated > 0 ? t(`${track.hits} of ${track.evaluated} calls`, `${track.hits} av ${track.evaluated} kall`) : undefined,
    },
    {
      icon: Trophy,
      label: t('Leaderboard', 'Toppliste'),
      value: track?.rank ? `#${track.rank}` : '—',
      sub: track && !track.rank ? t(`Needs ${track.min_calls_for_ranking} scored calls`, `Trenger ${track.min_calls_for_ranking} målte kall`) : undefined,
    },
  ];

  return (
    <div className="flex-1 container mx-auto max-w-6xl px-4 py-12 space-y-10">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{profile.name}</h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">
            {t('Member since', 'Medlem siden')} {format(new Date(profile.created_at), 'MMMM yyyy')}
            {track && track.pending > 0 && (
              <span className="ml-3 inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t(`${track.pending} call(s) waiting to be scored`, `${track.pending} kall venter på måling`)}
              </span>
            )}
          </p>
        </div>
        {isMe && (
          <Button asChild variant="outline" className="font-mono text-xs uppercase">
            <Link href="/account">{t('Edit profile', 'Rediger profil')}</Link>
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-1">
              <Icon className="w-3.5 h-3.5" /> {label}
            </div>
            <div className="text-2xl font-mono font-bold">{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
          </div>
        ))}
      </div>

      {profile.calls.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>{t('Scored calls', 'Målte kall')}</CardTitle>
            <CardDescription>
              {t(
                "Positive margin of safety = bullish call. Start price is Sievoo's own recorded price nearest the publish date, compared with the latest price at least 30 days later.",
                'Positiv sikkerhetsmargin = kjøpssignal. Startkursen er Sievoos egen registrerte kurs nærmest publiseringsdatoen, sammenlignet med siste kurs minst 30 dager senere.',
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Ticker</TableHead>
                  <TableHead>{t('Published', 'Publisert')}</TableHead>
                  <TableHead>{t('Call', 'Kall')}</TableHead>
                  <TableHead className="text-right">{t('Then → now', 'Da → nå')}</TableHead>
                  <TableHead className="text-right">{t('Result', 'Resultat')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.calls.map((c) => (
                  <TableRow key={c.analysis_id} className="border-border">
                    <TableCell className="font-mono font-bold">
                      <Link href={`/analysis/${c.analysis_id}`} className="hover:text-primary">{c.ticker}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{format(new Date(c.published_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className={c.bullish ? 'text-accent' : 'text-destructive'}>{c.bullish ? t('Undervalued', 'Undervurdert') : t('Overvalued', 'Overvurdert')}</TableCell>
                    <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                      {formatMoney(c.price_then, c.currency)} → {formatMoney(c.price_now, c.currency)} ({formatPercent(c.return_pct)})
                    </TableCell>
                    <TableCell className={`text-right font-mono font-bold ${c.hit ? 'text-accent' : 'text-destructive'}`}>
                      {c.hit ? t('Hit', 'Treff') : t('Miss', 'Bom')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">{t('Published analyses', 'Publiserte analyser')}</h2>
        {!analyses || analyses.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {isMe ? (
              <>
                {t('You have not published anything yet.', 'Du har ikke publisert noe ennå.')}{' '}
                <Link href="/calculator" className="text-primary hover:underline">{t('Value a stock →', 'Verdsett en aksje →')}</Link>
              </>
            ) : (
              t('Nothing published yet.', 'Ingenting publisert ennå.')
            )}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analyses.items.map((a) => (
              <AnalysisCard key={a.id} analysis={a} />
            ))}
          </div>
        )}
      </section>

      {profile.analyses_count > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Share profile', 'Del profilen')}</h2>
          <ShareButtons path={`/u/${profile.id}`} text={`${profile.name}'s value investing track record on Sievoo`} />
        </section>
      )}
    </div>
  );
}
