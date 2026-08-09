import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Download, Upload, Share2, Calculator as CalcIcon, ShieldAlert, ArrowRight, Printer } from 'lucide-react';
import { useCreateAnalysis, useGetAnalysis } from '@workspace/api-client-react';

type TVMethod = 'perpetuity' | 'ebitda';

interface CalcInputs {
  // Step 1
  rf: number; beta: number; rm: number; e: number; d: number; rd: number; tc: number;
  // Step 2
  baseRev: number; revGrowth: number; fcfMargin: number; cushion: number;
  // Step 3
  tvMethod: TVMethod; g: number; ebitdaMultiple: number; ebitdaY5: number;
  // Step 4
  cash: number; debtTotal: number; shares: number; currentPrice: number;
  wActual: number;
}

const DEFAULT_INPUTS: CalcInputs = {
  rf: 4.5, beta: 1.1, rm: 10.0, e: 1000, d: 200, rd: 6.0, tc: 21.0,
  baseRev: 500, revGrowth: 15.0, fcfMargin: 12.0, cushion: 10.0,
  tvMethod: 'perpetuity', g: 2.5, ebitdaMultiple: 15.0, ebitdaY5: 120,
  cash: 150, debtTotal: 200, shares: 50, currentPrice: 25.0,
  wActual: 2.0
};

