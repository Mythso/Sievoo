import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, Trash2, CheckCircle2, Lock, Inbox, LineChart, TrendingUp, RefreshCw, Plus, ExternalLink } from 'lucide-react';
import { useAdminAuth, useListAdminMessages, useUpdateAdminMessage, useDeleteAdminMessage, useUpdateAdminPassword } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { getListAdminMessagesQueryKey } from '@workspace/api-client-react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  
  const authMutation = useAdminAuth();

  useEffect(() => {
    const saved = localStorage.getItem('sievoo_admin_token');
    if (saved) setToken(saved);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    authMutation.mutate({ data: { password } }, {
      onSuccess: (res) => {
        setToken(res.token);
        localStorage.setItem('sievoo_admin_token', res.token);
        toast({ title: 'Success', description: 'Authenticated successfully.' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Invalid password', variant: 'destructive' });
      }
    });
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('sievoo_admin_token');
  };

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Admin Terminal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Admin Password</Label>
                <Input 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="font-mono bg-input"
                />
              </div>
              <Button type="submit" className="w-full font-mono uppercase tracking-widest bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Authenticate
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminDashboard token={token} onLogout={handleLogout} />;
}

function AdminDashboard({ token, onLogout }: { token: string, onLogout: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const reqOpts = { request: { headers: { 'x-admin-token': token } } };
  
  const { data: messages, isLoading } = useListAdminMessages(reqOpts);
  const updateMsg = useUpdateAdminMessage(reqOpts);
  const deleteMsg = useDeleteAdminMessage(reqOpts);
  const updatePw = useUpdateAdminPassword(reqOpts);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');

  const handleMarkRead = (id: number, status: boolean) => {
    updateMsg.mutate({ id, data: { read_status: status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminMessagesQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm('Are you sure?')) return;
    deleteMsg.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdminMessagesQueryKey() });
        toast({ title: 'Deleted', description: 'Message removed.' });
      }
    });
  };

  const handlePwChange = (e: React.FormEvent) => {
    e.preventDefault();
    updatePw.mutate({ data: { current_password: currentPw, new_password: newPw } }, {
      onSuccess: () => {
        toast({ title: 'Success', description: 'Password updated.' });
        setCurrentPw('');
        setNewPw('');
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to update password. Check current password.', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex-1 container mx-auto max-w-6xl py-12 px-4 space-y-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Admin Terminal</h1>
          <p className="text-muted-foreground font-mono text-sm">System configuration and communications.</p>
        </div>
        <Button variant="outline" onClick={onLogout} className="font-mono text-xs">Logout</Button>
      </div>

      <Tabs defaultValue="messages">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="messages" className="font-mono uppercase text-xs tracking-wider"><Inbox className="w-4 h-4 mr-2"/> Inbox</TabsTrigger>
          <TabsTrigger value="watchlist" className="font-mono uppercase text-xs tracking-wider"><LineChart className="w-4 h-4 mr-2"/> Watchlist</TabsTrigger>
          <TabsTrigger value="statistics" className="font-mono uppercase text-xs tracking-wider"><TrendingUp className="w-4 h-4 mr-2"/> Statistics</TabsTrigger>
          <TabsTrigger value="security" className="font-mono uppercase text-xs tracking-wider"><Lock className="w-4 h-4 mr-2"/> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-6">
          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="border-b border-border/50">
              <CardTitle>Contact Form Submissions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Subject / Message</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                  ) : messages?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Inbox zero.</TableCell></TableRow>
                  ) : (
                    messages?.map(msg => (
                      <TableRow key={msg.id} className={`border-border hover:bg-muted/10 ${msg.read_status ? 'opacity-60' : ''}`}>
                        <TableCell>
                          {msg.read_status ? (
                            <span className="text-xs font-mono text-muted-foreground px-2 py-1 bg-muted rounded">READ</span>
                          ) : (
                            <span className="text-xs font-mono text-primary px-2 py-1 bg-primary/20 rounded font-bold">NEW</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{format(new Date(msg.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <div className="font-bold text-sm">{msg.name}</div>
                          <div className="text-xs text-muted-foreground">{msg.email}</div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="font-bold text-sm">{msg.subject}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{msg.message}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" title="Toggle Read" onClick={() => handleMarkRead(msg.id, !msg.read_status)}>
                              <CheckCircle2 className={`w-4 h-4 ${msg.read_status ? 'text-muted-foreground' : 'text-primary'}`} />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(msg.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watchlist" className="mt-6">
          <WatchlistTab token={token} />
        </TabsContent>

        <TabsContent value="statistics" className="mt-6">
          <StatisticsTab token={token} />
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card className="max-w-xl bg-card border-border shadow-xl">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePwChange} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="bg-input font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="bg-input font-mono" />
                </div>
                <Button type="submit" disabled={updatePw.isPending} className="font-mono uppercase tracking-wider bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  {updatePw.isPending ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface WatchlistInsiderTransaction {
  filer: string | null;
  relation: string | null;
  transaction_text: string | null;
  shares: number | null;
  value: number | null;
  date: string | null;
}

interface WatchlistValuation {
  price: number | null;
  revenue: number | null;
  rev_growth: number | null;
  fcf_margin: number | null;
  beta: number | null;
  wacc: number | null;
  bear_dcf: number | null;
  base_dcf: number | null;
  bull_dcf: number | null;
  margin_of_safety: number | null;
  insider_score: number | null;
  insider_transactions: WatchlistInsiderTransaction[] | null;
  status: 'ok' | 'error';
  error_message: string | null;
  computed_at: string;
}

interface WatchlistCompany {
  id: number;
  ticker: string;
  company_name: string | null;
  notes: string | null;
  projection_years: number;
  auto_publish: boolean;
  published_analysis_id: number | null;
  added_at: string;
  latest_valuation: WatchlistValuation | null;
}

function WatchlistTab({ token }: { token: string }) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<WatchlistCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLookingUpName, setIsLookingUpName] = useState(false);

  // Auto-fill company name as soon as a ticker is typed, without clobbering
  // a name the admin already typed in manually.
  useEffect(() => {
    const trimmed = ticker.trim();
    if (!trimmed) return;
    const handle = setTimeout(async () => {
      setIsLookingUpName(true);
      try {
        const res = await fetch(`/api/ticker-lookup?ticker=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.company_name) {
          setCompanyName(prev => (prev.trim() ? prev : data.company_name));
        }
      } catch {
        // silent - lookup is a convenience, not required
      } finally {
        setIsLookingUpName(false);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [ticker]);
  const [isAdding, setIsAdding] = useState(false);
  const [autoPublish, setAutoPublish] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadWatchlist = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/watchlist');
      if (!res.ok) throw new Error('Failed to load watchlist');
      const data = await res.json();
      setCompanies(data.items);
    } catch (err) {
      toast({ title: 'Error', description: 'Could not load watchlist.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadWatchlist(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setIsAdding(true);
    try {
      const res = await fetch('/api/admin/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), company_name: companyName.trim() || undefined, auto_publish: autoPublish }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to add company');
      }
      const addedTicker = ticker.trim().toUpperCase();
      setTicker('');
      setCompanyName('');
      toast({ title: 'Added', description: `${addedTicker} added to the watchlist.` });
      await loadWatchlist();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add company', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: number, tickerLabel: string) => {
    if (!confirm(`Remove ${tickerLabel} from the watchlist?`)) return;
    try {
      const res = await fetch(`/api/admin/watchlist/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Failed to remove company');
      toast({ title: 'Removed', description: `${tickerLabel} removed.` });
      await loadWatchlist();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to remove company.', variant: 'destructive' });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/watchlist/refresh', {
        method: 'POST',
        headers: { 'x-admin-token': token },
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      toast({ title: 'Refresh complete', description: `${data.updated} updated, ${data.failed} failed.` });
      await loadWatchlist();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to refresh watchlist.', variant: 'destructive' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const fmt = (n: number | null | undefined, decimals = 2) => (n == null ? '\u2014' : n.toFixed(decimals));

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
          <div>
            <CardTitle>Followed Companies</CardTitle>
            <CardDescription>Auto-updated weekly via the watchlist job (Yahoo Finance + DCF).</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="font-mono text-xs">
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh now'}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Ticker</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Bear / Base / Bull</TableHead>
                <TableHead>Margin of Safety</TableHead>
                <TableHead>Insider</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : companies.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No companies followed yet.</TableCell></TableRow>
              ) : (
                companies.map((c) => {
                  const v = c.latest_valuation;
                  const hasTransactions = v?.insider_transactions && v.insider_transactions.length > 0;
                  const isExpanded = expandedId === c.id;
                  const insiderColor = v?.insider_score == null ? 'text-muted-foreground'
                    : v.insider_score >= 60 ? 'text-primary'
                    : v.insider_score <= 40 ? 'text-destructive'
                    : 'text-muted-foreground';
                  return (
                    <>
                      <TableRow key={c.id} className="border-border hover:bg-muted/10">
                        <TableCell>
                          <div className="font-bold text-sm">{c.ticker}</div>
                          {c.company_name && <div className="text-xs text-muted-foreground">{c.company_name}</div>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {v?.status === 'error' ? (
                            <span className="text-destructive">Error</span>
                          ) : v?.price != null ? `$${fmt(v.price)}` : '\u2014'}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {v && v.status === 'ok' ? `$${fmt(v.bear_dcf)} / $${fmt(v.base_dcf)} / $${fmt(v.bull_dcf)}` : '\u2014'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {v && v.status === 'ok' && v.margin_of_safety != null ? (
                            <span className={v.margin_of_safety >= 0 ? 'text-primary' : 'text-destructive'}>
                              {fmt(v.margin_of_safety, 1)}%
                            </span>
                          ) : '\u2014'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {v?.insider_score != null ? (
                            <button
                              onClick={() => hasTransactions && setExpandedId(isExpanded ? null : c.id)}
                              className={`${insiderColor} ${hasTransactions ? 'underline decoration-dotted cursor-pointer' : 'cursor-default'}`}
                              title={hasTransactions ? 'Vis innsiderhandler' : 'Ingen innsiderhandler funnet'}
                            >
                              {v.insider_score}/100
                            </button>
                          ) : '\u2014'}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                          {v ? format(new Date(v.computed_at), 'MMM d, HH:mm') : 'Not yet run'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {c.auto_publish && c.published_analysis_id && (
                              <a
                                href={`/calculator?fork=${c.published_analysis_id}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Se publisert analyse"
                                className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id, c.ticker)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && hasTransactions && (
                        <TableRow key={`${c.id}-insider`} className="border-border bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={7} className="py-3">
                            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                              Siste innsiderhandler \u2014 {c.ticker}
                            </div>
                            <div className="space-y-1.5">
                              {v!.insider_transactions!.map((tx, i) => (
                                <div key={i} className="flex justify-between text-xs border-b border-border/30 pb-1.5 last:border-0">
                                  <div>
                                    <span className="font-bold">{tx.filer ?? 'Ukjent'}</span>
                                    {tx.relation && <span className="text-muted-foreground"> ({tx.relation})</span>}
                                    <span className="text-muted-foreground"> \u2014 {tx.transaction_text ?? 'N/A'}</span>
                                  </div>
                                  <div className="font-mono text-muted-foreground whitespace-nowrap ml-4">
                                    {tx.shares != null && `${tx.shares.toLocaleString()} sh`}
                                    {tx.date && ` \u00b7 ${tx.date}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="max-w-xl bg-card border-border shadow-xl">
        <CardHeader>
          <CardTitle>Add Company</CardTitle>
          <CardDescription>Add a ticker to follow. The weekly job fetches price, fundamentals and runs a fresh DCF automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>Ticker</Label>
              <Input placeholder="e.g. AAPL" value={ticker} onChange={e => setTicker(e.target.value)} className="bg-input font-mono uppercase" />
            </div>
            <div className="space-y-2">
              <Label>Company name {isLookingUpName ? '(looking up...)' : '(auto-filled from ticker, editable)'}</Label>
              <Input placeholder="Auto-filled from ticker" value={companyName} onChange={e => setCompanyName(e.target.value)} className="bg-input" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={e => setAutoPublish(e.target.checked)}
                className="accent-primary"
              />
              Publiser automatisk i community-feeden (oppdateres ukentlig)
            </label>
            <Button type="submit" disabled={isAdding || !ticker.trim()} className="font-mono uppercase tracking-wider bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              {isAdding ? 'Adding...' : 'Add to Watchlist'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

interface WatchlistHistoryPoint {
  computed_at: string;
  price: number | null;
  bear_dcf: number | null;
  base_dcf: number | null;
  bull_dcf: number | null;
  margin_of_safety: number | null;
  graham_number: number | null;
  graham_margin_of_safety: number | null;
}

interface WatchlistHistoryData {
  id: number;
  ticker: string;
  company_name: string | null;
  points: WatchlistHistoryPoint[];
}

interface StatisticsCompanyOption {
  id: number;
  ticker: string;
  company_name: string | null;
}

/**
 * "Statistikk" tab: for a chosen watchlist company, plots every past
 * AutoDCF + AutoValue (Graham) run against the actual stock price on the
 * date it ran. Since every run is stored as its own row (never overwritten),
 * this lets you come back in a few years and see whether the DCF or the
 * Graham Number ended up closer to reality.
 */
function StatisticsTab({ token }: { token: string }) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<StatisticsCompanyOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [history, setHistory] = useState<WatchlistHistoryData | null>(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoadingCompanies(true);
      try {
        const res = await fetch('/api/watchlist');
        if (!res.ok) throw new Error('Failed to load watchlist');
        const data = await res.json();
        const items: StatisticsCompanyOption[] = data.items.map((c: any) => ({
          id: c.id,
          ticker: c.ticker,
          company_name: c.company_name,
        }));
        setCompanies(items);
        if (items.length > 0) setSelectedId(String(items[0].id));
      } catch {
        toast({ title: 'Error', description: 'Could not load company list.', variant: 'destructive' });
      } finally {
        setIsLoadingCompanies(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setIsLoadingHistory(true);
      setHistory(null);
      try {
        const res = await fetch(`/api/admin/watchlist/${selectedId}/history`, {
          headers: { 'x-admin-token': token },
        });
        if (!res.ok) throw new Error('Failed to load history');
        const data: WatchlistHistoryData = await res.json();
        setHistory(data);
      } catch {
        toast({ title: 'Error', description: 'Could not load valuation history.', variant: 'destructive' });
      } finally {
        setIsLoadingHistory(false);
      }
    })();
  }, [selectedId, token]);

  const chartData = (history?.points ?? []).map((p) => ({
    date: format(new Date(p.computed_at), 'MMM d, yyyy'),
    fullDate: p.computed_at,
    Price: p.price,
    'AutoDCF (Base)': p.base_dcf,
    'AutoValue (Graham)': p.graham_number,
  }));

  const selected = companies.find((c) => String(c.id) === selectedId);
  const latest = history?.points[history.points.length - 1];

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 flex-wrap gap-4">
          <div>
            <CardTitle>Valuation History</CardTitle>
            <CardDescription>
              Price on the day each AutoDCF / AutoValue run fired, plotted against that run's DCF and
              Graham Number — so you can come back later and see which one called it right.
            </CardDescription>
          </div>
          <Select value={selectedId} onValueChange={setSelectedId} disabled={isLoadingCompanies || companies.length === 0}>
            <SelectTrigger className="w-[220px] font-mono text-xs bg-input">
              <SelectValue placeholder={isLoadingCompanies ? 'Loading...' : 'Select a company'} />
            </SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={String(c.id)} className="font-mono text-xs">
                  {c.ticker}{c.company_name ? ` \u2014 ${c.company_name}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoadingHistory ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Loading history...</div>
          ) : !history || history.points.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No completed runs yet for {selected?.ticker ?? 'this company'}. Numbers appear here after the
              next scheduled AutoDCF/AutoValue run, or a manual refresh from the Watchlist tab.
            </div>
          ) : (
            <>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                      formatter={(value: number) => (value == null ? '\u2014' : `$${value.toFixed(2)}`)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Price" stroke="#e5e7eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="AutoDCF (Base)" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="AutoValue (Graham)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>

              {latest && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 mt-6 border-t border-border">
                  <div className="bg-background rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Latest Price</p>
                    <p className="text-lg font-bold font-mono">{latest.price != null ? `$${latest.price.toFixed(2)}` : '\u2014'}</p>
                  </div>
                  <div className="bg-background rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">AutoDCF (Base)</p>
                    <p className="text-lg font-bold font-mono text-emerald-400">{latest.base_dcf != null ? `$${latest.base_dcf.toFixed(2)}` : '\u2014'}</p>
                  </div>
                  <div className="bg-background rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">AutoValue (Graham)</p>
                    <p className="text-lg font-bold font-mono text-amber-400">{latest.graham_number != null ? `$${latest.graham_number.toFixed(2)}` : '\u2014'}</p>
                  </div>
                  <div className="bg-background rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground">Runs Recorded</p>
                    <p className="text-lg font-bold font-mono">{history.points.length}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
