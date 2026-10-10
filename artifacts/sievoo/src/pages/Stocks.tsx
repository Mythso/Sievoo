import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStocks, type StockSummary } from '@/lib/community-api';
import { formatMoney, formatPercent, mosClass } from '@/lib/format';
import { useLang } from '@/lib/i18n';

type Market = 'all' | 'oslo' | 'us';
type SortKey = 'ticker' | 'mos' | 'graham';

/**
 * Directory of every tracked stock with its latest automated valuation.
 * Each row links to a /stock/:ticker page (which is what search engines
 * index - see the API's routes/seo.ts).
 */
export default function Stocks() {
  const { t } = useLang();
  const { data, isLoading } = useStocks();
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState<Market>('all');
  const [sort, setSort] = useState<SortKey>('mos');

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    const items = (data?.items ?? []).filter(
      (s) =>
        s.price != null &&
        (market === 'all' || (market === 'oslo' ? s.market === 'oslo' : s.market !== 'oslo')) &&
        (!q || s.ticker.includes(q) || (s.company_name ?? '').toUpperCase().includes(q)),
    );
    const val = (s: StockSummary) =>
      sort === 'mos' ? (s.margin_of_safety ?? -Infinity) : sort === 'graham' ? (s.graham_margin_of_safety ?? -Infinity) : 0;
    return sort === 'ticker' ? items.sort((a, b) => a.ticker.localeCompare(b.ticker)) : items.sort((a, b) => val(b) - val(a));
  }, [data, query, market, sort]);

  const osloCount = (data?.items ?? []).filter((s) => s.market === 'oslo' && s.price != null).length;

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button onClick={() => setSort(k)} className={`inline-flex items-center gap-1 hover:text-foreground ${sort === k ? 'text-foreground' : ''}`}>
        {children}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </TableHead>
  );

  return (
    <div className="flex-1 container mx-auto max-w-7xl px-4 py-12">
      <div className="mb-8 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('Stock valuations', 'Aksjeverdsettelser')}</h1>
        <p className="text-muted-foreground mt-2">
          {t(
            'Every stock Sievoo tracks, re-valued automatically each week with a DCF and the Graham Number. Click a ticker for the full history, community analyses and alerts.',
            'Alle aksjer Sievoo følger, verdsatt automatisk hver uke med DCF og Graham-tallet. Klikk på en ticker for full historikk, analyser fra fellesskapet og varsler.',
          )}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between mb-6">
        <Tabs value={market} onValueChange={(v) => setMarket(v as Market)}>
          <TabsList>
            <TabsTrigger value="all" className="font-mono text-xs uppercase">{t('All', 'Alle')}</TabsTrigger>
            <TabsTrigger value="oslo" className="font-mono text-xs uppercase">
              Oslo Børs{osloCount > 0 ? ` (${osloCount})` : ''}
            </TabsTrigger>
            <TabsTrigger value="us" className="font-mono text-xs uppercase">{t('US & other', 'USA og andre')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Search ticker or company…', 'Søk ticker eller selskap…')}
            className="pl-9 bg-card"
          />
        </div>
      </div>

      <Card className="bg-card border-border shadow-xl">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <SortHead k="ticker">Ticker</SortHead>
                <TableHead className="hidden md:table-cell">{t('Company', 'Selskap')}</TableHead>
                <TableHead className="text-right">{t('Price', 'Kurs')}</TableHead>
                <TableHead className="text-right">DCF</TableHead>
                <SortHead k="mos" className="text-right">{t('DCF margin', 'DCF-margin')}</SortHead>
                <TableHead className="text-right hidden sm:table-cell">Graham</TableHead>
                <SortHead k="graham" className="text-right hidden sm:table-cell">{t('Graham margin', 'Graham-margin')}</SortHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t('Loading...', 'Laster...')}</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">{t('No stocks match.', 'Ingen aksjer passer søket.')}</TableCell>
                </TableRow>
              ) : (
                rows.map((s) => (
                  <TableRow key={s.id} className="border-border hover:bg-muted/10">
                    <TableCell className="font-mono font-bold whitespace-nowrap">
                      <Link href={`/stock/${encodeURIComponent(s.ticker)}`} className="hover:text-primary">
                        {s.ticker}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[260px] truncate">
                      {s.company_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono whitespace-nowrap">{formatMoney(s.price, s.currency)}</TableCell>
                    <TableCell className="text-right font-mono whitespace-nowrap text-emerald-400">{formatMoney(s.base_dcf, s.currency)}</TableCell>
                    <TableCell className={`text-right font-mono whitespace-nowrap ${mosClass(s.margin_of_safety)}`}>{formatPercent(s.margin_of_safety)}</TableCell>
                    <TableCell className="text-right font-mono whitespace-nowrap text-amber-400 hidden sm:table-cell">{formatMoney(s.graham_number, s.currency)}</TableCell>
                    <TableCell className={`text-right font-mono whitespace-nowrap hidden sm:table-cell ${mosClass(s.graham_margin_of_safety)}`}>
                      {formatPercent(s.graham_margin_of_safety)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground mt-4">
        {t(
          'Automated estimates from public market data - a starting point for your own research, not advice.',
          'Automatiske estimater fra offentlige markedsdata - et utgangspunkt for din egen analyse, ikke råd.',
        )}{' '}
        <Link href="/track-record" className="text-primary hover:underline">
          {t('See how accurate they have been →', 'Se hvor treffsikre de har vært →')}
        </Link>
      </p>
    </div>
  );
}
