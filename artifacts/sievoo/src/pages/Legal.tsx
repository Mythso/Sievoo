import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Legal({ page }: { page: 'privacy' | 'terms' | 'about' | 'disclaimer' }) {
  const content = {
    privacy: {
      title: 'Privacy Policy',
      body: 'We collect minimal data. Your calculator state is stored locally or securely in our database if you choose to publish an analysis. We do not sell your data. We use cookies only for functional purposes like session management and language preferences.'
    },
    terms: {
      title: 'Terms of Service',
      body: 'By using Sievoo, you agree to our terms. We provide a platform for educational DCF valuation and portfolio tracking. We are not responsible for your investment losses. The community feed content is user-generated and not vetted by Sievoo.'
    },
    about: {
      title: 'About Sievoo',
      body: 'Sievoo is an intelligent quality sieve and valuation engine for investors. Built for those who rely on numbers, not narratives. Our platform stress-tests stocks using proven DCF methodology and strict quality gates.'
    },
    disclaimer: {
      title: 'Disclaimer',
      body: 'FOR EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY. NOT FINANCIAL, LEGAL, OR TAX ADVICE. Conduct your own due diligence (DYOR). Never follow social media influencers blindly. Sievoo is a valuation tool, not an advisory service. Investments carry risk, including the loss of principal.'
    }
  };

  const data = content[page];

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 flex-1">
      <Card className="bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border bg-muted/20">
          <CardTitle className="text-3xl font-bold tracking-tight text-foreground">{data.title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-8 prose prose-invert max-w-none text-foreground/80 leading-relaxed">
          <p>{data.body}</p>
        </CardContent>
      </Card>
    </div>
  );
}
