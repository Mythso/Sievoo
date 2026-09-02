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
      "<pre>WACC = (E/V× Re) + (D/V × Rd × (1 - Tc))</pre>",
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
  },
  'margin-of-safety': {
    title: "Margin of Safety: Benjamin Graham's Central Principle",
    body: [
      "<h2>The Idea That Makes Value Investing Work</h2>",
      "<p>Benjamin Graham, widely regarded as the father of value investing, argued that a rational investor's entire discipline can be reduced to a single phrase: margin of safety. The concept is simple to state and hard to practice. Never pay a price for an asset that leaves no cushion between what you paid and what the asset is actually worth.</p>",
      "<p>Every valuation model, including the DCF calculator on Sievoo, is an estimate built on assumptions about the future. Growth rates, margins, and discount rates can all be wrong. A margin of safety is not a way to guarantee you are right—it is a way to survive being wrong.</p>",
      "<h3>Price Is What You Pay, Value Is What You Get</h3>",
      "<p>Graham drew a sharp line between price and value. Price is set minute-to-minute by the collective mood of the market. Value is a function of a business's assets, earnings power, and future cash flows. The two can diverge wildly and for long stretches of time, which is precisely what creates opportunity for a patient investor.</p>",
      "<p>Buying only when price sits meaningfully below your estimate of value builds in room for estimation error, bad luck, and unforeseen competitive threats—the things that DCF models by construction cannot fully capture.</p>",
      "[AD_ZONE]",
      "<h3>How Much Margin Is Enough?</h3>",
      "<p>Graham did not prescribe one fixed number, but he consistently favored discounts wide enough to absorb the ordinary bumps of business life. A common rule of thumb used by modern value investors is to require intrinsic value to exceed the current price by at least 20-30%, and more for smaller or less predictable businesses.</p>",
      "<pre>Margin of Safety = (Intrinsic Value − Price) / Intrinsic Value</pre>",
      "<p>On Sievoo, this is exactly what the Safety Margin Cushion input on the DCF calculator is designed to do: it deliberately understates projected cash flows so the resulting fair value already carries a built-in buffer, rather than asking you to remember to discount the sticker price afterward.</p>",
      "<h3>Margin of Safety Is Not Diversification</h3>",
      "<p>It is worth distinguishing margin of safety from diversification. Diversification manages the risk that any single position will hurt you badly; margin of safety manages the risk that your analysis of any single position is simply wrong. A concentrated portfolio of businesses bought with a genuine margin of safety can be far less risky, in Graham's sense of permanent capital loss, than a diversified basket of overpriced ones.</p>"
    ]
  },
  'mr-market': {
    title: 'Mr. Market: Why the Market Is Your Servant, Not Your Guide',
    body: [
      "<h2>An Allegory for Market Psychology</h2>",
      "<p>Benjamin Graham illustrated the emotional nature of markets with a simple story. Imagine you own a stake in a private business alongside a business partner named Mr. Market. Every single day, without fail, Mr. Market shows up at your door and offers to either buy your stake or sell you his, always naming a price.</p>",
      "<p>Some days Mr. Market is euphoric and names a price far above what the business is reasonably worth. Other days he is despondent and offers to sell his stake for far less than it is worth. Crucially, Mr. Market does not mind being ignored—if you have nothing to say to him today, he will simply return tomorrow with a new quote.</p>",
      "<h3>The Market Exists to Serve You</h3>",
      "<p>Graham's point was that Mr. Market's daily mood swings tell you nothing about what the underlying business is actually worth. His quotes are an opportunity, not an instruction. A rational investor is free to transact with him only when his price is attractive, and to ignore him entirely the rest of the time.</p>",
      "<p>This reframes volatility. A falling share price in a business whose fundamentals are unchanged is not evidence you were wrong—it may simply be Mr. Market having a bad day, and therefore an invitation to buy more at a better margin of safety.</p>",
      "[AD_ZONE]",
      "<h3>When the Market's Opinion Does Matter</h3>",
      "<p>Ignoring Mr. Market's mood does not mean ignoring the market entirely. Sustained price declines can occasionally reflect real, deteriorating business fundamentals—a widening competitive threat, a broken balance sheet, or a genuine change in the earnings outlook. The discipline is to keep re-checking your own independent estimate of value, and to update it when the facts change, rather than letting the daily quote itself become your estimate.</p>",
      "<h3>Turning Volatility Into an Asset</h3>",
      "<p>Investors who internalize the Mr. Market allegory tend to view volatility as a source of opportunity rather than a source of anxiety. Bear markets stop being purely a threat to net worth and start being a recurring sale on ownership stakes in good businesses, provided your independent valuation work was sound to begin with.</p>"
    ]
  },
  'defensive-vs-enterprising': {
    title: 'Defensive vs. Enterprising Investor: Choosing Your Approach',
    body: [
      "<h2>Two Honest Paths to Investing Well</h2>",
      "<p>Benjamin Graham did not believe every investor should analyze individual businesses. Instead, he split investors into two legitimate categories based on the time, temperament, and effort they are realistically willing to commit, and argued that trying to be a halfhearted version of the more demanding approach was the most dangerous path of all.</p>",
      "<h3>The Defensive Investor</h3>",
      "<p>The defensive investor prioritizes safety and freedom from effort over the chance of outsized returns. Graham's guidance for this group centered on broad diversification, a sensible mix of stocks and bonds, and a preference for large, financially sound, established companies rather than speculative or complex situations.</p>",
      "<p>In modern practice, the defensive approach maps closely onto low-cost index investing—owning the market broadly through funds rather than picking individual winners. Sievoo's Core-Satellite framework builds this directly into its Core allocation.</p>",
      "[AD_ZONE]",
      "<h3>The Enterprising Investor</h3>",
      "<p>The enterprising investor is willing to devote real time and effort to research in exchange for the possibility of better-than-average returns. This path demands independent analysis of individual businesses, a willingness to act against prevailing sentiment when the numbers justify it, and enough emotional discipline to hold a position through periods when the market disagrees with you.</p>",
      "<p>Graham was explicit that this path only pays off if it is done rigorously. An investor who does a little research but ultimately just follows tips or headlines gets neither the safety of the defensive approach nor the genuine edge of the enterprising one.</p>",
      "<h3>Choosing Honestly</h3>",
      "<p>The healthiest starting point is an honest assessment of how much time you will actually spend reading annual reports, tracking competitive dynamics, and revisiting your valuation assumptions. Sievoo's Satellite allocation exists for investors willing to do that work on a small number of high-conviction names, while the Core remains available to everyone regardless of how much research time they can commit.</p>"
    ]
  },
  'graham-number': {
    title: 'The Graham Number: A Quick Screen for Undervalued Stocks',
    body: [
      "<h2>A Fast, Conservative Sanity Check</h2>",
      "<p>Long before discounted cash flow spreadsheets were common, Benjamin Graham looked for a simple formula that combined a company's earnings power and its balance sheet strength into a single conservative estimate of fair value. The result, now known as the Graham Number, is not meant to replace a full valuation—it is meant to flag names worth a closer look and to weed out names that are obviously expensive.</p>",
      "<pre>Graham Number = √(22.5 × EPS × Book Value per Share)</pre>",
      "<p>The constant 22.5 comes from multiplying two of Graham's other rules of thumb for defensive investors: a price-to-earnings ratio no greater than 15, and a price-to-book ratio no greater than 1.5 (15 × 1.5 = 22.5). A stock trading below its Graham Number is, by this conservative measure, statistically cheap relative to both its earnings and its net assets.</p>",
      "<h3>Where It Works, and Where It Doesn't</h3>",
      "<p>The formula was built with stable, asset-heavy, profitable businesses in mind—the kind that made up much of the market in Graham's era. It is far less useful for asset-light, high-growth, or currently unprofitable companies, where book value understates the real economic engine and a low P/E may simply be a red flag rather than a bargain. Use it as a first filter for mature, profitable businesses, not as a universal ranking tool.</p>",
      "[AD_ZONE]",
      "<h3>Graham's Seven Criteria for Defensive Investors</h3>",
      "<p>Graham paired the Graham Number with a broader checklist for defensive investors screening individual stocks. In modern, approximate form, the criteria are:</p>",
      "<ul><li><strong>Adequate size:</strong> A substantial, established company rather than a micro-cap.</li><li><strong>Strong financial condition:</strong> Current assets at least twice current liabilities.</li><li><strong>Earnings stability:</strong> Positive earnings in each of the past ten years.</li><li><strong>Dividend record:</strong> An uninterrupted history of dividend payments.</li><li><strong>Earnings growth:</strong> Meaningful growth in earnings per share over the past decade.</li><li><strong>Moderate P/E ratio:</strong> Current price no more than roughly 15 times average earnings.</li><li><strong>Moderate P/B ratio:</strong> Price no more than roughly 1.5 times book value, or P/E × P/B no greater than 22.5.</li></ul>",
      "<p>Try the interactive version of both the Graham Number and this checklist on the Graham Calculator, and use it alongside the DCF calculator rather than in place of it—a stock that clears both a conservative asset-based screen and a forward-looking cash flow model is a much stronger candidate than one that only clears one of the two.</p>"
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
