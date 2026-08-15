import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ShieldAlert, Trash2, CheckCircle2, Lock, Inbox } from 'lucide-react';
import { useAdminAuth, useListAdminMessages, useUpdateAdminMessage, useDeleteAdminMessage, useUpdateAdminPassword } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { getListAdminMessagesQueryKey } from '@workspace/api-client-react';

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
