import { Link } from 'wouter';
import { SievooLogo } from './SievooLogo';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-8 md:py-12 mt-12">
      <div className="container mx-auto max-w-7xl px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <SievooLogo className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Sievoo.com</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms">Terms</Link>
          <Link href="/about" className="hover:text-foreground transition-colors" data-testid="link-about">About</Link>
          <Link href="/disclaimer" className="hover:text-foreground transition-colors" data-testid="link-disclaimer">Disclaimer</Link>
        </div>
      </div>
      <div className="container mx-auto max-w-4xl px-4 mt-8 text-center">
        <p className="text-xs text-muted-foreground/60 max-w-3xl mx-auto leading-relaxed">
          FOR EDUCATIONAL AND INFORMATIONAL PURPOSES ONLY. NOT FINANCIAL, LEGAL, OR TAX ADVICE. 
          Conduct your own due diligence (DYOR). Never follow social media influencers blindly. 
          Sievoo is a valuation tool, not an advisory service.
        </p>
      </div>
    </footer>
  );
}
