import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Flame, Shield, TrendingUp, Compass } from 'lucide-react';

export default function Fire() {
  const [expenses, setExpenses] = useState<number>(60000);
  const [currentValue, setCurrentValue] = useState<number>(250000);
  const [monthlySavings, setMonthlySavings] = useState<number>(2000);
  const [returnRate, setReturnRate] = useState<number>(7.0);

  // 4% Rule -> Required Capital = Expenses * 25
  const requiredCapital = expenses * 25;
  const gap = requiredCapital - currentValue;
  const progressPercent = Math.min(100, Math.max(0, (currentValue / requiredCapital) * 100));

  // Time to goal calculation
  // FV = PV*(1+r)^n + PMT*(((1+r)^n - 1)/r)
  // Monthly rate:
  const r = returnRate / 100 / 12;
  const PMT = monthlySavings;
  let monthsToGoal = 0;

  if (currentValue >= requiredCapital) {
    monthsToGoal = 0;
  } else if (r === 0) {
    monthsToGoal = PMT > 0 ? gap / PMT : Infinity;
  } else {
    // Exact formula for n:
    // n = log((FV*r + PMT)/(PV*r + PMT)) / log(1+r)
    const num = (requiredCapital * r + PMT);
    const den = (currentValue * r + PMT);
    if (den <= 0 || num <= 0) {
      monthsToGoal = Infinity;
    } else {
      monthsToGoal = Math.log(num / den) / Math.log(1 + r);
    }
  }

  const yearsToGoal = monthsToGoal === Infinity ? Infinity : monthsToGoal / 12;
  const targetYear = yearsToGoal === Infinity ? 'Never' : new Date().getFullYear() + Math.ceil(yearsToGoal);

  // Allocation based on horizon
  let defense = 0;
  if (yearsToGoal <= 5) defense = 70;
  else if (yearsToGoal <= 10) defense = 50;
  else if (yearsToGoal <= 25) defense = 20;
  else defense = 10;

  const remaining = 100 - defense;
  const core = remaining / 2;
  const satellite = remaining / 2;

  return (
    <div className="flex-1 py-12 container mx-auto max-w-5xl px-4 space-y-8">
      <div className="text-center space-y-4 mb-12">
        <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
          <Flame className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">FIRE & Pension Calculator</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Based on the Trinity Study's 4% Safe Withdrawal Rate. Calculate your exact FI number and determine the optimal asset allocation for your horizon.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-card border-border shadow-xl">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="text-xl font-bold uppercase tracking-wider">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-2">
              <Label>Desired Annual Expenses ($)</Label>
              <Input 
                type="number" 
                value={expenses} 
                onChange={(e) => setExpenses(parseFloat(e.target.value) || 0)} 
                className="font-mono text-lg bg-input"
              />
            </div>
            <div className="grid gap-2">
              <Label>Current Portfolio Value ($)</Label>
              <Input 
                type="number" 
                value={currentValue} 
                onChange={(e) => setCurrentValue(parseFloat(e.target.value) || 0)} 
                className="font-mono bg-input"
              />
            </div>
            <div className="grid gap-2">
              <Label>Monthly Savings/Contribution ($)</Label>
              <Input 
                type="number" 
                value={monthlySavings} 
                onChange={(e) => setMonthlySavings(parseFloat(e.target.value) || 0)} 
                className="font-mono bg-input"
              />
            </div>
            <div className="grid gap-2">
              <Label>Expected Annual Return (%)</Label>
              <Input 
                type="number" 
                step="0.1"
                value={returnRate} 
                onChange={(e) => setReturnRate(parseFloat(e.target.value) || 0)} 
                className="font-mono bg-input"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="bg-card border-border shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Compass className="w-32 h-32" />
            </div>
            <CardHeader>
              <CardDescription className="uppercase tracking-widest font-bold text-primary">Required Capital</CardDescription>
              <CardTitle className="text-5xl font-mono text-foreground">${requiredCapital.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-muted-foreground">Current: ${currentValue.toLocaleString()}</span>
                  <span className="text-muted-foreground">Gap: ${gap > 0 ? gap.toLocaleString() : '0'}</span>
                </div>
                <Progress value={progressPercent} className="h-3 bg-muted" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1 font-bold">Years to Goal</div>
                  <div className="text-2xl font-mono font-bold text-foreground">
                    {yearsToGoal === Infinity ? '∞' : yearsToGoal.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1 font-bold">Target Year</div>
                  <div className="text-2xl font-mono font-bold text-accent">
                    {targetYear}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-lg">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-lg font-bold">Horizon Allocation</CardTitle>
              <CardDescription>Based on {yearsToGoal === Infinity ? '>35' : yearsToGoal.toFixed(1)} years to target</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <span className="font-bold">Defense (Bonds/Cash)</span>
                </div>
                <span className="font-mono text-xl font-bold text-blue-400">{defense}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-accent" />
                  <span className="font-bold">Core Index (S&P/World)</span>
                </div>
                <span className="font-mono text-xl font-bold text-accent">{core}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded">
                <div className="flex items-center gap-3">
                  <Flame className="w-5 h-5 text-primary" />
                  <span className="font-bold">Satellite Stocks</span>
                </div>
                <span className="font-mono text-xl font-bold text-primary">{satellite}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-4 italic">
                * If your satellite portfolio has fewer than 3 stocks passing the Sievoo Quality Gates, reallocate satellite weight to QQQM.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="prose prose-invert max-w-none mt-16 p-8 bg-card border border-border rounded-xl">
        <h3 className="text-2xl font-bold text-foreground mb-4">The Trinity Study & 4% Rule</h3>
        <p className="text-muted-foreground leading-relaxed">
          The 4% rule is a rule of thumb used to determine how much a retiree should withdraw from a retirement account each year. This rule seeks to provide a steady income stream to the retiree while also maintaining an account balance that keeps income flowing through retirement.
        </p>
        <p className="text-muted-foreground leading-relaxed mt-4">
          Derived from the 1998 Trinity Study, the math shows that a portfolio composed of 50% to 75% equities can sustain a 4% inflation-adjusted withdrawal rate over a 30-year period with a 95%+ success rate.
        </p>
        <div className="bg-background border border-border p-4 rounded mt-6 font-mono text-sm">
          Annual Expenses × 25 = FIRE Number<br />
          $60,000 × 25 = $1,500,000<br />
          $1,500,000 × 4% = $60,000/year
        </div>
      </div>
    </div>
  );
}
