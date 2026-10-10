import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { SiX, SiReddit, SiFacebook } from 'react-icons/si';
import { FaLinkedin } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { useLang } from '@/lib/i18n';

const SITE_URL = 'https://sievoo.com';

/**
 * Share links for a page. Each shared link unfurls into the page's dynamic
 * share image (served from /api/og/...), so posts show the actual numbers.
 */
export function ShareButtons({ path, text }: { path: string; text: string }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const url = `${SITE_URL}${path}`;
  const u = encodeURIComponent(url);
  const tx = encodeURIComponent(text);

  const links = [
    { label: 'X', icon: SiX, href: `https://x.com/intent/post?text=${tx}&url=${u}` },
    { label: 'Reddit', icon: SiReddit, href: `https://www.reddit.com/submit?url=${u}&title=${tx}` },
    { label: 'LinkedIn', icon: FaLinkedin, href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: 'Facebook', icon: SiFacebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t('Copy this link', 'Kopier lenken'), url);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map(({ label, icon: Icon, href }) => (
        <Button key={label} asChild variant="outline" size="sm" className="font-mono text-xs">
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${t('Share on', 'Del på')} ${label}`}>
            <Icon className="w-3.5 h-3.5 mr-1.5" />
            {label}
          </a>
        </Button>
      ))}
      <Button variant="outline" size="sm" className="font-mono text-xs" onClick={copy}>
        {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-accent" /> : <Link2 className="w-3.5 h-3.5 mr-1.5" />}
        {copied ? t('Copied', 'Kopiert') : t('Copy link', 'Kopier lenke')}
      </Button>
    </div>
  );
}
