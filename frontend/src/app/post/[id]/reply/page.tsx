'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MessageCircle, Send } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import CommentPanel from '@/components/social/CommentPanel';
import { useAuth } from '@/context/AuthContext';
import { apiGet } from '@/lib/apiClient';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { renderTextWithLinks } from '@/lib/linkify';

type Post = {
  id: string; content?: string; mediaUrl?: string | null; createdAt?: string;
  comments?: number; commentsCount?: number;
  author: { id: string; username: string; fullName?: string; avatar?: string; verified?: boolean; verificationType?: any };
};

export default function DirectPostReplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const id = decodeURIComponent(rawId).trim();
  const { token, user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    void apiGet<Post>(`/api/feed/${encodeURIComponent(id)}`, token || undefined, { skipCache: true })
      .then(value => { if (active && value?.id) { setPost(value); setCount(Number(value.comments ?? value.commentsCount ?? 0)); } })
      .catch(() => { if (active) setPost(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, token]);

  return <main className="min-h-[100dvh] w-full bg-[var(--background)] text-white">
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[.07] bg-[var(--header-surface)] px-3">
      <button type="button" onClick={() => router.back()} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full text-white/80 hover:bg-white/[.06]"><ArrowLeft size={20}/></button>
      <span className="text-sm font-semibold">Reply</span>
      <span className="w-10"/>
    </header>
    {loading ? <div className="grid min-h-[50vh] place-items-center"><Loader2 className="animate-spin text-white/50"/></div> : !post ? <div className="px-5 py-16 text-center text-sm text-white/55">This post is unavailable.</div> : <>
      <article className="border-b border-white/[.07] px-4 py-4">
        <div className="flex items-center gap-2.5">
          <Link href={`/profile/${encodeURIComponent(post.author.username)}`}><Avatar src={post.author.avatar} alt={post.author.username} size="md"/></Link>
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{post.author.fullName || post.author.username}</p><p className="truncate text-xs text-white/40">@{post.author.username}</p></div>
        </div>
        {post.content && <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-6 text-white/90">{renderTextWithLinks(post.content, 'linkify')}</p>}
        {post.mediaUrl && <img src={resolveMediaUrl(post.mediaUrl)} alt="Post attachment" className="mt-3 max-h-[42vh] w-full rounded-xl bg-black/20 object-contain"/>}
        <p className="mt-3 text-xs text-white/45">Replying to <span className="text-[#55b8f2]">@{post.author.username}</span></p>
      </article>
      {token ? <CommentPanel kind="post" postId={id} postAuthor={post.author} initialCount={count} token={token} currentUser={user} inline compact hideEmojiPicker enableAttachments onClose={() => router.back()} onCountChange={setCount}/> : <div className="px-4 py-10 text-center"><p className="text-sm text-white/55">Sign in to reply.</p><button type="button" onClick={() => router.push('/login')} className="mt-3 rounded-full bg-[#c9a227] px-5 py-2 text-sm font-semibold text-black">Sign in</button></div>}
    </>}
  </main>;
}
