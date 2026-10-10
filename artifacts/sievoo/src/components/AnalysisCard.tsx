import { useState, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, Copy, TrendingUp, AlertTriangle, ShieldCheck, MessageSquare, BadgeCheck } from 'lucide-react';
import { Analysis } from '@workspace/api-client-react';
import { useLikeAnalysis, getListAnalysesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatMoney } from '@/lib/format';
import { useLang } from '@/lib/i18n';

interface AnalysisCardProps {
  analysis: Analysis;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  const [, setLocation] = useLocation();
  const { t } = useLang();
  const cur = analysis.currency ?? null;
  const queryClient = useQueryClient();
  const [isLiking, setIsLiking] = useState(false);
  const likeMutation = useLikeAnalysis();

  const handleLike = () => {
    if (isLiking) return;
    setIsLiking(true);
    likeMutation.mutate({ id: analysis.id }, {
      onSuccess: (res) => {
        // Optimistically update all queries that contain this analysis
        queryClient.setQueriesData(
          { queryKey: ['/api/analyses'] }, // matches getListAnalysesQueryKey root
          (old: any) => {
            if (!old?.items) return old;
            return {
              ...old,
              items: old.items.map((item: Analysis) => 
                item.id === analysis.id ? { ...item, likes_count: res.likes_count } : item
              )
            };
          }
        );
      },
      onSettled: () => setIsLiking(false)
    });
  };

  const isSafe = analysis.margin_of_safety > 15;
  const isRisky = analysis.margin_of_safety < 0;

  const projectionYears = useMemo(() => {
    if (analysis.projection_years != null) return analysis.projection_years;
    try {
      const parsed = JSON.parse(analysis.full_inputs_json);
      return parsed?.inputs?.projectionYears ?? 5;
    } catch {
      return 5;
    }
  }, [analysis.projection_years, analysis.full_inputs_json]);

  return (
    <Card className="flex flex-col h-full bg-card border-border hover-elevate transition-all duration-300">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex justify-between items-start mb-2">
          <Link href={`/stock/${encodeURIComponent(analysis.ticker)}`}>
            <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-lg px-3 py-1 font-bold hover:bg-primary/30">
              {analysis.ticker}
            </Badge>
          </Link>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-foreground">
              {formatMoney(analysis.current_price, cur)}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">{t('Price', 'Kurs')}</div>
          </div>
        </div>
        <CardTitle className="text-xl font-bold leading-tight line-clamp-2">
          <Link href={`/analysis/${analysis.id}`} className="hover:text-primary transition-colors">
            {analysis.title}
          </Link>
        </CardTitle>
        <div className="flex flex-wrap items-center text-xs text-muted-foreground mt-2 font-mono">
          {analysis.user_id ? (
            <Link href={`/u/${analysis.user_id}`} className="inline-flex items-center gap-1 text-foreground/80 font-medium hover:text-primary">
              <BadgeCheck className="w-3.5 h-3.5 text-primary" />
              {analysis.author_alias}
            </Link>
          ) : (
            <span className="text-foreground/80 font-medium">@{analysis.author_alias}</span>
          )}
          <span className="mx-2">•</span>
          <span>{format(new Date(analysis.created_at), 'MMM d, yyyy')}</span>
          <span className="mx-2">•</span>
          <span>{projectionYears}-yr DCF</span>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 py-4">
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-background/50 rounded-md p-2 text-center border border-border/50">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Bear</div>
            <div className="font-mono text-sm whitespace-nowrap text-destructive font-semibold">{formatMoney(analysis.bear_dcf, cur)}</div>
          </div>
          <div className="bg-background/80 rounded-md p-2 text-center border border-primary/20 shadow-[0_0_10px_rgba(245,158,11,0.05)]">
            <div className="text-[10px] uppercase text-primary/80 mb-1 font-bold">Base</div>
            <div className="font-mono text-sm whitespace-nowrap text-foreground font-bold">{formatMoney(analysis.base_dcf, cur)}</div>
          </div>
          <div className="bg-background/50 rounded-md p-2 text-center border border-border/50">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Bull</div>
            <div className="font-mono text-sm whitespace-nowrap text-accent font-semibold">{formatMoney(analysis.bull_dcf, cur)}</div>
          </div>
        </div>

        <div className={`flex items-center justify-between p-3 rounded-md border ${
          isSafe ? 'bg-accent/10 border-accent/20' : 
          isRisky ? 'bg-destructive/10 border-destructive/20' : 
          'bg-muted/30 border-border'
        }`}>
          <div className="flex items-center gap-2">
            {isSafe ? <ShieldCheck className="w-5 h-5 text-accent" /> :
             isRisky ? <AlertTriangle className="w-5 h-5 text-destructive" /> :
             <TrendingUp className="w-5 h-5 text-primary" />}
            <span className="text-sm font-semibold uppercase tracking-wider text-foreground">{t('Margin of Safety', 'Sikkerhetsmargin')}</span>
          </div>
          <div className={`font-mono text-lg font-bold ${
            isSafe ? 'text-accent' : 
            isRisky ? 'text-destructive' : 
            'text-foreground'
          }`}>
            {analysis.margin_of_safety > 0 ? '+' : ''}{analysis.margin_of_safety.toFixed(1)}%
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t border-border/50 flex justify-between gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1 font-mono text-xs hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
          onClick={() => setLocation(`/calculator?fork=${analysis.id}`)}
          data-testid={`btn-fork-${analysis.id}`}
        >
          <Copy className="w-3.5 h-3.5 mr-2" />
          {t('Fork', 'Kopier')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs hover:bg-primary/10 hover:text-primary"
          onClick={() => setLocation(`/analysis/${analysis.id}`)}
          aria-label={t('Open discussion', 'Åpne diskusjonen')}
        >
          <MessageSquare className="w-3.5 h-3.5 mr-2" />
          {analysis.comments_count ?? 0}
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className={`font-mono text-xs ${likeMutation.isPending ? 'opacity-50' : 'hover:bg-accent/10 hover:text-accent'}`}
          onClick={handleLike}
          disabled={likeMutation.isPending}
          data-testid={`btn-like-${analysis.id}`}
        >
          <ThumbsUp className="w-3.5 h-3.5 mr-2" />
          {analysis.likes_count}
        </Button>
      </CardFooter>
    </Card>
  );
}