export default function Calculator() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const forkId = searchParams.get('fork') ? parseInt(searchParams.get('fork')!) : null;

  const { toast } = useToast();
  const { data: forkedData } = useGetAnalysis(forkId!, { query: { enabled: !!forkId } });

  const [inputs, setInputs] = useState<CalcInputs>(DEFAULT_INPUTS);
  
  const [gates, setGates] = useState({
    noBs: false, moat: false, ceo: false, dcfBear: false
  });
  
  const [scores, setScores] = useState({ insider: 50, thesis: 50 });
  const [alias, setAlias] = useState('');
  
  useEffect(() => {
    const saved = localStorage.getItem('sievoo_alias');
    if (saved) setAlias(saved);
  }, []);

  // Hydrate from fork
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (forkedData && !hydratedRef.current) {
      try {
        const parsed = JSON.parse(forkedData.full_inputs_json);
        if (parsed.inputs) setInputs(parsed.inputs);
        if (parsed.gates) setGates(parsed.gates);
        if (parsed.scores) setScores(parsed.scores);
        hydratedRef.current = true;
        toast({ title: "Fork loaded", description: `Loaded analysis for ${forkedData.ticker}` });
      } catch (e) {
        console.error(e);
      }
    }
  }, [forkedData, toast]);

  const updateInput = (key: keyof CalcInputs, val: string | number) => {
    let numVal = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(numVal)) numVal = 0;
    if (key === 'tvMethod') setInputs(prev => ({ ...prev, [key]: val as TVMethod }));
    else setInputs(prev => ({ ...prev, [key]: numVal }));
  };

  // ---- CALCULATIONS ----
  // Step 1
  const re = inputs.rf + inputs.beta * (inputs.rm - inputs.rf);
  const totalCap = inputs.e + inputs.d;
  const wacc = totalCap > 0 
    ? (inputs.e / totalCap * re) + (inputs.d / totalCap * inputs.rd * (1 - inputs.tc / 100))
    : re;

  // Step 2 & Scenarios
  const scenarios = useMemo(() => {
    const generateTable = (gRate: number, m: number, w: number) => {
      let r = inputs.baseRev;
      const r_mult = 1 + gRate / 100;
      let sumPV = 0;
      const table = [];
      for (let i = 1; i <= 5; i++) {
        r *= r_mult;
        const fcf = r * (m / 100);
        const pv = fcf / Math.pow(1 + w / 100, i);
        sumPV += pv;
        table.push({ year: i, rev: r, fcf, pv });
      }
      
      let tv = 0;
      if (inputs.tvMethod === 'perpetuity') {
        const fcf5 = table[4].fcf;
        const termG = inputs.g / 100;
        tv = (fcf5 * (1 + termG)) / (w / 100 - termG);
      } else {
        tv = inputs.ebitdaMultiple * inputs.ebitdaY5; // simplification
      }
      
      const pvTv = tv / Math.pow(1 + w / 100, 5);
      const ev = sumPV + pvTv;
      const eq = ev + inputs.cash - inputs.debtTotal;
      const vDcf = inputs.shares > 0 ? eq / inputs.shares : 0;
      
      return { table, sumPV, tv, pvTv, ev, eq, vDcf };
    };

    const c = inputs.cushion / 100;
    const g = inputs.revGrowth;
    const m = inputs.fcfMargin;

    return {
      bear: generateTable(g * (1 - c - 0.15), m * 0.90, wacc + 1),
      base: generateTable(g * (1 - c), m, wacc),
      bull: generateTable(g * (1 - c + 0.15), m * 1.10, wacc - 0.5)
    };
  }, [inputs, wacc]);

  // Master Formula
  const sRule40_val = inputs.revGrowth + inputs.fcfMargin;
  const sRule40 = sRule40_val >= 100 ? 100 : sRule40_val >= 40 ? 60 : 0;
  
  const upside = inputs.currentPrice > 0 ? ((scenarios.base.vDcf - inputs.currentPrice) / inputs.currentPrice) * 100 : 0;
  const sDcfBase = Math.max(0, Math.min(100, upside));

  const allGatesPass = gates.noBs && gates.moat && gates.ceo && gates.dcfBear;
  
  let wFinalRaw = 0;
  if (allGatesPass && inputs.beta > 0) {
    const raw = ((0.30 * sRule40 + 0.30 * sDcfBase + 0.25 * scores.insider + 0.15 * scores.thesis) / inputs.beta) * 0.22;
    wFinalRaw = Math.max(5, Math.min(10, raw)); // scale to 5-10% roughly, per prompt: max(0.05, min(0.10, ...)) we do percentages
  }

  const action = wFinalRaw === 0 ? 'EXCLUSION' 
    : inputs.wActual < wFinalRaw - 2 ? 'HOLD_ADD'
    : inputs.wActual > wFinalRaw + 2 ? 'HOLD_TRIM'
    : 'ON_TARGET';

  // File I/O
  const handleDownload = () => {
    const state = { inputs, gates, scores };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sievoo_dcf_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed.inputs) setInputs(parsed.inputs);
        if (parsed.gates) setGates(parsed.gates);
        if (parsed.scores) setScores(parsed.scores);
        toast({ title: 'Loaded', description: 'Calculator state restored.' });
      } catch {
        toast({ title: 'Error', description: 'Invalid JSON file.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
  };

  // Publish
  const createMutation = useCreateAnalysis();
  const [pubTicker, setPubTicker] = useState('');
  const [pubTitle, setPubTitle] = useState('');
  const [pubPin, setPubPin] = useState('');

  const handlePublish = () => {
    if (!pubTicker || !pubTitle || !alias) {
      toast({ title: 'Missing fields', description: 'Ticker, Title, and Alias required.', variant: 'destructive' });
      return;
    }
    localStorage.setItem('sievoo_alias', alias);
    
    createMutation.mutate({
      data: {
        ticker: pubTicker.toUpperCase(),
        title: pubTitle,
        current_price: inputs.currentPrice,
        base_dcf: scenarios.base.vDcf,
        bear_dcf: scenarios.bear.vDcf,
        bull_dcf: scenarios.bull.vDcf,
        margin_of_safety: upside,
        author_alias: alias,
        full_inputs_json: JSON.stringify({ inputs, gates, scores }),
        edit_pin: pubPin || undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: 'Published!', description: 'Your analysis is live.' });
      }
    });
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawShareCard = () => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    
    cvs.width = 600;
    cvs.height = 315;
    
    // Bg
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, 600, 315);
    
    // Top bar
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 600, 50);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('Sievoo.com', 20, 33);
    
    // Ticker & Price
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`${pubTicker || 'TICKER'} - $${inputs.currentPrice}`, 20, 100);
    
    // Action
    let aColor = '#10b981';
    let aText = 'HOLD + ADD';
    if (action === 'EXCLUSION') { aColor = '#f43f5e'; aText = 'EXCLUSION'; }
    else if (action === 'HOLD_TRIM') { aColor = '#f59e0b'; aText = 'HOLD + TRIM'; }
    else if (action === 'ON_TARGET') { aColor = '#3b82f6'; aText = 'ON TARGET'; }
    
    ctx.fillStyle = aColor;
    ctx.fillRect(20, 120, 160, 30);
    ctx.fillStyle = '#0b0f19';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(aText, 30, 141);
    
    // DCF Grid
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(20, 180, 560, 100);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '14px monospace';
    ctx.fillText('Bear DCF:  $' + scenarios.bear.vDcf.toFixed(2), 40, 210);
    ctx.fillText('Base DCF:  $' + scenarios.base.vDcf.toFixed(2), 220, 210);
    ctx.fillText('Bull DCF:  $' + scenarios.bull.vDcf.toFixed(2), 400, 210);
    
    ctx.fillStyle = upside > 0 ? '#10b981' : '#f43f5e';
    ctx.fillText(`Margin of Safety: ${upside > 0 ? '+' : ''}${upside.toFixed(1)}%`, 40, 250);
    ctx.fillText(`Target Weight: ${wFinalRaw.toFixed(1)}%`, 400, 250);
  };

  const handleExportPng = () => {
    drawShareCard();
    const cvs = canvasRef.current;
    if (!cvs) return;
    const url = cvs.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `sievoo_card_${pubTicker || 'ticker'}.png`;
    a.click();
  };

  return (
    <div className="flex-1 py-8 container mx-auto max-w-7xl px-4 flex flex-col lg:flex-row gap-8">
      {/* LEFT COL: INPUTS */}
      <div className="w-full lg:w-[60%] space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-mono tracking-tight flex items-center gap-3">
            <CalcIcon className="text-primary w-8 h-8" /> 
            Valuation Engine
          </h1>
          <div className="flex gap-2">
            <Label className="cursor-pointer border border-border bg-card hover:bg-muted px-3 py-2 rounded flex items-center gap-2 text-xs font-mono">
              <Upload className="w-3.5 h-3.5" /> Load
              <input type="file" className="hidden" accept=".json" onChange={handleUpload} />
            </Label>
            <Button variant="outline" size="sm" onClick={handleDownload} className="font-mono text-xs">
              <Download className="w-3.5 h-3.5 mr-2" /> Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="font-mono text-xs">
              <Printer className="w-3.5 h-3.5 mr-2" /> Print
            </Button>
          </div>
        </div>

        <Tabs defaultValue="step1" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50 border border-border">
            <TabsTrigger value="step1" className="font-mono text-xs uppercase tracking-wider">1. WACC</TabsTrigger>
            <TabsTrigger value="step2" className="font-mono text-xs uppercase tracking-wider">2. FCF</TabsTrigger>
            <TabsTrigger value="step3" className="font-mono text-xs uppercase tracking-wider">3. Term.Val</TabsTrigger>
            <TabsTrigger value="step4" className="font-mono text-xs uppercase tracking-wider">4. Equity</TabsTrigger>
          </TabsList>
          
          <Card className="mt-4 bg-card border-border shadow-lg">
            <CardContent className="pt-6">
              
              {/* STEP 1 */}
              <TabsContent value="step1" className="space-y-6 mt-0">
                <div className="text-xs text-muted-foreground bg-muted/50 border border-border/50 p-3 rounded-md leading-relaxed">
                  <span className="font-bold text-foreground">WACC</span> is the blended minimum return a company must earn to satisfy all its capital providers. It discounts your future cash flow projections back to today's value — a higher WACC = lower valuation. Formula: <span className="font-mono">WACC = (E/V) × Re + (D/V) × Rd × (1 − Tc)</span> where Re is calculated via CAPM: <span className="font-mono">Re = Rf + β × (Rm − Rf)</span>.
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-muted-foreground uppercase border-b border-border/50 pb-2">Cost of Equity (CAPM)</h3>
                    <div className="grid gap-2">
                      <Label className="text-xs">Risk-Free Rate — Rf (%)</Label>
                      <Input type="number" step="0.1" value={inputs.rf} onChange={e => updateInput('rf', e.target.value)} className="font-mono" />
                      <span className="text-[10px] text-muted-foreground">Use current 10-year government bond yield (e.g. US: ~4.2 %, Norway: ~3.8 %)</span>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Beta — β</Label>
                      <Input type="number" step="0.01" value={inputs.beta} onChange={e => updateInput('beta', e.target.value)} className="font-mono" />
                      <span className="text-[10px] text-muted-foreground">Volatility vs. market. β=1 moves with market. Beta &gt;1 = higher risk, lower allocation ceiling in master formula.</span>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Expected Market Return — Rm (%)</Label>
                      <Input type="number" step="0.1" value={inputs.rm} onChange={e => updateInput('rm', e.target.value)} className="font-mono" />
                      <span className="text-[10px] text-muted-foreground">Long-run equity market return. S&amp;P 500 historical avg: ~10 %. Use 9–10 % as default.</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-bold text-sm text-muted-foreground uppercase border-b border-border/50 pb-2">Cost of Debt & Capital Weights</h3>
                    <div className="grid gap-2">
                      <Label className="text-xs">Equity Market Value ($M)</Label>
                      <Input type="number" value={inputs.e} onChange={e => updateInput('e', e.target.value)} className="font-mono" />
                      <span className="text-[10px] text-muted-foreground">Market cap = share price × shares outstanding.</span>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs">Debt Market Value ($M)</Label>
                      <Input type="number" value={inputs.d} onChange={e => updateInput('d', e.target.value)} className="font-mono" />
                      <span className="text-[10px] text-muted-foreground">Total interest-bearing debt. Use book value if market value is unavailable.</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label className="text-xs">Cost of Debt — Rd (%)</Label>
                        <Input type="number" step="0.1" value={inputs.rd} onChange={e => updateInput('rd', e.target.value)} className="font-mono" />
                        <span className="text-[10px] text-muted-foreground">Weighted avg interest rate on outstanding debt.</span>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Effective Tax Rate — Tc (%)</Label>
                        <Input type="number" step="0.1" value={inputs.tc} onChange={e => updateInput('tc', e.target.value)} className="font-mono" />
                        <span className="text-[10px] text-muted-foreground">Effective (not statutory) rate from income statement.</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-primary/10 border border-primary/30 p-4 rounded-md flex justify-between items-center">
                  <div>
                    <span className="font-bold tracking-wider text-sm block">Calculated WACC</span>
                    <span className="text-[10px] text-muted-foreground">Discount rate applied to all future cash flows</span>
                  </div>
                  <span className="font-mono text-2xl font-bold text-primary">{wacc.toFixed(2)}%</span>
                </div>
              </TabsContent>

              {/* STEP 2 */}
              <TabsContent value="step2" className="space-y-6 mt-0">
                <div className="text-xs text-muted-foreground bg-muted/50 border border-border/50 p-3 rounded-md leading-relaxed">
                  <span className="font-bold text-foreground">Free Cash Flow (FCF)</span> is the cash left after operating costs and capex — the real earnings of the business. We project FCF over 5 years using: <span className="font-mono">FCF_n = Revenue_n × FCFmargin%</span>. Three scenarios (Bear / Base / Bull) stress-test growth rate and WACC simultaneously so you see the valuation range, not a false single number.
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="grid gap-2">
                    <Label className="text-xs">Last Twelve Months Revenue — Yr 0 ($M)</Label>
                    <Input type="number" value={inputs.baseRev} onChange={e => updateInput('baseRev', e.target.value)} className="font-mono" />
                    <span className="text-[10px] text-muted-foreground">Starting point for 5-year projection. Use LTM (last 12 months) revenue from the income statement.</span>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Base Revenue Growth Rate (%)</Label>
                    <Input type="number" step="0.1" value={inputs.revGrowth} onChange={e => updateInput('revGrowth', e.target.value)} className="font-mono" />
                    <span className="text-[10px] text-muted-foreground">Your most realistic annual growth estimate. Cushion and scenario adjustments are applied automatically.</span>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">FCF Margin (%)</Label>
                    <Input type="number" step="0.1" value={inputs.fcfMargin} onChange={e => updateInput('fcfMargin', e.target.value)} className="font-mono" />
                    <span className="text-[10px] text-muted-foreground">FCF / Revenue. Use trailing FCF margin. For asset-light SaaS this is often 15–35 %; for capital-intensive businesses 5–15 %.</span>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Safety Margin Cushion (%)</Label>
                    <Input type="number" step="0.1" value={inputs.cushion} onChange={e => updateInput('cushion', e.target.value)} className="font-mono" />
                    <span className="text-[10px] text-muted-foreground">Built-in conservatism. 10 % = base growth is {100-inputs.cushion}% of your entered rate. Recommended: 10–20 %.</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground bg-muted p-3 rounded space-y-1">
                  <div><strong className="text-foreground">Scenario stress-test applied automatically:</strong></div>
                  <div>Bear: growth × {((100 - inputs.cushion - 15) / 100).toFixed(2)} × baseGrowth, WACC +1.0 %</div>
                  <div>Base: growth × {((100 - inputs.cushion) / 100).toFixed(2)} × baseGrowth, WACC unchanged</div>
                  <div>Bull: growth × {((100 - inputs.cushion + 15) / 100).toFixed(2)} × baseGrowth, WACC −0.5 %</div>
                </div>
              </TabsContent>

              {/* STEP 3 */}
              <TabsContent value="step3" className="space-y-6 mt-0">
                <div className="text-xs text-muted-foreground bg-muted/50 border border-border/50 p-3 rounded-md leading-relaxed">
                  <span className="font-bold text-foreground">Terminal Value</span> captures all the cash flows beyond year 5, and often represents 60–80 % of a company's intrinsic value. Choose the method that best fits the business type.
                </div>
                <div className="flex items-center gap-4 border-b border-border/50 pb-4">
                  <Label className="font-bold text-sm uppercase tracking-wider">Method</Label>
                  <select 
                    className="bg-input text-foreground text-sm rounded border border-border p-2 font-mono"
                    value={inputs.tvMethod}
                    onChange={e => updateInput('tvMethod', e.target.value)}
                  >
                    <option value="perpetuity">Perpetuity Growth Model</option>
                    <option value="ebitda">EBITDA Exit Multiple</option>
                  </select>
                </div>
                {inputs.tvMethod === 'perpetuity' ? (
                  <div className="space-y-4">
                    <div className="grid gap-2 max-w-xs">
                      <Label className="text-xs">Long-Term Growth Rate — g (%)</Label>
                      <Input type="number" step="0.1" value={inputs.g} onChange={e => updateInput('g', e.target.value)} className="font-mono" />
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted p-3 rounded leading-relaxed">
                      <strong className="text-foreground">Formula:</strong> TV = FCF_Y5 × (1+g) / (WACC − g). <br/>
                      g must be below WACC or the model breaks. Use 2–3 % for mature companies (roughly GDP growth). Never use g above the economy's long-run growth rate — that assumption implies the company eventually becomes larger than the entire economy.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-6 max-w-md">
                      <div className="grid gap-2">
                        <Label className="text-xs">Exit EBITDA Multiple (x)</Label>
                        <Input type="number" step="0.1" value={inputs.ebitdaMultiple} onChange={e => updateInput('ebitdaMultiple', e.target.value)} className="font-mono" />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">EBITDA in Year 5 ($M)</Label>
                        <Input type="number" value={inputs.ebitdaY5} onChange={e => updateInput('ebitdaY5', e.target.value)} className="font-mono" />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-muted p-3 rounded leading-relaxed">
                      <strong className="text-foreground">Formula:</strong> TV = EBITDA_Y5 × Multiple. <br/>
                      Use the current sector median EV/EBITDA multiple, then apply a 20–30 % discount to that multiple to be conservative. Good for capital-intensive industries or when the perpetuity growth rate feels uncertain.
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* STEP 4 */}
              <TabsContent value="step4" className="space-y-6 mt-0">
                <div className="text-xs text-muted-foreground bg-muted/50 border border-border/50 p-3 rounded-md leading-relaxed">
                  <span className="font-bold text-foreground">Equity Value per Share</span> = (PV of FCFs + PV of Terminal Value + Cash − Total Debt) ÷ Shares Outstanding. Cash is added back (it's already yours); debt is subtracted (it has a senior claim before equity holders).
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="grid gap-2">
                    <Label className="text-xs">Cash & Equivalents ($M)</Label>
                    <Input type="number" value={inputs.cash} onChange={e => updateInput('cash', e.target.value)} className="font-mono" />
                    <span className="text-[10px] text-muted-foreground">Cash + short-term investments from the balance sheet. Added to enterprise value to get equity value.</span>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Total Debt ($M)</Label>
                    <Input type="number" value={inputs.debtTotal} onChange={e => updateInput('debtTotal', e.target.value)} className="font-mono" />
                    <span className="text-[10px] text-muted-foreground">All interest-bearing obligations (short + long term). Subtracted — debt holders get paid before equity holders.</span>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Shares Outstanding (M)</Label>
                    <Input type="number" step="0.1" value={inputs.shares} onChange={e => updateInput('shares', e.target.value)} className="font-mono" />
                    <span className="text-[10px] text-muted-foreground">Fully diluted share count including options and convertibles (use diluted shares from the 10-K/annual report).</span>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Current Stock Price ($)</Label>
                    <Input type="number" step="0.01" value={inputs.currentPrice} onChange={e => updateInput('currentPrice', e.target.value)} className="font-mono border-primary/50 bg-primary/5" />
                    <span className="text-[10px] text-muted-foreground">Today's market price. Used to calculate margin of safety vs. DCF intrinsic value.</span>
                  </div>
                </div>
              </TabsContent>

            </CardContent>
          </Card>
        </Tabs>

        {/* Quality Gates */}
        <Card className="bg-card border-border shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold tracking-tight">Quality Gates</CardTitle>
            <CardDescription>All 4 must pass. A single failure drops target allocation to 0%.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 p-3 border border-border rounded-md hover:bg-muted/30 transition-colors">
              <Switch checked={gates.noBs} onCheckedChange={c => setGates(p => ({...p, noBs: c}))} id="g-nobs" />
              <div className="grid gap-1">
                <Label htmlFor="g-nobs" className="font-bold cursor-pointer text-sm">No BS Rule</Label>
                <span className="text-xs text-muted-foreground">Pos rev growth, pos FCF, Cash {'>'} Debt (2/3 needed).</span>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 border border-border rounded-md hover:bg-muted/30 transition-colors">
              <Switch checked={gates.moat} onCheckedChange={c => setGates(p => ({...p, moat: c}))} id="g-moat" />
              <div className="grid gap-1">
                <Label htmlFor="g-moat" className="font-bold cursor-pointer text-sm">Identifiable Moat</Label>
                <span className="text-xs text-muted-foreground">Network effects, switching costs, cost adv, intangibles. Stable margins.</span>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 border border-border rounded-md hover:bg-muted/30 transition-colors">
              <Switch checked={gates.ceo} onCheckedChange={c => setGates(p => ({...p, ceo: c}))} id="g-ceo" />
              <div className="grid gap-1">
                <Label htmlFor="g-ceo" className="font-bold cursor-pointer text-sm">Skin In The Game</Label>
                <span className="text-xs text-muted-foreground">Founder led, massive insider ownership, or open market buying.</span>
              </div>
            </div>
            <div className="flex items-start gap-4 p-3 border border-border rounded-md hover:bg-muted/30 transition-colors">
              <Switch checked={gates.dcfBear} onCheckedChange={c => setGates(p => ({...p, dcfBear: c}))} id="g-bear" />
              <div className="grid gap-1">
                <Label htmlFor="g-bear" className="font-bold cursor-pointer text-sm">Downside Protection</Label>
                <span className="text-xs text-muted-foreground">Current Price ${inputs.currentPrice} {"<"} Bear DCF ${scenarios.bear.vDcf.toFixed(2)}.</span>
              </div>
            </div>

            {!allGatesPass && (
              <div className="mt-4 p-4 border border-destructive/50 bg-destructive/10 rounded-md flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
                <div>
                  <h4 className="font-bold text-destructive text-sm uppercase">Exclusion Triggered</h4>
                  <p className="text-xs text-destructive/80 mt-1">Stock fails quality standards. Exit position or do not enter. Final target allocation restricted to 0%.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scoring */}
        {allGatesPass && (
          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold tracking-tight">Qualitative Scoring</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3">
                <div className="flex justify-between items-center text-sm">
                  <Label className="font-bold">Insider Conviction</Label>
                  <span className="font-mono text-muted-foreground">{scores.insider} pts</span>
                </div>
                <Slider value={[scores.insider]} max={100} step={1} onValueChange={(v) => setScores(p => ({...p, insider: v[0]}))} />
                <span className="text-[10px] text-muted-foreground uppercase">0 = Heavy Selling, 50 = Neutral, 100 = Aggressive Open Market Buying</span>
              </div>
              <div className="grid gap-3">
                <div className="flex justify-between items-center text-sm">
                  <Label className="font-bold">Market Misunderstanding</Label>
                  <span className="font-mono text-muted-foreground">{scores.thesis} pts</span>
                </div>
                <Slider value={[scores.thesis]} max={100} step={1} onValueChange={(v) => setScores(p => ({...p, thesis: v[0]}))} />
                <span className="text-[10px] text-muted-foreground uppercase">0 = Consensus, 100 = Deeply misunderstood catalyst</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* RIGHT COL: OUTPUTS */}
      <div className="w-full lg:w-[40%] space-y-6">
        <Card className="bg-card border-border shadow-2xl sticky top-24">
          <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
            <CardTitle className="text-2xl font-bold tracking-tight uppercase">Valuation Output</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* 3 Scenarios Grid */}
            <div className="grid grid-cols-3 divide-x divide-border/50 border-b border-border/50">
              <div className="p-4 text-center hover:bg-muted/10 transition-colors">
                <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Bear</div>
                <div className="font-mono text-destructive text-xl font-bold">${scenarios.bear.vDcf.toFixed(2)}</div>
              </div>
              <div className="p-4 text-center bg-primary/5 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]">
                <div className="text-xs font-bold text-primary uppercase mb-2 tracking-wider">Base</div>
                <div className="font-mono text-foreground text-3xl font-bold">${scenarios.base.vDcf.toFixed(2)}</div>
              </div>
              <div className="p-4 text-center hover:bg-muted/10 transition-colors">
                <div className="text-xs font-bold text-muted-foreground uppercase mb-2">Bull</div>
                <div className="font-mono text-accent text-xl font-bold">${scenarios.bull.vDcf.toFixed(2)}</div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center p-4 rounded-md border border-border bg-background">
                <span className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Margin of Safety</span>
                <span className={`font-mono text-2xl font-bold ${upside > 0 ? 'text-accent' : 'text-destructive'}`}>
                  {upside > 0 ? '+' : ''}{upside.toFixed(1)}%
                </span>
              </div>

              <div className="space-y-3">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Current Portfolio Weight (%)</Label>
                <Input 
                  type="number" step="0.1" 
                  value={inputs.wActual} 
                  onChange={e => updateInput('wActual', e.target.value)} 
                  className="font-mono text-lg bg-input"
                />
              </div>

              {/* Master Formula Box */}
              <div className="p-6 rounded-lg border-2 border-border bg-muted/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <ShieldAlert className="w-24 h-24" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-bold text-xs uppercase text-muted-foreground mb-4 tracking-widest">Master Formula Target</h3>
                  <div className="flex items-end gap-4 mb-6">
                    <span className="text-5xl font-mono font-bold text-foreground">
                      {wFinalRaw.toFixed(1)}%
                    </span>
                    <span className="text-sm font-mono text-muted-foreground mb-2">ALLOCATION</span>
                  </div>

                  <div className={`p-4 rounded-md border-l-4 font-bold tracking-wide flex items-center gap-3
                    ${action === 'EXCLUSION' ? 'bg-destructive/10 border-destructive text-destructive' : 
                      action === 'HOLD_ADD' ? 'bg-accent/10 border-accent text-accent' :
                      action === 'HOLD_TRIM' ? 'bg-primary/10 border-primary text-primary' :
                      'bg-blue-500/10 border-blue-500 text-blue-500'}`}
                  >
                    {action === 'EXCLUSION' && '[EXCLUSION / EXIT]'}
                    {action === 'HOLD_ADD' && '[HOLD + ADD] (DCA Priority)'}
                    {action === 'HOLD_TRIM' && '[HOLD + TRIM] (Shave 10-20%)'}
                    {action === 'ON_TARGET' && '[ON TARGET]'}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-border/50">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="flex-1 font-mono uppercase tracking-wider text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                      <Share2 className="w-4 h-4 mr-2" /> Publish Analysis
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="font-mono uppercase tracking-widest text-primary">Publish to Community</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Ticker</Label>
                        <Input value={pubTicker} onChange={e => setPubTicker(e.target.value.toUpperCase())} className="font-mono uppercase" placeholder="AAPL" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Title / Thesis</Label>
                        <Input value={pubTitle} onChange={e => setPubTitle(e.target.value)} placeholder="Strong moat, ignored cash flow..." />
                      </div>
                      <div className="grid gap-2">
                        <Label>Author Alias</Label>
                        <Input value={alias} onChange={e => setAlias(e.target.value)} placeholder="ValueHunter99" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Edit PIN (Optional, 4 digits)</Label>
                        <Input type="password" maxLength={4} value={pubPin} onChange={e => setPubPin(e.target.value)} placeholder="1234" className="font-mono" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handlePublish} disabled={createMutation.isPending} className="w-full font-mono bg-primary text-primary-foreground hover:bg-primary/90">
                        {createMutation.isPending ? 'Publishing...' : 'CONFIRM PUBLISH'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 font-mono uppercase tracking-wider text-xs border-border hover:bg-muted" onClick={drawShareCard}>
                      Export Card
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[650px] bg-card border-border">
                    <DialogHeader>
                      <DialogTitle>Share Card</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 flex justify-center bg-black/50 rounded overflow-hidden">
                      <canvas ref={canvasRef} className="max-w-full h-auto border border-border rounded" />
                    </div>
                    <DialogFooter>
                      <Button onClick={handleExportPng} className="w-full font-mono">
                        <Download className="w-4 h-4 mr-2" /> Download PNG
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
