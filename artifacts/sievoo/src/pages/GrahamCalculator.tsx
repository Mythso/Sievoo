import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { Search, CheckCircle2, XCircle } from 'lucide-react';

const DEFENSIVE_CRITERIA = [
  {
    id: 'size',
    label: 'Adequate size',
    detail: 'A substantial, established company rather than a micro-cap.',
  },
  {
    id: 'financial',
    label: 'Strong financial condition',
    detail: 'Current assets are at least twice current liabilities.',
  },
  {
    id: 'stability',
    label: 'Earnings stability',
    detail: 'Positive earnings in each of the past ten years.',
  },
  {
    id: 'dividend',
    label: 'Dividend record',
    detail: 'An uninterrupted history of dividend payments.',
  },
  {
    id: 'growth',
    label: 'Earnings growth',
    detail: 'Meaningful growth in earnings per share over the past decade.',
  },
  {
    id: 'pe',
    label: 'Moderate P/E ratio',
    detail: 'Current price no more than roughly 15 times average earnings.',
  },
  {
    id: 'pb',
    label: 'Moderate P/B ratio',
    detail: 'Price no more than roughly 1.5x book value (or P/E × P/B ≤ 22.5).',
  },
] as const;

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(1)}%`;
}

export default function GrahamCalculator() {
  const [eps, setEps] = useState('5.00');
  const [bookValue, setBookValue] = useState('40.00');
  const [price, setPrice] = useState('60.00');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const epsNum = parseFloat(eps) || 0;
  const bvNum = parseFloat(bookValue) || 0;
  const priceNum = parseFloat(price) || 0;

  const grahamNumber = useMemo(() => {
    if (epsNum <= 0 || bvNum <= 0) return NaN;
    return Math.sqrt(22.5 * epsNum * bvNum);
  }, [epsNum, bvNum]);

  const marginOfSafety = useMemo(() => {
    if (!Number.isFinite(grahamNumber) || grahamNumber <= 0) return NaN;
    return ((grahamNumber - priceNum) / grahamNumber) * 100;
  }, [grahamNumber, priceNum]);

  const isUndervalued = Number.isFinite(marginOfSafety) && marginOfSafety > 0;

  const passedCount = DEFENSIVE_CRITERIA.filter((c) => checked[c.id]).length;

  return (
    <div className="flex-1 py-12 container mx-auto max-w-4xl px-4 space-y-10">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-background border border-border text-amber-400 mx-auto">
          <Search className="w-7 h-7" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Graham Calculator</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          A conservative, asset-and-earnings based screen inspired by Benjamin Graham's{' '}
          <em>The Intelligent Investor</em>. Use it alongside the DCF calculator, not instead of it.
        </p>
        <p className="text-sm text-muted-foreground">
          Want the background first?{' '}
          <Link href="/academy/graham-number" className="text-accent hover:underline">
            Read the Graham Number article
          </Link>
          .
        </p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Graham Number & Margin of Safety</CardTitle>
          <CardDescription>
            Graham Number = √(22.5 × EPS × Book Value per Share)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eps">EPS (TTM)</Label>
              <Input
                id="eps"
                type="number"
                step="0.01"
                value={eps}
                onChange={(e) => setEps(e.target.value)}
                data-testid="input-eps"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bookValue">Book Value / Share</Label>
              <Input
                id="bookValue"
                type="number"
                step="0.01"
                value={bookValue}
                onChange={(e) => setBookValue(e.target.value)}
                data-testid="input-book-value"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Current Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                data-testid="input-price"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="bg-background rounded-lg border border-border p-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground">Graham Number</p>
              <p className="text-2xl font-bold" data-testid="text-graham-number">
                {formatCurrency(grahamNumber)}
              </p>
            </div>
            <div className="bg-background rounded-lg border border-border p-4 text-center space-y-1">
              <p className="text-sm text-muted-foreground">Margin of Safety</p>
              <p
                className={`text-2xl font-bold ${
                  isUndervalued ? 'text-emerald-400' : 'text-destructive'
                }`}
                data-testid="text-margin-of-safety"
              >
                {formatPercent(marginOfSafety)}
              </p>
            </div>
            <div className="bg-background rounded-lg border border-border p-4 text-center space-y-1 flex flex-col justify-center">
              <p className="text-sm text-muted-foreground">Verdict</p>
              <div className="flex items-center justify-center gap-2">
                {isUndervalued ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Below Graham Number
                  </Badge>
                ) : (
                  <Badge variant="destructive">Above Graham Number</Badge>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            This formula assumes a P/E cap of 15 and a P/B cap of 1.5. It works best for stable,
            profitable, asset-heavy businesses—less so for asset-light or high-growth companies
            where book value understates the real earnings engine.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Defensive Investor Checklist</CardTitle>
          <CardDescription>
            Graham's seven-point screen for conservative, low-effort stock selection. Check off
            what a company satisfies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DEFENSIVE_CRITERIA.map((c) => (
            <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/10">
              <Checkbox
                id={c.id}
                checked={!!checked[c.id]}
                onCheckedChange={(v) =>
                  setChecked((prev) => ({ ...prev, [c.id]: v === true }))
                }
                data-testid={`checkbox-${c.id}`}
                className="mt-1"
              />
              <div>
                <Label htmlFor={c.id} className="text-base font-medium cursor-pointer">
                  {c.label}
                </Label>
                <p className="text-sm text-muted-foreground">{c.detail}</p>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {passedCount} of {DEFENSIVE_CRITERIA.length} criteria satisfied
            </span>
            <div className="flex items-center gap-2">
              {passedCount === DEFENSIVE_CRITERIA.length ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Passes the defensive screen</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="text-muted-foreground">Not a full pass yet</span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        For a forward-looking, cash-flow based estimate of fair value, try the{' '}
        <Link href="/calculator" className="text-accent hover:underline">
          DCF calculator
        </Link>
        .
      </p>
    </div>
  );
}
