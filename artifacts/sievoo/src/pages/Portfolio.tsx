import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Plus, Trash2, AlertCircle, CalendarClock, TrendingDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Holding {
  id: string;
  ticker: string;
  wActual: number;
  wFinal: number;
  currentPrice: number;
  high52: number;
}

export default function Portfolio() {
  const { toast } = useToast();
  const [netWorth, setNetWorth] = useState<number>(100000);
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: '1', ticker: 'AAPL', wActual: 8.5, wFinal: 5.0, currentPrice: 170, high52: 198 },
    { id: '2', ticker: 'MSFT', wActual: 4.0, wFinal: 6.5, currentPrice: 400, high52: 430 },
  ]);

  const addHolding = () => {
    setHoldings([...holdings, {
      id: Math.random().toString(36).substring(7),
      ticker: 'NEW',
      wActual: 0,
      wFinal: 0,
      currentPrice: 0,
      high52: 0,
    }]);
  };

  const updateHolding = (id: string, field: keyof Holding, value: string | number) => {
    setHoldings(prev => prev.map(h => {
      if (h.id === id) {
        if (field === 'ticker') return { ...h, [field]: (value as string).toUpperCase() };
        return { ...h, [field]: parseFloat(value as string) || 0 };
      }
      return h;
    }));
  };

  const removeHolding = (id: string) => {
    setHoldings(prev => prev.filter(h => h.id !== id));
  };

  const handleDownload = () => {
    const data = { netWorth, holdings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sievoo_portfolio_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast({ title: 'Exported', description: 'Portfolio saved as JSON.' });
  };

  const sumActual = holdings.reduce((acc, h) => acc + h.wActual, 0);
  const dryPowder = Math.max(0, 100 - sumActual);

  const getAction = (wActual: number, wFinal: number) => {
    if (wFinal === 0) return { label: 'EXCLUSION/EXIT', color: 'text-destructive bg-destructive/10' };
    if (wActual < wFinal - 2) return { label: 'HOLD + ADD', color: 'text-accent bg-accent/10' };
    if (wActual > wFinal + 2) return { label: 'HOLD + TRIM', color: 'text-primary bg-primary/10' };
    return { label: 'ON TARGET', color: 'text-blue-500 bg-blue-500/10' };
  };

  const doubleDowns = holdings.filter(h => {
    const action = getAction(h.wActual, h.wFinal).label;
    if (action !== 'HOLD + ADD') return false;
    if (h.high52 > 0 && h.currentPrice > 0) {
      const drop = (h.high52 - h.currentPrice) / h.high52;
      return drop >= 0.20;
    }
    return false;
  });

  return (
    <div className="flex-1 py-12 container mx-auto max-w-6xl px-4 space-y-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Portfolio Allocation</h1>
          <p className="text-muted-foreground">Manage your exposure based on Sievoo master formula targets.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="font-mono text-xs uppercase" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" /> Export JSON
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border shadow-lg md:col-span-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Total Investable Net Worth</CardTitle>
          </CardHeader>
          <CardContent>
            <Input 
              type="number" 
              value={netWorth} 
              onChange={e => setNetWorth(parseFloat(e.target.value) || 0)} 
              className="text-3xl font-mono h-16 bg-background border-border"
            />
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-lg md:col-span-2 relative overflow-hidden">
          <CardContent className="p-6 h-full flex items-center justify-between">
            <div>
              <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-2">Dry Powder (Cash)</div>
              <div className="text-5xl font-mono font-bold text-foreground">{dryPowder.toFixed(1)}%</div>
              <div className="text-muted-foreground mt-2 font-mono">${((dryPowder/100) * netWorth).toLocaleString()}</div>
            </div>
            <div className="text-right space-y-2">
              <div className="text-sm text-muted-foreground uppercase font-bold tracking-widest">Invested</div>
              <div className="text-2xl font-mono font-bold">{sumActual.toFixed(1)}%</div>
            </div>
          </CardContent>
          <div className="absolute bottom-0 left-0 h-1 bg-accent transition-all duration-500" style={{ width: `${sumActual}%` }} />
        </Card>
      </div>

      <Card className="bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="text-xl font-bold">Holdings & Rebalancing</CardTitle>
          <CardDescription>Log your current exposure and the formula target for each name. The directive tells you what to do next.</CardDescription>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 text-xs">
            <div className="bg-background/60 border border-border rounded-md p-3 space-y-1">
              <div className="font-bold text-foreground uppercase tracking-widest text-[10px]">Actual Wt %</div>
              <p className="text-muted-foreground leading-relaxed">What percentage of your total investable portfolio is currently in this position right now. Example: if you own $10 000 in AAPL and your portfolio is $100 000, enter 10.</p>
            </div>
            <div className="bg-background/60 border border-border rounded-md p-3 space-y-1">
              <div className="font-bold text-foreground uppercase tracking-widest text-[10px]">Target Wt %</div>
              <p className="text-muted-foreground leading-relaxed">The ideal allocation produced by the Sievoo master formula — W_final = Gates × max(5 %, min(10 %, score/Beta × 0.22)). Run the Valuation Engine on each stock to get this number, then paste it here.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block"></span><span className="text-muted-foreground">HOLD + ADD — below target, add on dips</span></span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block"></span><span className="text-muted-foreground">HOLD + TRIM — above target, shave 10–20 %</span></span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground inline-block"></span><span className="text-muted-foreground">ON TARGET — within ±1 % of target</span></span>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase">Ticker</TableHead>
                <TableHead className="font-mono text-xs uppercase text-right">
                  <div>Actual Wt %</div>
                  <div className="text-[10px] normal-case font-normal text-muted-foreground/70">Your current %</div>
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-right">
                  <div>Target Wt %</div>
                  <div className="text-[10px] normal-case font-normal text-muted-foreground/70">Formula W_final</div>
                </TableHead>
                <TableHead className="font-mono text-xs uppercase text-right">Current $</TableHead>
                <TableHead className="font-mono text-xs uppercase text-right">52W High $</TableHead>
                <TableHead className="font-mono text-xs uppercase text-center">Directive</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => {
                const action = getAction(h.wActual, h.wFinal);
                return (
                  <TableRow key={h.id} className="border-border border-b hover:bg-muted/10">
                    <TableCell>
                      <Input value={h.ticker} onChange={e => updateHolding(h.id, 'ticker', e.target.value)} className="w-24 font-mono font-bold uppercase bg-transparent border-none px-0 h-8" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.1" value={h.wActual} onChange={e => updateHolding(h.id, 'wActual', e.target.value)} className="w-20 font-mono text-right ml-auto bg-transparent border-border h-8" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.1" value={h.wFinal} onChange={e => updateHolding(h.id, 'wFinal', e.target.value)} className="w-20 font-mono text-right ml-auto bg-transparent border-border h-8" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={h.currentPrice} onChange={e => updateHolding(h.id, 'currentPrice', e.target.value)} className="w-24 font-mono text-right ml-auto bg-transparent border-border h-8" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.01" value={h.high52} onChange={e => updateHolding(h.id, 'high52', e.target.value)} className="w-24 font-mono text-right ml-auto bg-transparent border-border h-8" />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-block px-3 py-1 rounded font-bold text-xs uppercase tracking-wider ${action.color}`}>
                        {action.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeHolding(h.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="p-4 border-t border-border bg-background/50">
            <Button variant="outline" size="sm" onClick={addHolding} className="font-mono text-xs uppercase tracking-widest border-dashed border-border text-muted-foreground hover:text-foreground">
              <Plus className="w-3.5 h-3.5 mr-2" /> Add Position
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-accent/10 border border-accent/30 p-6 rounded-xl flex items-start gap-4">
          <TrendingDown className="w-8 h-8 text-accent shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-accent text-lg mb-2">Double-Down Opportunities</h3>
            <p className="text-sm text-accent/80 mb-4 leading-relaxed">
              Positions marked 'HOLD + ADD' trading 20%+ below their 52-week high trigger the 3X DCA protocol. Deploy dry powder aggressively here.
            </p>
            {doubleDowns.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {doubleDowns.map(d => (
                  <span key={d.id} className="bg-accent text-accent-foreground font-mono px-2 py-1 rounded text-xs font-bold">
                    {d.ticker} ({( (1 - d.currentPrice/d.high52) * 100).toFixed(1)}% off high)
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-sm text-accent/60 font-mono italic">No double-down triggers active.</div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border p-6 rounded-xl flex items-start gap-4">
          <CalendarClock className="w-8 h-8 text-primary shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-foreground text-lg mb-2">Sunday Rebalance Protocol</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Never trade emotionally mid-week. Log your actual weights every Sunday, run the master formula for your top 5 names, and set limit orders for Monday morning. Discipline over intuition.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
