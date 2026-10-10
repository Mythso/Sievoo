import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiFetch, useMe } from '@/lib/auth';
import { FOLLOWS_QUERY_KEY, stockQueryKey, type FollowSettings } from '@/lib/community-api';
import { useLang } from '@/lib/i18n';

/**
 * Follow a ticker and get an email when its margin of safety reaches a
 * threshold (checked after every valuation run, plus a weekly digest).
 */
export function FollowButton({
  ticker,
  follow,
  followers,
}: {
  ticker: string;
  follow: FollowSettings | null;
  followers: number;
}) {
  const { t } = useLang();
  const { toast } = useToast();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<'dcf' | 'graham'>(follow?.method ?? 'dcf');
  const [threshold, setThreshold] = useState(String(follow?.min_margin_of_safety ?? 20));
  const [email, setEmail] = useState(follow?.email_enabled ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMethod(follow?.method ?? 'dcf');
    setThreshold(String(follow?.min_margin_of_safety ?? 20));
    setEmail(follow?.email_enabled ?? true);
  }, [open, follow]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: stockQueryKey(ticker) });
    queryClient.invalidateQueries({ queryKey: FOLLOWS_QUERY_KEY });
  };

  const save = async () => {
    const value = Number(threshold);
    if (!Number.isFinite(value)) return;
    setSaving(true);
    try {
      await apiFetch(`/api/follows/${encodeURIComponent(ticker)}`, {
        method: 'PUT',
        body: JSON.stringify({ method, min_margin_of_safety: value, email_enabled: email }),
      });
      toast({
        title: t(`Following ${ticker}`, `Du følger ${ticker}`),
        description: t(
          `We'll tell you when the ${method === 'dcf' ? 'DCF' : 'Graham'} margin of safety reaches ${value}%.`,
          `Vi sier fra når ${method === 'dcf' ? 'DCF' : 'Graham'}-sikkerhetsmarginen når ${value} %.`,
        ),
      });
      setOpen(false);
      refresh();
    } catch (err: any) {
      toast({ title: t('Error', 'Feil'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const unfollow = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/follows/${encodeURIComponent(ticker)}`, { method: 'DELETE' });
      setOpen(false);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  if (!me) {
    return (
      <Button asChild variant="outline" className="font-mono text-xs uppercase tracking-wider">
        <Link href={`/account?next=${encodeURIComponent(`/stock/${ticker}`)}`}>
          <Bell className="w-4 h-4 mr-2" />
          {t('Log in to follow', 'Logg inn for å følge')}
          {followers > 0 && <span className="ml-2 text-muted-foreground">· {followers}</span>}
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={follow ? 'default' : 'outline'}
        className="font-mono text-xs uppercase tracking-wider"
        onClick={() => setOpen(true)}
        data-testid="btn-follow"
      >
        {follow ? <BellRing className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
        {follow ? t('Following', 'Følger') : t('Follow & get alerts', 'Følg og få varsler')}
        {followers > 0 && <span className="ml-2 opacity-70">· {followers}</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-mono">{t(`Alert for ${ticker}`, `Varsel for ${ticker}`)}</DialogTitle>
            <DialogDescription>
              {t(
                'Get an email when the margin of safety reaches your threshold, plus a short weekly digest of everything you follow.',
                'Få en e-post når sikkerhetsmarginen når terskelen din, pluss en kort ukentlig oppsummering av alt du følger.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('Valuation method', 'Verdsettelsesmetode')}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as 'dcf' | 'graham')}>
                <SelectTrigger className="bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dcf">AutoDCF ({t('base case', 'basis')})</SelectItem>
                  <SelectItem value="graham">AutoValue (Graham Number)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('Alert when margin of safety is at least (%)', 'Varsle når sikkerhetsmarginen er minst (%)')}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="bg-input font-mono"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor="alert-email" className="cursor-pointer">
                {t('Email me', 'Send meg e-post')}
              </Label>
              <Switch id="alert-email" checked={email} onCheckedChange={setEmail} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {follow && (
              <Button variant="ghost" onClick={unfollow} disabled={saving}>
                {t('Unfollow', 'Slutt å følge')}
              </Button>
            )}
            <Button onClick={save} disabled={saving} className="font-mono">
              {saving ? t('Saving...', 'Lagrer...') : t('Save alert', 'Lagre varsel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
