'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import StoryCard from '@/components/story/StoryCard';
import {
  fetchStoryGroups,
  type StoryGroup,
} from '@/lib/storyApi';
import { onStoryFeedChanged } from '@/lib/storyEvents';

export interface StoryTrayProps {
  /** Imperative refresh trigger (increments after publish/delete). */
  refreshKey?: number;
  onCreate?: () => void;
  /** Fires whenever the tray data changes (used by pages for their own state). */
  onStoriesChange?: (groups: StoryGroup[]) => void;
  compact?: boolean;
  className?: string;
  /** Scroll container used to collapse the user's own Status while browsing. */
  scrollRef?: { current: HTMLElement | null };
}

const SKELETON = [0, 1, 2, 3, 4];

/**
 * The premium VANTA Story/Status tray.
 *
 * One clear presentation of: who has Stories, who does not, the current user's
 * own Status, the add action, viewed/unviewed rings and the live daily quota.
 * Fetches the existing `/api/stories` + `/api/stories/usage` endpoints — no
 * new backend surface.
 */
export default function StoryTray({
  refreshKey = 0,
  onCreate,
  onStoriesChange,
  compact = false,
  className,
  scrollRef,
}: StoryTrayProps) {
  const { token, user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusCollapsed, setStatusCollapsed] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const storyGroups = await fetchStoryGroups(token);
      if (!mountedRef.current) return;
      setGroups(storyGroups);
      onStoriesChange?.(storyGroups);
    } catch {
      if (!mountedRef.current) return;
      setError(true);
      setGroups([]);
      onStoriesChange?.([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [token, onStoriesChange]);

  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!scroller) return;
    const onScroll = () => setStatusCollapsed(scroller.scrollTop > 84);
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    const unsubscribe = onStoryFeedChanged(() => void load());
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [load, refreshKey]);

  const openViewer = useCallback(
    (owner: { id?: string }, storyId?: string) => {
      const ownerId = owner.id;
      if (!ownerId) return;
      const target = storyId
        ? `/stories/${encodeURIComponent(ownerId)}?start=${encodeURIComponent(storyId)}`
        : `/stories/${encodeURIComponent(ownerId)}`;
      router.push(target);
    },
    [router]
  );

  const ownGroup = groups.find(
    group => String(group.user.id) === String(user?.id)
  );

  const otherGroups = groups.filter(
    group => String(group.user.id) !== String(user?.id)
  );


  return (
    <section
      aria-label="Stories and Status"
      className={cn(
        'border-b border-white/[0.07]',
        compact ? 'py-1.5' : 'px-0 py-2',
        className
      )}
    >
      {error ? (
        <div className="flex items-center gap-3 px-3 py-4">
          <p className="text-xs leading-5 text-[#666]">Couldn&apos;t load Stories.</p>
          <button
            type="button"
            aria-label="Retry loading Stories"
            onClick={() => void load()}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-[#b8b8b8] transition hover:bg-white/[0.05]"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : (
        <div className={cn('flex gap-3 overflow-x-auto pb-1 scrollbar-hide', compact ? 'px-1' : 'px-3')}>
          {/* Own Status card — always present */}
          {!statusCollapsed && <StoryCard
            user={{
              id: user?.id || 'me',
              username: user?.username || 'you',
              fullName: user?.fullName,
              avatar: user?.avatar || null,
              verified: Boolean(user?.verified),
            }}
            stories={ownGroup?.stories || []}
            hasUnviewed={Boolean(ownGroup?.hasUnviewed)}
            isOwn
            onCreate={onCreate}
            onOpen={() => {
              const opener = ownGroup?.stories.find(s => !s.viewed) || ownGroup?.stories[0];
              openViewer({ id: user?.id }, opener?.id);
            }}
            compact={compact}
          />}

          {loading ? (
            SKELETON.map(index => (
              <div key={index} className="flex w-[74px] shrink-0 flex-col items-center gap-1.5">
                <span className={cn('block animate-pulse rounded-full bg-white/[0.05]', compact ? 'h-12 w-12' : 'h-[66px] w-[66px]')} />
                <span className="h-2.5 w-12 animate-pulse rounded bg-white/[0.04]" />
              </div>
            ))
          ) : (
            otherGroups.map(group => {
              const opener = group.hasUnviewed
                ? (group.stories.find(item => !item.viewed) || group.stories[0])
                : group.stories[0];
              return (
                <StoryCard
                  key={group.user.id}
                  user={group.user}
                  stories={group.stories}
                  hasUnviewed={group.hasUnviewed}
                  onOpen={() => openViewer(group.user, opener?.id)}
                  compact={compact}
                />
              );
            })
          )}

        </div>
      )}
      {statusCollapsed && !error && (
        <div className="fixed left-2 top-[max(6px,env(safe-area-inset-top))] z-50 rounded-full bg-[#080808]/95 p-0.5 shadow-md shadow-black/30 ring-1 ring-white/[0.06] backdrop-blur-xl [&_[data-story-card=own]>span:last-child]:hidden">
          <StoryCard
            user={{ id: user?.id || 'me', username: user?.username || 'you', fullName: user?.fullName, avatar: user?.avatar || null, verified: Boolean(user?.verified) }}
            stories={ownGroup?.stories || []}
            hasUnviewed={Boolean(ownGroup?.hasUnviewed)}
            isOwn
            onCreate={onCreate}
            onOpen={() => { const opener = ownGroup?.stories.find(s => !s.viewed) || ownGroup?.stories[0]; openViewer({ id: user?.id }, opener?.id); }}
            compact
          />
        </div>
      )}

    </section>
  );
}