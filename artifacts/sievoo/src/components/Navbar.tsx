import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useLang, type Lang } from '@/lib/i18n';
import { useMe, publicNameOf } from '@/lib/auth';
import { Menu, X, Globe, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SievooLogo } from './SievooLogo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const navItemsEn = [
  { label: 'Home', href: '/' },
  { label: 'Stocks', href: '/stocks' },
  { label: 'Calculator', href: '/calculator' },
  { label: 'Graham', href: '/graham-calculator' },
  { label: 'Track Record', href: '/track-record' },
  { label: 'FIRE', href: '/fire' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Academy', href: '/academy' },
];

const navItemsNo = [
  { label: 'Hjem', href: '/' },
  { label: 'Aksjer', href: '/stocks' },
  { label: 'Kalkulator', href: '/calculator' },
  { label: 'Graham', href: '/graham-calculator' },
  { label: 'Treffsikkerhet', href: '/track-record' },
  { label: 'FIRE', href: '/fire' },
  { label: 'Portefølje', href: '/portfolio' },
  { label: 'Akademi', href: '/no/academy' },
];

/** Same page in the other language, for pages that have language-specific URLs. */
function counterpartPath(path: string, lang: Lang): string | null {
  if (lang === 'NO' && /^\/academy(\/|$)/.test(path)) return `/no${path}`;
  if (lang === 'EN' && /^\/no\/academy(\/|$)/.test(path)) return path.replace(/^\/no/, '');
  return null;
}

export function Navbar() {
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { lang, setLang } = useLang();
  const { data: me } = useMe();

  const changeLang = (l: Lang) => {
    setLang(l);
    const other = counterpartPath(location, l);
    if (other) setLocation(other);
  };

  const isActive = (href: string) => (href === '/' ? location === '/' : location === href || location.startsWith(`${href}/`));

  const navItems = lang === 'EN' ? navItemsEn : navItemsNo;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        <div className="flex items-center gap-6 md:gap-8">
          <Link href="/" className="flex items-center space-x-2" data-testid="link-home">
            <SievooLogo className="h-8 w-8 text-foreground" />
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block">Sievoo</span>
          </Link>
          <div className="hidden lg:flex gap-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-foreground/80 whitespace-nowrap ${
                  isActive(item.href) ? 'text-foreground' : 'text-foreground/60'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {me ? (
            <Link href="/account">
              <Button variant="ghost" className="h-9 px-2 gap-2" data-testid="btn-account">
                <UserCircle className="h-4 w-4 text-primary" />
                <span className="hidden sm:inline max-w-[120px] truncate text-sm">{publicNameOf(me)}</span>
              </Button>
            </Link>
          ) : (
            <Link href="/account">
              <Button variant="outline" size="sm" className="h-9 font-mono text-xs uppercase tracking-wider" data-testid="btn-account">
                {lang === 'NO' ? 'Logg inn' : 'Log in'}
              </Button>
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 px-0" data-testid="btn-language">
                <Globe className="h-4 w-4" />
                <span className="sr-only">Toggle language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => changeLang('EN')} className={lang === 'EN' ? 'bg-accent/20' : ''}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLang('NO')} className={lang === 'NO' ? 'bg-accent/20' : ''}>
                Norsk
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            className="lg:hidden px-0 w-9 h-9"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="btn-mobile-menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="lg:hidden border-b border-border bg-background p-4 space-y-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block text-sm font-medium ${
                isActive(item.href) ? 'text-primary' : 'text-foreground/80'
              }`}
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
