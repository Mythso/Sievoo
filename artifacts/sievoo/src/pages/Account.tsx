import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { UserCircle, LogOut, Bell, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, useAuthActions, useMe, publicNameOf, type SievooUser } from '@/lib/auth';
import { FOLLOWS_QUERY_KEY, useFollows } from '@/lib/community-api';
import { formatMoney, formatPercent, mosClass } from '@/lib/format';
import { useLang } from '@/lib/i18n';

/** Only follow same-site relative paths after login (never an open redirect). */
function safeNext(): string | null {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export default function Account() {
  const { t } = useLang();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useMe();
  const auth = useAuthActions();

  const handleAuthSuccess = (token: string, newUser: SievooUser) => {
    auth.signedIn(token, newUser);
    const next = safeNext();
    if (next) setLocation(next);
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground">{t('Loading...', 'Laster...')}</div>;
  }

  if (user) {
    return (
      <div className="flex-1 container mx-auto max-w-3xl px-4 py-12 space-y-6">
        <Card className="bg-card border-border shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <UserCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle>{publicNameOf(user)}</CardTitle>
                <CardDescription>
                  {user.email} · {t('Member since', 'Medlem siden')} {new Date(user.created_at).toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="font-mono text-xs">
              <Link href={`/u/${user.id}`}>
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> {t('Public profile', 'Offentlig profil')}
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProfileForm user={user} onSaved={auth.updated} />
            <Button
              variant="outline"
              className="w-full font-mono uppercase tracking-widest"
              onClick={async () => {
                await auth.logout();
                toast({ title: t('Logged out', 'Logget ut') });
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('Log out', 'Logg ut')}
            </Button>
          </CardContent>
        </Card>

        <AlertsCard user={user} onSaved={auth.updated} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-12">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <UserCircle className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>{t('Sievoo Account', 'Sievoo-konto')}</CardTitle>
          <CardDescription>
            {t(
              'Free. Publish under your own name, get scored on the leaderboard, comment, and get alerts when stocks you follow get cheap.',
              'Gratis. Publiser under eget navn, bli målt på topplisten, kommenter, og få varsler når aksjer du følger blir billige.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={safeNext() ? 'signup' : 'login'}>
            <TabsList className="grid w-full grid-cols-2 bg-muted border border-border mb-4">
              <TabsTrigger value="login" className="font-mono uppercase text-xs tracking-wider">
                {t('Log in', 'Logg inn')}
              </TabsTrigger>
              <TabsTrigger value="signup" className="font-mono uppercase text-xs tracking-wider">
                {t('Sign up', 'Registrer')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <LoginForm onSuccess={handleAuthSuccess} />
            </TabsContent>
            <TabsContent value="signup">
              <SignupForm onSuccess={handleAuthSuccess} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileForm({ user, onSaved }: { user: SievooUser; onSaved: (u: SievooUser) => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.display_name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(user.display_name ?? ''), [user.display_name]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiFetch<SievooUser>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ display_name: name.trim() || null }),
      });
      onSaved(updated);
      queryClient.invalidateQueries({ queryKey: ['/api/analyses'] });
      toast({ title: t('Profile saved', 'Profilen er lagret') });
    } catch (err: any) {
      toast({ title: t('Error', 'Feil'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-2">
      <Label htmlFor="display-name">{t('Public name', 'Offentlig navn')}</Label>
      <div className="flex gap-2">
        <Input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={`Investor #${user.id}`}
          className="bg-input"
        />
        <Button type="submit" disabled={saving || name.trim() === (user.display_name ?? '')} className="font-mono text-xs uppercase">
          {t('Save', 'Lagre')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          'Shown on your analyses, comments, profile and the leaderboard. Your email is never shown.',
          'Vises på analysene, kommentarene, profilen din og topplisten. E-posten din vises aldri.',
        )}
      </p>
    </form>
  );
}

function AlertsCard({ user, onSaved }: { user: SievooUser; onSaved: (u: SievooUser) => void }) {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const { data, isLoading } = useFollows(true);

  const unfollow = async (ticker: string) => {
    await apiFetch(`/api/follows/${encodeURIComponent(ticker)}`, { method: 'DELETE' });
    queryClient.invalidateQueries({ queryKey: FOLLOWS_QUERY_KEY });
  };

  const toggleDigest = async (on: boolean) => {
    const updated = await apiFetch<SievooUser>('/api/auth/me', { method: 'PATCH', body: JSON.stringify({ weekly_digest: on }) });
    onSaved(updated);
    queryClient.invalidateQueries({ queryKey: FOLLOWS_QUERY_KEY });
  };

  return (
    <Card className="bg-card border-border shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" /> {t('Followed tickers & alerts', 'Fulgte aksjer og varsler')}
        </CardTitle>
        <CardDescription>
          {t(
            'Alerts fire when a ticker reaches your margin-of-safety threshold after a valuation run.',
            'Varsler sendes når en aksje når terskelen din for sikkerhetsmargin etter en verdsettelse.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label htmlFor="digest" className="cursor-pointer">{t('Weekly digest email', 'Ukentlig oppsummering på e-post')}</Label>
            <p className="text-xs text-muted-foreground">{t('Mondays, after the weekly valuation run.', 'Mandager, etter den ukentlige verdsettelsen.')}</p>
          </div>
          <Switch id="digest" checked={user.weekly_digest ?? true} onCheckedChange={toggleDigest} />
        </div>

        {data && !data.email_configured && (
          <p className="text-xs text-muted-foreground">
            {t('Email delivery is being set up - triggered alerts are shown below in the meantime.', 'E-postutsending settes opp - utløste varsler vises her i mellomtiden.')}
          </p>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('Loading...', 'Laster...')}</p>
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('You are not following any tickers yet.', 'Du følger ingen aksjer ennå.')}{' '}
            <Link href="/stocks" className="text-primary hover:underline">{t('Browse stocks →', 'Se aksjer →')}</Link>
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {data.items.map((f) => {
              const mos = f.method === 'graham' ? f.graham_margin_of_safety : f.margin_of_safety;
              return (
                <li key={f.ticker} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <Link href={`/stock/${encodeURIComponent(f.ticker)}`} className="font-mono font-bold hover:text-primary">{f.ticker}</Link>
                    <span className="text-xs text-muted-foreground ml-2 truncate">{f.company_name}</span>
                    <div className="text-xs font-mono text-muted-foreground">
                      {formatMoney(f.price, f.currency)} · {f.method === 'graham' ? 'Graham' : 'DCF'}{' '}
                      <span className={mosClass(mos)}>{formatPercent(mos)}</span> · {t('alert at', 'varsel ved')} {formatPercent(f.min_margin_of_safety, 0)}
                      {f.last_triggered_at && (
                        <span className="text-accent"> · {t('triggered', 'utløst')} {new Date(f.last_triggered_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => unfollow(f.ticker)} aria-label={t(`Unfollow ${f.ticker}`, `Slutt å følge ${f.ticker}`)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LoginForm({ onSuccess }: { onSuccess: (token: string, user: SievooUser) => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: SievooUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      onSuccess(data.token, data.user);
      toast({ title: t('Welcome back', 'Velkommen tilbake') });
    } catch (err: any) {
      toast({ title: t('Error', 'Feil'), description: err.message || 'Login failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('Email', 'E-post')}</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input" autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label>{t('Password', 'Passord')}</Label>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-input"
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full font-mono uppercase tracking-widest">
        {isSubmitting ? t('Logging in...', 'Logger inn...') : t('Log in', 'Logg inn')}
      </Button>
    </form>
  );
}

function SignupForm({ onSuccess }: { onSuccess: (token: string, user: SievooUser) => void }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: SievooUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, display_name: displayName.trim() || undefined }),
      });
      onSuccess(data.token, data.user);
      toast({ title: t('Account created', 'Kontoen er opprettet'), description: t('Welcome to Sievoo.', 'Velkommen til Sievoo.') });
    } catch (err: any) {
      toast({ title: t('Error', 'Feil'), description: err.message || 'Sign up failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('Public name', 'Offentlig navn')}</Label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} className="bg-input" placeholder="ValueHunter" />
        <p className="text-xs text-muted-foreground">{t('Shown on your analyses and the leaderboard. You can change it later.', 'Vises på analysene dine og topplisten. Kan endres senere.')}</p>
      </div>
      <div className="space-y-2">
        <Label>{t('Email', 'E-post')}</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input" autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label>{t('Password', 'Passord')}</Label>
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-input"
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">{t('At least 8 characters.', 'Minst 8 tegn.')}</p>
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full font-mono uppercase tracking-widest">
        {isSubmitting ? t('Creating account...', 'Oppretter konto...') : t('Create free account', 'Lag gratis konto')}
      </Button>
    </form>
  );
}
