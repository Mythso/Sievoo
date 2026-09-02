import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen, TrendingUp, Calculator, Shield, Scale, Waves, UserCheck, Search } from 'lucide-react';

const articles = [
  {
    slug: 'dcf',
    title: 'Understanding DCF Valuation: WACC, FCF & Terminal Value Explained',
    description: 'The definitive guide to discounting cash flows. Learn why Beta matters, how to calculate Cost of Capital, and why Terminal Value is often misused.',
    icon: Calculator,
    color: 'text-primary'
  },
  {
    slug: 'core-satellite',
    title: 'The Core-Satellite Strategy and Rule of 110 Asset Allocation',
    description: 'How to structure a portfolio that survives market crashes while outperforming benchmarks. Indexing for defense, stock-picking for offense.',
    icon: Shield,
    color: 'text-blue-400'
  },
  {
    slug: 'fire-4pct-rule',
    title: 'The 4% Rule and 25x Expenses Formula for Pension and FIRE',
    description: 'The math behind early retirement. Understanding the Trinity Study, sequence of returns risk, and how to calculate your exact FI number.',
    icon: TrendingUp,
    color: 'text-accent'
  },
  {
    slug: 'moats-rule40',
    title: 'Evaluating Moats, Rule of 40, and Insider Activity in Growth Stocks',
    description: 'Qualitative analysis meets quantitative hurdles. Why software companies trade differently and how to spot a crumbling competitive advantage.',
    icon: BookOpen,
    color: 'text-destructive'
  },
  {
    slug: 'margin-of-safety',
    title: 'Margin of Safety: Benjamin Graham\'s Central Principle',
    description: 'The single most important idea in value investing. Why buying below intrinsic value is the only real protection against being wrong.',
    icon: Scale,
    color: 'text-emerald-400'
  },
  {
    slug: 'mr-market',
    title: 'Mr. Market: Why the Market Is Your Servant, Not Your Guide',
    description: 'Benjamin Graham\'s famous allegory for market psychology. How to use volatility as an opportunity instead of a source of anxiety.',
    icon: Waves,
    color: 'text-cyan-400'
  },
  {
    slug: 'defensive-vs-enterprising',
    title: 'Defensive vs. Enterprising Investor: Choosing Your Approach',
    description: 'Graham split investors into two camps based on time and temperament. Find out which one actually matches how you invest.',
    icon: UserCheck,
    color: 'text-purple-400'
  },
  {
    slug: 'graham-number',
    title: 'The Graham Number: A Quick Screen for Undervalued Stocks',
    description: 'A simple formula combining earnings and book value to flag statistically cheap stocks, plus Graham\'s seven-point defensive checklist.',
    icon: Search,
    color: 'text-amber-400'
  }
];

export default function Academy() {
  return (
    <div className="flex-1 py-12 container mx-auto max-w-5xl px-4 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Sievoo Academy</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Master the math behind the markets. Deep dives into valuation methodology, portfolio construction, and financial independence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.map((art) => {
          const Icon = art.icon;
          return (
            <Link key={art.slug} href={`/academy/${art.slug}`}>
              <Card className="h-full bg-card border-border hover:border-primary/50 hover:bg-muted/10 transition-all cursor-pointer hover-elevate">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-background border border-border flex items-center justify-center mb-4 ${art.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-2xl leading-tight">{art.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{art.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
