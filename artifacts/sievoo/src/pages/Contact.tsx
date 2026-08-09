import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSubmitContact } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Send, CheckCircle2 } from 'lucide-react';

export default function Contact() {
  const { toast } = useToast();
  const mutation = useSubmitContact();
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      toast({ title: 'Error', description: 'Please fill all fields', variant: 'destructive' });
      return;
    }

    mutation.mutate({ data: formData }, {
      onSuccess: () => {
        setSuccess(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="flex-1 py-12 container mx-auto max-w-2xl px-4">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Contact Sievoo</h1>
        <p className="text-muted-foreground">
          Have a question about the valuation engine? Spotted a bug? Reach out below.
        </p>
      </div>

      <Card className="bg-card border-border shadow-2xl">
        <CardContent className="pt-8">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-accent" />
              <CardTitle className="text-2xl">Message Sent</CardTitle>
              <CardDescription className="text-base">We've received your message and will get back to you shortly.</CardDescription>
              <Button onClick={() => setSuccess(false)} variant="outline" className="mt-4 font-mono">Send Another</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name}
                    onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                    placeholder="Jane Doe"
                    className="bg-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData(p => ({...p, email: e.target.value}))}
                    placeholder="jane@example.com"
                    className="bg-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input 
                  id="subject" 
                  value={formData.subject}
                  onChange={e => setFormData(p => ({...p, subject: e.target.value}))}
                  placeholder="Bug report: DCF Calculation"
                  className="bg-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea 
                  id="message" 
                  rows={6}
                  value={formData.message}
                  onChange={e => setFormData(p => ({...p, message: e.target.value}))}
                  placeholder="Describe your issue or question in detail..."
                  className="bg-input resize-none"
                />
              </div>
              <Button type="submit" disabled={mutation.isPending} className="w-full font-mono uppercase tracking-widest h-12">
                {mutation.isPending ? 'Sending...' : <><Send className="w-4 h-4 mr-2" /> Send Message</>}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
