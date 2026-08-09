import { useState } from 'react';
import { useListAnalyses, useGetCommunityStats } from '@workspace/api-client-react';
import { ListAnalysesSort } from '@workspace/api-client-react';
import { AnalysisCard } from '@/components/AnalysisCard';
import { SievooLogo } from '@/components/SievooLogo';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Loader2, ArrowRight, BarChart3, Users, Target } from 'lucide-react';
import { Link } from 'wouter';
import { useDebounce } from '@/hooks/use-debounce';

export default function Home() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [sort, setSort] = useState<ListAnalysesSort>(ListAnalysesSort.newest);
  const [page, setPage] = useState(1);
  const limit = 12;

  const { data: stats, isLoading: statsLoading } = useGetCommunityStats();
  
  const { data: analysesData, isLoading: analysesLoading } = useListAnalyses(
    { 
      sort, 
      ticker: debouncedSearch || undefined, 
      limit, 
      offset: (page - 1) * limit 
    },
    { query: { keepPreviousData: true } }
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-background pt-20 pb-16 border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
        
        <div className="container mx-auto max-w-7xl px-4 relative z-10">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className="w-20 h-20 mb-8 bg-card rounded-2xl p-4 border border-border shadow-2xl flex items-center justify-center">
              <SievooLogo className="w-full h-full text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              The Intelligent <span className="text-primary">Quality Sieve</span> <br className="hidden md:block"/> for Investors.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
              Stress-test stocks using professional DCF methodology, rigorous quality gates, and a numbers-driven community. Leave the narratives behind.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <Button asChild size="lg" className="font-mono text-sm uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8">
                <Link href="/calculator">
                  Run Valuation Engine <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="font-mono text-sm uppercase tracking-wider h-14 px-8 bg-card border-border hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors">
                <Link href="/portfolio">
                  Check Portfolio Allocation
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Community Stats Bar */}
      <section className="bg-card border-b border-border py-4">
        <div className="container mx-auto max-w-7xl px-4">
          {statsLoading ? (
            <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : stats ? (
            <div className="flex flex-wrap items-center justify-between gap-6 text-sm font-mono">
              <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded border border-border">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground uppercase">Analyses</span>
                <span className="font-bold text-foreground">{stats.total_analyses.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded border border-border">
                <Users className="w-4 h-4 text-accent" />
                <span className="text-muted-foreground uppercase">Likes</span>
                <span className="font-bold text-foreground">{stats.total_likes.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3 bg-background/50 px-4 py-2 rounded border border-border flex-1 min-w-[250px]">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground uppercase">Trending Tickers</span>
                <div className="flex gap-2 overflow-x-auto">
                  {stats.top_tickers.map((t) => (
                    <button 
                      key={t.ticker} 
                      onClick={() => setSearch(t.ticker)}
                      className="bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {t.ticker}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 py-12 container mx-auto max-w-7xl px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Community Terminal</h2>
            <p className="text-muted-foreground text-sm mt-1">Peer-reviewed DCF valuations and stress-tests.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search ticker..." 
                className="pl-9 bg-card font-mono uppercase"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value.toUpperCase());
                  setPage(1);
                }}
              />
            </div>
            <Select 
              value={sort} 
              onValueChange={(val) => {
                setSort(val as ListAnalysesSort);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px] bg-card font-mono text-xs uppercase tracking-wider">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ListAnalysesSort.newest}>Newest</SelectItem>
                <SelectItem value={ListAnalysesSort.most_liked}>Most Liked</SelectItem>
                <SelectItem value={ListAnalysesSort.margin_of_safety}>Highest Margin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ad Zone Placeholder */}
        <div className="w-full bg-card/50 border border-border/50 border-dashed rounded-lg p-4 mb-8 flex items-center justify-center min-h-[90px]">
          <span className="text-muted-foreground/40 font-mono text-xs tracking-widest">[ ADVERTISEMENT ZONE ]</span>
        </div>

        {analysesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="h-[300px] rounded-xl bg-card animate-pulse border border-border/50"></div>
            ))}
          </div>
        ) : analysesData?.items.length === 0 ? (
          <div className="text-center py-24 bg-card/30 rounded-xl border border-border border-dashed">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold mb-2">No analyses found</h3>
            <p className="text-muted-foreground text-sm">
              {search ? `No results for ticker ${search}` : 'Be the first to publish an analysis.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
              {analysesData?.items.map(analysis => (
                <AnalysisCard key={analysis.id} analysis={analysis} />
              ))}
            </div>

            {/* Pagination */}
            {analysesData && analysesData.total > limit && (
              <div className="flex justify-center items-center gap-4 border-t border-border pt-8">
                <Button 
                  variant="outline" 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="font-mono"
                >
                  Previous
                </Button>
                <span className="font-mono text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(analysesData.total / limit)}
                </span>
                <Button 
                  variant="outline" 
                  disabled={page >= Math.ceil(analysesData.total / limit)}
                  onClick={() => setPage(p => p + 1)}
                  className="font-mono"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
