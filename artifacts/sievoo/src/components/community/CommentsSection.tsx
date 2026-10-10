import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { useListComments, getListCommentsQueryKey, useCreateComment } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useMe, publicNameOf } from '@/lib/auth';
import { useLang } from '@/lib/i18n';

/** Discussion thread under an analysis. Reading is public; posting needs an account. */
export function CommentsSection({ analysisId }: { analysisId: number }) {
  const { t } = useLang();
  const { toast } = useToast();
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const { data: comments, isLoading } = useListComments(analysisId);
  const createComment = useCreateComment();
  const [text, setText] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    createComment.mutate(
      { id: analysisId, data: { comment_text: trimmed } },
      {
        onSuccess: () => {
          setText('');
          queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(analysisId) });
        },
        onError: (err: any) => {
          toast({
            title: t('Could not post comment', 'Kunne ikke publisere kommentaren'),
            description: err?.data?.error ?? err?.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        {t('Discussion', 'Diskusjon')}
        {comments && comments.length > 0 && <span className="text-muted-foreground font-mono text-sm">({comments.length})</span>}
      </h2>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('Loading...', 'Laster...')}</p>
      ) : !comments || comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('No comments yet. Challenge the assumptions - that is what this is for.', 'Ingen kommentarer ennå. Utfordre forutsetningene - det er det dette er til for.')}
        </p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg border border-border bg-background/50 p-4">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
                {c.user_id ? (
                  <Link href={`/u/${c.user_id}`} className="text-foreground hover:text-primary font-semibold">
                    {c.author_name}
                  </Link>
                ) : (
                  <span className="text-foreground font-semibold">{c.author_name}</span>
                )}
                <span>·</span>
                <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{c.comment_text}</p>
            </li>
          ))}
        </ul>
      )}

      {me ? (
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder={t(`Comment as ${publicNameOf(me)}…`, `Kommenter som ${publicNameOf(me)}…`)}
            className="bg-input min-h-[90px]"
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={createComment.isPending || !text.trim()} className="font-mono text-xs uppercase tracking-wider">
              {createComment.isPending ? t('Posting...', 'Publiserer...') : t('Post comment', 'Publiser kommentar')}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm">
          <Link href={`/account?next=${encodeURIComponent(`/analysis/${analysisId}`)}`} className="text-primary hover:underline">
            {t('Log in or create a free account', 'Logg inn eller lag en gratis konto')}
          </Link>{' '}
          <span className="text-muted-foreground">{t('to join the discussion.', 'for å delta i diskusjonen.')}</span>
        </p>
      )}
    </section>
  );
}
