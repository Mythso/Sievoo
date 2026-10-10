import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { List, TrendingUp } from 'lucide-react';
import { formatMoney } from '@/lib/format';
import { ValuationHistoryChart } from '@/components/community/ValuationHistoryChart';

interface WatchlistValuation {
  price: number | null;
  base_dcf: number | null;
  bear_dcf: number | null;
  bull_dcf: number | null;
  margin_of_safety: number | null;
  graham_number: number | null;
  graham_margin_of_safety: number | null;
  currency?: string | null;
  status: 'ok' | 'error';
  computed_at: string;
}

interface WatchlistCompany {
  id: number;
  ticker: string;
  company_name: string | null;
  added_at: string;
  latest_valuation: WatchlistValuation | null;
}

interface WatchlistHistoryPoint {
  computed_at: string;
  price: number | null;
  bear_dcf: number | null;
  base_dcf: number | null;
  bull_dcf: number | null;
  margin_of_safety: number | null;
  graham_number: number | null;
  graham_margin_of_safety: number | null;
}

interface WatchlistHistoryData {
  id: number;
  ticker: string;
  company_name: string | null;
  points: WatchlistHistoryPoint[];
}

function fmt(value: number | null | undefined, currency?: string | null) {
  return formatMoney(value, currency);
}

export default function Watchlist() {
  const [companies, setCompanies] = useState<WatchlistCompany[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoadingCompanies(true);
      try {
        const res = await fetch('/api/watchlist');
        if (!res.ok) throw new Error('Failed to load watchlist');
        const data = await res.json();
        setCompanies(data.items ?? []);
      } catch {
        setCompanies([]);
      } finally {
        setIsLoadingCompanies(false);
      }
    })();
  }, []);

  return (
    <div className="flex-1 container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Watchlist</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Companies followed and automatically re-valued on a schedule (AutoDCF + AutoValue), with a full
          history of every past run.
        </p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies" className="font-mono uppercase text-xs tracking-wider">
            <List className="w-4 h-4 mr-2" /> Companies
          </TabsTrigger>
          <TabsTrigger value="history" className="font-mono uppercase text-xs tracking-wider">
            <TrendingUp className="w-4 h-4 mr-2" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-6">
          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="border-b border-border/50">
              <CardTitle>Followed Companies</CardTitle>
              <CardDescription>Latest AutoDCF and AutoValue (Graham Number) run per ticker.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Ticker</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">AutoDCF (Base)</TableHead>
                    <TableHead className="text-right">AutoValue (Graham)</TableHead>
                    <TableHead className="text-right">Margin of Safety</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCompanies ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : companies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No companies on the watchlist yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    companies.map((c) => {
                      const v = c.latest_valuation;
                      return (
                        <TableRow key={c.id} className="border-border hover:bg-muted/10">
                          <TableCell className="font-mono font-bold">
                            <Link href={`/stock/${encodeURIComponent(c.ticker)}`} className="hover:text-primary">
                              {c.ticker}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.company_name ?? '\u2014'}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(v?.price, v?.currency)}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-400">{fmt(v?.base_dcf, v?.currency)}</TableCell>
                          <TableCell className="text-right font-mono text-amber-400">{fmt(v?.graham_number, v?.currency)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {v?.margin_of_safety != null ? (
                              <Badge variant={v.margin_of_safety > 0 ? 'default' : 'destructive'} className="font-mono">
                                {v.margin_of_safety.toFixed(1)}%
                              </Badge>
                            ) : (
                              '\u2014'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <HistoryTab companies={companies} isLoadingCompanies={isLoadingCompanies} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Public "History" tab: for a chosen watchlist company, plots every past
 * AutoDCF + AutoValue (Graham) run against the actual stock price on the
 * date it ran. Same data and chart as the admin Statistics tab, just
 * open to anyone - since every run is stored as its own row (never
 * overwritten), this lets visitors see whether the DCF or the Graham
 * Number ended up closer to reality over time.
 */
function HistoryTab({
  companies,
  isLoadingCompanies,
}: {
  companies: WatchlistCompany[];
  isLoadingCompanies: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [history, setHistory] = useState<WatchlistHistoryData | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (!selectedId && companies.length > 0) {
      setSelectedId(String(companies[0].id));
    }
  }, [companies, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setIsLoadingHistory(true);
      setHistory(null);
      try {
        const res = await fetch(`/api/watchlist/${selectedId}/history`);
        if (!res.ok) throw new Error('Failed to load history');
        const data: WatchlistHistoryData = await res.json();
        setHistory(data);
      } catch {
        setHistory(null);
      } finally {
        setIsLoadingHistory(false);
      }
    })();
  }, [selectedId]);

  const selected = companies.find((c) => String(c.id) === selectedId);
  const latest = history?.points[history.points.length - 1];

  return (
    <Card className="bg-card border-border shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 flex-wrap gap-4">
        <div>
          <CardTitle>Valuation History</CardTitle>
          <CardDescription>
            Price on the day each AutoDCF / AutoValue run fired, plotted against that run's DCF and Graham
            Number.
          </CardDescription>
        </div>
        <Select
          value={selectedId}
          onValueChange={setSelectedId}
          disabled={isLoadingCompanies || companies.length === 0}
        >
          <SelectTrigger className="w-[220px] font-mono text-xs bg-input">
            <SelectValue placeholder={isLoadingCompanies ? 'Loading...' : 'Select a company'} />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={String(c.id)} className="font-mono text-xs">
                {c.ticker}
                {c.company_name ? ` \u2014 ${c.company_name}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoadingHistory ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading history...</div>
        ) : !history || history.points.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No completed runs yet for {selected?.ticker ?? 'this company'}. Numbers appear here after the
            next scheduled AutoDCF/AutoValue run.
          </div>
        ) : (
          <>
            <ValuationHistoryChart points={history.points} currency={selected?.latest_valuation?.currency ?? null} height={380} />

            {latest && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 mt-6 border-t border-border">
                <div className="bg-background rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Latest Price</p>
                  <p className="text-lg font-bold font-mono">{fmt(latest.price, selected?.latest_valuation?.currency)}</p>
                </div>
                <div className="bg-background rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">AutoDCF (Base)</p>
                  <p className="text-lg font-bold font-mono text-emerald-400">{fmt(latest.base_dcf, selected?.latest_valuation?.currency)}</p>
                </div>
                <div className="bg-background rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">AutoValue (Graham)</p>
                  <p className="text-lg font-bold font-mono text-amber-400">{fmt(latest.graham_number, selected?.latest_valuation?.currency)}</p>
                </div>
                <div className="bg-background rounded-lg border border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Runs Recorded</p>
                  <p className="text-lg font-bold font-mono">{history.points.length}</p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
