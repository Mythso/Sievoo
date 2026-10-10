import { useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, ThumbsUp, Trash2, BadgeCheck } from 'lucide-react';
import { useGetAnalysis, getGetAnalysisQueryKey, useLikeAnalysis, useDeleteAnalysis } from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CommentsSection } from '@/components/community/CommentsSection';
import { ShareButtons } from '@/components/community/ShareButtons';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/auth';
import { formatMoney, formatPercent, mosClass } from '@/lib/format';
import { useLang } from '@/lib/i18n';

/** Shareable page for a single published analysis, with its discussion. */
export default function AnalysisDetail() {
  const { t } = useLang();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute('/analysis/:id');
  const id = Number(params?.id);
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data: a, isLoading } = useGetAnalysis(id, {
    query: { enabled: Number.isInteger(id) && id > 0, queryKey: getGetAnalysisQueryKey(id), retry: false },
  });
  const like = useLikeAnalysis();
  const del = useDeleteAnalysis();
  const [liked, setLiked] = useState(false);

  if (isLoading) {
    return <div className="flex-1 container mx-auto max-w-4xl px-4 py-24 text-center text-muted-foreground">{t('Loading...', 'Laster...')}</div>;
  }
  if (!a) {
    return (
      <div className="flex-1 container mx-auto max-w-4xl px-4 py-24 text-center space-y-4">
        <h1 className="text-2xl font-bold">{t('Analysis not found', 'Fant ikke analysen')}</h1>
        <Link href="/" className="text-primary hover:underline">{t('Back to the community feed', 'Tilbake til fellesskapet')}</Link>
      </div>
    );
  }

  const cur = a.currency ?? null;
  const isOwner = !!me && a.user_id === me.id;

  const onLike = () => {
    if (liked) return;
    like.mutate(
      { id: a.id },
      {
        onSuccess: (res) => {
          setLiked(true);
          queryClient.setQueryData(getGetAnalysisQueryKey(a.id), { ...a, likes_count: res.likes_count });
        },
      },
    );
  };

  const onDelete = () => {
    del.mutate(
      { id: a.id, data: {} },
      {
        onSuccess: () => {
          toast({ title: t('Analysis deleted', 'Analysen er slettet') });
          queryClient.invalidateQueries({ queryKey: ['/api/analyses'] });
          setLocation(me ? `/u/${me.id}` : '/');
        },
        onError: (err: any) =>
          toast({ title: t('Could not delete', 'Kunne ikke slette'), description: err?.data?.error, variant: 'destructive' }),
      },
    );
  };

  return (
    <div className="flex-1 container mx-auto max-w-4xl px-4 py-10 space-y-8">
      <Link href={`/stock/${encodeURIComponent(a.ticker)}`} className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" /> {t(`All ${a.ticker} valuations`, `Alle verdsettelser av ${a.ticker}`)}
      </Link>

      <Card className="bg-card border-border shadow-2xl">
        <CardContent className="p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2">
              <Link href={`/stock/${encodeURIComponent(a.ticker)}`}>
                <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-lg px-3 py-1 font-bold hover:bg-primary/30">{a.ticker}</Badge>
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">{a.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm font-mono text-muted-foreground">
                {a.user_id ? (
                  <Link href={`/u/${a.user_id}`} className="inline-flex items-center gap-1 text-foreground hover:text-primary">
                    <BadgeCheck className="w-4 h-4 text-primary" />
                    {a.author_alias}
                  </Link>
                ) : (
                  <span className="text-foreground">@{a.author_alias}</span>
                )}
                <span>·</span>
                <span>{format(new Date(a.created_at), 'MMM d, yyyy')}</span>
                <span>·</span>
                <span>{a.projection_years}-yr DCF</span>
              </div>
            </div>
            <div className="md:text-right">
              <div className="text-3xl font-mono font-bold">{formatMoney(a.current_price, cur)}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t('Price when published', 'Kurs ved publisering')}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('Bear', 'Bjørn'), value: a.bear_dcf, cls: 'text-destructive' },
              { label: t('Base', 'Basis'), value: a.base_dcf, cls: 'text-foreground' },
              { label: t('Bull', 'Okse'), value: a.bull_dcf, cls: 'text-accent' },
            ].map((x) => (
              <div key={x.label} className="rounded-lg border border-border bg-background/60 p-4 text-center">
                <div className="text-xs uppercase text-muted-foreground mb-1">{x.label}</div>
                <div className={`font-mono text-xl font-bold ${x.cls}`}>{formatMoney(x.value, cur)}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-4">
            <span className="text-sm font-semibold uppercase tracking-wider">{t('Margin of safety', 'Sikkerhetsmargin')}</span>
            <span className={`font-mono text-2xl font-bold ${mosClass(a.margin_of_safety)}`}>{formatPercent(a.margin_of_safety)}</span>
          </div>

          {a.user_notes && <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{a.user_notes}</p>}

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setLocation(`/calculator?fork=${a.id}`)} className="font-mono text-xs uppercase tracking-wider">
              <Copy className="w-4 h-4 mr-2" /> {t('Fork to calculator', 'Kopier til kalkulator')}
            </Button>
            <Button variant="outline" onClick={onLike} disabled={liked || like.isPending} className="font-mono text-xs">
              <ThumbsUp className="w-4 h-4 mr-2" /> {a.likes_count}
            </Button>
            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="font-mono text-xs text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" /> {t('Delete', 'Slett')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('Delete this analysis?', 'Slette denne analysen?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('It disappears from the feed, your profile and the leaderboard. This cannot be undone.', 'Den forsvinner fra strømmen, profilen din og topplisten. Dette kan ikke angres.')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('Cancel', 'Avbryt')}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>{t('Delete', 'Slett')}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <div className="space-y-2 border-t border-border pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('Share', 'Del')}</h2>
            <ShareButtons
              path={`/analysis/${a.id}`}
              text={`${a.ticker}: base case ${formatMoney(a.base_dcf, cur)} vs ${formatMoney(a.current_price, cur)} (${formatPercent(a.margin_of_safety)} margin of safety) - ${a.title}`}
            />
          </div>
        </CardContent>
      </Card>

      <CommentsSection analysisId={a.id} />
    </div>
  );
}
