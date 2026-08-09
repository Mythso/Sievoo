import { useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

const contentMap: Record<string, { title: string, body: string[] }> = {
  'dcf': {
    title: 'Understanding DCF Valuation: WACC, FCF & Terminal Value Explained',
    body: [
      "<h2>The Philosophy of Discounting</h2>",
      "<p>A stock is not a ticker symbol on a screen; it is an ownership stake in a real business. The intrinsic value of any business is the present value of all cash flows that can be taken out of it during its remaining life. The Discounted Cash Flow (DCF) model is the mathematical expression of this truth.</p>",
      "<p>While multiples (P/E, EV/EBITDA) tell you what the market is paying <em>relative to peers</em>, a DCF attempts to tell you what the business is actually <em>worth</em> in absolute terms.</p>",
      "<h3>Weighted Average Cost of Capital (WACC)</h3>",
      "<p>Cash tomorrow is worth less than cash today. WACC is the discount rate used to bring future cash flows back to present value. It blends the cost of equity (expected return by shareholders) and the after-tax cost of debt.</p>",
      "<pre>WACC = (E/V × Re) + (D/V × Rd × (1 - Tc))</pre>",
      "<p>The Cost of Equity (Re) is typically calculated using the Capital Asset Pricing Model (CAPM):</p>",
      "<pre>Re = Risk Free Rate + Beta × (Market Return - Risk Free Rate)</pre>",
      "<p>Beta measures volatility. A Beta of 1.2 means the stock is 20% more volatile than the market. Higher risk demands a higher expected return, which increases the discount rate and lowers the present value.</p>",
      "[AD_ZONE]",
      "<h3>Free Cash Flow (FCF)</h3>",
      "<p>Revenue is vanity, profit is sanity, cash is reality. Free Cash Flow represents the cash a company generates after accounting for cash outflows to support operations and maintain its capital assets. It's the money actually available to be distributed to shareholders.</p>",
      "<p>In our calculator, we forecast FCF by projecting Revenue Growth and applying an expected FCF Margin. We apply a 'Safety Margin Cushion' to aggressively haircut these projections—optimism is the enemy of value investing.</p>",
      "<h3>Terminal Value</h3>",
      "<p>Because we cannot project cash flows to infinity year-by-year, we calculate a Terminal Value (TV) at the end of our forecast period (usually Year 5). This represents the value of all cash flows beyond Year 5.</p>",
      "<pre>TV = FCF_Year5 × (1 + g) / (WACC - g)</pre>",
      "<p>This is the Perpetuity Growth formula, where 'g' is the long-term growth rate (which cannot exceed GDP growth). Alternatively, an EBITDA multiple exit can be used, though it pollutes a pure intrinsic valuation with relative market pricing.</p>",
      "<p>Terminal Value often accounts for 60-80% of the total valuation, which is why DCF models are highly sensitive to the inputs. Use them to stress-test assumptions, not to find absolute truth.</p>"
    ]
  },
  'core-satellite': {
    title: 'The Core-Satellite Strategy and Rule of 110 Asset Allocation',
    body: [
      "<h2>Balancing Defense and Offense</h2>",
      "<p>The Core-Satellite approach is a portfolio construction method designed to minimize costs and volatility while providing an opportunity to outperform the broad market. It divides your portfolio into two segments: a large, passively managed 'core' and a smaller, actively managed 'satellite'.</p>",
      "<h3>The Core</h3>",
      "<p>The Core typically consists of broad market index funds or ETFs (like S&P 500 or Total World funds). This segment guarantees that you capture the equity risk premium with minimal fees and maximum diversification.</p>",
      "<h3>The Satellite</h3>",
      "<p>The Satellite portion contains your high-conviction individual stock picks—those that pass the Sievoo Master Formula. Because the Core provides stability, the Satellite can be aggressive and highly concentrated. If you hold 40 stocks in your Satellite, you're just building an expensive, poorly-constructed index fund. A true Satellite portfolio should contain no more than 5-10 heavily researched names.</p>",
      "[AD_ZONE]",
      "<h3>The Rule of 110</h3>",
      "<p>Asset allocation determines 90% of your portfolio's return variance. The 'Rule of 110' is a modern adjustment to the old 'Rule of 100' for determining equity exposure.</p>",
      "<pre>Equity Percentage = 110 - Age (or Years to Target)</pre>",
      "<p>However, we adjust this based on the Target Horizon. If you are decades away from needing the capital, defense (bonds/cash) is a drag on compounding. We recommend:</p>",
      "<ul><li>>25 years: 10-20% Defense</li><li>10-25 years: 20-50% Defense</li><li><10 years: 50-70% Defense</li></ul>",
      "<p>The remaining equity portion is split 50/50 between Core (Indices) and Satellite (Individual Stocks). If you cannot find stocks that pass rigorous quality gates, the Satellite allocation defaults back to the Core.</p>"
    ]
  },
  'fire-4pct-rule': {
    title: 'The 4% Rule and 25x Expenses Formula for Pension and FIRE',
    body: [
      "<h2>Financial Independence, Retire Early (FIRE)</h2>",
      "<p>The math behind retirement is shockingly simple, yet widely misunderstood. The goal is not to amass a specific net worth based on an arbitrary number (like a million dollars), but to accumulate enough capital that the return on that capital covers your living expenses indefinitely.</p>",
      "<h3>The Trinity Study</h3>",
      "<p>In 1998, three finance professors at Trinity University published a study testing various withdrawal rates over 30-year retirement periods using historical market data. They found that a portfolio consisting of 50-75% equities could survive a 4% inflation-adjusted withdrawal rate with a near 100% success rate, regardless of the sequence of returns.</p>",
      "<p>This gave birth to the 4% Rule. If you can withdraw 4% of your portfolio to live on, your required portfolio size is exactly 25 times your annual expenses.</p>",
      "<pre>Required Capital = Annual Expenses × 25</pre>",
      "[AD_ZONE]",
      "<h3>Sequence of Returns Risk</h3>",
      "<p>The greatest danger to early retirees is 'Sequence of Returns Risk'. Earning an average of 7% over 30 years means nothing if the first three years are -20%, -15%, and -10%. Withdrawing 4% while the portfolio is simultaneously crashing permanently impairs the capital base.</p>",
      "<p>To mitigate this, retirees utilize a 'Cash Tent' or 'Bond Tent' (the Defense allocation in the Sievoo Fire Calculator)—holding 2-3 years of living expenses in cash equivalents to draw down during bear markets, allowing the equity portion to recover untouched.</p>",
      "<h3>The Math of Compounding</h3>",
      "<p>Your timeline to FIRE is dictated solely by your savings rate as a percentage of income. If you save 50% of your income, you are buying one year of freedom for every year you work. At a 7% real return, a 50% savings rate leads to financial independence in roughly 17 years, regardless of income level.</p>"
    ]
  },
  'moats-rule40': {
    title: 'Evaluating Moats, Rule of 40, and Insider Activity',
    body: [
      "<h2>Beyond the Spreadsheet</h2>",
      "<p>A DCF model is only as good as its inputs. Garbage in, garbage out. The qualitative factors—the 'Quality Gates' in Sievoo—determine whether the cash flow projections have any basis in reality. A company without a moat will see its margins eroded by competition long before Year 5.</p>",
      "<h3>Economic Moats</h3>",
      "<p>A moat is a structural competitive advantage that protects a company's profitability. There are four primary types:</p>",
      "<ul><li><strong>Network Effects:</strong> The product becomes more valuable as more people use it (e.g., Visa, Meta).</li><li><strong>Switching Costs:</strong> The cost (time, money, risk) of moving to a competitor is too high (e.g., enterprise software, banking).</li><li><strong>Cost Advantage:</strong> The ability to produce at a lower cost than peers (e.g., Amazon, Geico).</li><li><strong>Intangible Assets:</strong> Brands, patents, or regulatory licenses (e.g., Apple, pharmaceutical patents).</li></ul>",
      "[AD_ZONE]",
      "<h3>The Rule of 40</h3>",
      "<p>Particularly useful for software (SaaS) and high-growth companies, the Rule of 40 evaluates the tradeoff between growth and profitability. The principle dictates that a healthy software company's revenue growth rate plus its free cash flow margin should equal or exceed 40%.</p>",
      "<pre>Rule of 40 = Revenue Growth % + FCF Margin %</pre>",
      "<p>A company growing at 50% with a -10% margin passes. A company growing at 20% with a 20% margin passes. It is a quick heuristic to ensure growth isn't being purchased at unsustainable costs.</p>",
      "<h3>Skin in the Game</h3>",
      "<p>Management behavior is often more predictive than management guidance. We look for 'Skin in the Game'—founder-led companies or massive insider ownership. More importantly, we track open market purchases. As Peter Lynch noted: 'Insiders might sell their shares for any number of reasons, but they buy them for only one: they think the price will go up.'</p>"
    ]
  }
};

export default function Article() {
  const [match, params] = useRoute('/academy/:slug');
  const slug = params?.slug || '';
  const article = contentMap[slug];

  if (!article) {
    return <div className="container mx-auto py-24 text-center">Article not found.</div>;
  }

  return (
    <div className="flex-1 container mx-auto max-w-4xl py-12 px-4">
      <Link href="/academy" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-foreground mb-8">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Academy
      </Link>
      
      <Card className="bg-card border-border shadow-2xl">
        <CardContent className="pt-12 px-8 md:px-16 pb-16 prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-h2:text-primary prose-h3:text-foreground prose-a:text-accent">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-12 text-foreground leading-tight">{article.title}</h1>
          
          {article.body.map((block, idx) => {
            if (block === '[AD_ZONE]') {
              return null;
            }
            return <div key={idx} dangerouslySetInnerHTML={{ __html: block }} />;
          })}
        </CardContent>
      </Card>
    </div>
  );
}
