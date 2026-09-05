import { useState, useEffect, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { UserCircle, LogOut } from 'lucide-react';

interface SievooUser {
  id: number;
  email: string;
  display_name: string | null;
  created_at: string;
}

const TOKEN_KEY = 'sievoo_user_token';

export default function Account() {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<SievooUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setIsLoading(false);
      return;
    }
    setToken(saved);
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { headers: { 'x-auth-token': saved } });
        if (!res.ok) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          return;
        }
        setUser(await res.json());
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleAuthSuccess = (newToken: string, newUser: SievooUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'x-auth-token': token } });
      } catch {
        // best-effort - clear local state regardless
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    toast({ title: 'Logged out' });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card border-border shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <UserCircle className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>My Account</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              {user.display_name ? `Signed in as ${user.display_name}` : 'Signed in'} · Member since{' '}
              {new Date(user.created_at).toLocaleDateString()}
            </div>
            <Button variant="outline" className="w-full font-mono uppercase tracking-widest" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <UserCircle className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Sievoo Account</CardTitle>
          <CardDescription>Free for now — create an account to save your spot.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2 bg-muted border border-border mb-4">
              <TabsTrigger value="login" className="font-mono uppercase text-xs tracking-wider">
                Log in
              </TabsTrigger>
              <TabsTrigger value="signup" className="font-mono uppercase text-xs tracking-wider">
                Sign up
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

function LoginForm({ onSuccess }: { onSuccess: (token: string, user: SievooUser) => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onSuccess(data.token, data.user);
      toast({ title: 'Welcome back' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Login failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input" />
      </div>
      <div className="space-y-2">
        <Label>Password</Label>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-input"
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full font-mono uppercase tracking-widest">
        {isSubmitting ? 'Logging in...' : 'Log in'}
      </Button>
    </form>
  );
}

function SignupForm({ onSuccess }: { onSuccess: (token: string, user: SievooUser) => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name: displayName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sign up failed');
      onSuccess(data.token, data.user);
      toast({ title: 'Account created', description: 'Welcome to Sievoo.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Sign up failed', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Name (optional)</Label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-input" />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input" />
      </div>
      <div className="space-y-2">
        <Label>Password</Label>
        <Input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-input"
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full font-mono uppercase tracking-widest">
        {isSubmitting ? 'Creating account...' : 'Create free account'}
      </Button>
    </form>
  );
}
