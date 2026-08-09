import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SievooLogo } from './SievooLogo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const navItemsEn = [
  { label: 'Home', href: '/' },
  { label: 'Calculator', href: '/calculator' },
  { label: 'FIRE', href: '/fire' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Academy', href: '/academy' },
  { label: 'Contact', href: '/contact' },
];

const navItemsNo = [
  { label: 'Hjem', href: '/' },
  { label: 'Kalkulator', href: '/calculator' },
  { label: 'FIRE', href: '/fire' },
  { label: 'Portefølje', href: '/portfolio' },
  { label: 'Akademi', href: '/academy' },
  { label: 'Kontakt', href: '/contact' },
];

export function Navbar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [lang, setLang] = useState<'EN' | 'NO'>('EN');

  useEffect(() => {
    const savedLang = localStorage.getItem('sievoo_lang') as 'EN' | 'NO';
    if (savedLang) setLang(savedLang);
  }, []);

  const changeLang = (l: 'EN' | 'NO') => {
    setLang(l);
    localStorage.setItem('sievoo_lang', l);
  };

  const navItems = lang === 'EN' ? navItemsEn : navItemsNo;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 mx-auto max-w-7xl">
        <div className="flex items-center gap-6 md:gap-8">
          <Link href="/" className="flex items-center space-x-2" data-testid="link-home">
            <SievooLogo className="h-8 w-8 text-foreground" />
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block">Sievoo</span>
          </Link>
          <div className="hidden md:flex gap-6">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-foreground/80 ${
                  location === item.href ? 'text-foreground' : 'text-foreground/60'
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
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
            className="md:hidden px-0 w-9 h-9"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="btn-mobile-menu"
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-b border-border bg-background p-4 space-y-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block text-sm font-medium ${
                location === item.href ? 'text-primary' : 'text-foreground/80'
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
