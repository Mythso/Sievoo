import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, Copy, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Analysis } from '@workspace/api-client-react';
import { useLikeAnalysis, getListAnalysesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface AnalysisCardProps {
  analysis: Analysis;
}

export function AnalysisCard({ analysis }: AnalysisCardProps) {
  const [, setLocation] = useLocation();
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

  return (
    <Card className="flex flex-col h-full bg-card border-border hover-elevate transition-all duration-300">
      <CardHeader className="pb-4 border-b border-border/50">
        <div className="flex justify-between items-start mb-2">
          <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-lg px-3 py-1 font-bold">
            {analysis.ticker}
          </Badge>
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-foreground">
              ${analysis.current_price.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Current Price</div>
          </div>
        </div>
        <CardTitle className="text-xl font-bold leading-tight line-clamp-2">
          {analysis.title}
        </CardTitle>
        <div className="flex items-center text-xs text-muted-foreground mt-2 font-mono">
          <span className="text-foreground/80 font-medium">@{analysis.author_alias}</span>
          <span className="mx-2">•</span>
          <span>{format(new Date(analysis.created_at), 'MMM d, yyyy')}</span>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 py-4">
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-background/50 rounded-md p-2 text-center border border-border/50">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Bear</div>
            <div className="font-mono text-destructive font-semibold">${analysis.bear_dcf.toFixed(2)}</div>
          </div>
          <div className="bg-background/80 rounded-md p-2 text-center border border-primary/20 shadow-[0_0_10px_rgba(245,158,11,0.05)]">
            <div className="text-[10px] uppercase text-primary/80 mb-1 font-bold">Base</div>
            <div className="font-mono text-foreground font-bold">${analysis.base_dcf.toFixed(2)}</div>
          </div>
          <div className="bg-background/50 rounded-md p-2 text-center border border-border/50">
            <div className="text-[10px] uppercase text-muted-foreground mb-1">Bull</div>
            <div className="font-mono text-accent font-semibold">${analysis.bull_dcf.toFixed(2)}</div>
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
            <span className="text-sm font-semibold uppercase tracking-wider text-foreground">Margin of Safety</span>
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
          Fork to Calculator
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
