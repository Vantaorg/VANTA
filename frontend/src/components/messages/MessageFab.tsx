'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Megaphone,
  MessageCircle,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

interface MessageFabProps {
  search: string;
  results: any[];
  onSearch: (value: string) => void;
  onSelectUser: (person: any) => void | Promise<void>;
  onNewGroup: () => void;
  onNewChannel: () => void;
}

const actionBase =
  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a83f]/70';

export default function MessageFab({
  search,
  results,
  onSearch,
  onSelectUser,
  onNewGroup,
  onNewChannel,
}: MessageFabProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vanta:floating-create-open', { detail: { open } }));
    return () => {
      if (open) window.dispatchEvent(new CustomEvent('vanta:floating-create-open', { detail: { open: false } }));
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 80);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (wasOpenRef.current && !open) triggerRef.current?.focus({ preventScroll: true });
    wasOpenRef.current = open;
  }, [open]);

  const choose = (action: () => void | Promise<void>) => {
    close();
    void action();
  };

  const people = Array.isArray(results) ? results : [];
  const query = search.trim();

  return (
    <>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close new conversation menu"
            tabIndex={-1}
            onClick={close}
            className="fixed inset-0 z-[80] cursor-default bg-black/60 backdrop-blur-[3px]"
          />

          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-fab-title"
            className="fixed inset-0 z-[81] flex h-[100dvh] min-h-0 w-screen max-w-none flex-col overflow-hidden bg-[#1F2630] shadow-2xl"
          >
            <div className="shrink-0 border-b border-white/[0.07] px-5 pb-4 pt-[max(18px,env(safe-area-inset-top))]">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#d6a83f]/10 text-[#e6bd58]">
                    <MessageCircle size={19} strokeWidth={1.9} />
                  </span>
                  <div>
                    <h2 id="message-fab-title" className="text-[15px] font-semibold tracking-tight text-white">
                      New Message
                    </h2>
                    <p className="mt-0.5 text-xs text-white/40">
                      Start a chat or create a group or channel
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-full text-white/45 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a83f]/70"
                >
                  <X size={18} />
                </button>
              </div>

              <label htmlFor="message-fab-search" className="sr-only">
                Search people by name or username
              </label>
              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  ref={searchRef}
                  id="message-fab-search"
                  type="search"
                  autoComplete="off"
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                  placeholder="Search people"
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#1a1d22] pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#d6a83f]/55 focus:bg-[#1c2026]"
                />
                {query.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-white/40 hover:bg-white/[0.06] hover:text-white"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(28px,env(safe-area-inset-bottom))] pt-5 [-webkit-overflow-scrolling:touch]">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">
                  {query.length >= 2 ? 'Search results' : 'Create something'}
                </p>
                {query.length >= 2 && (
                  <span className="text-[11px] tabular-nums text-white/30">
                    {people.length} {people.length === 1 ? 'person' : 'people'}
                  </span>
                )}
              </div>

              {query.length >= 2 ? (
                people.length > 0 ? (
                  <div className="space-y-1">
                    {people.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => choose(() => onSelectUser(person))}
                        className={actionBase + ' hover:bg-white/[0.055]'}
                      >
                        <Avatar
                          src={person.avatar || person.profilePicture}
                          alt={person.username || person.fullName || 'VANTA member'}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white">
                            {person.fullName || person.username || 'VANTA member'}
                          </span>
                          {person.username && (
                            <span className="mt-0.5 block truncate text-xs text-white/40">
                              @{person.username}
                            </span>
                          )}
                        </span>
                        <ArrowUpRight size={16} className="shrink-0 text-white/30" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/[0.10] px-4 py-7 text-center">
                    <Search size={19} className="mx-auto mb-2 text-white/25" />
                    <p className="text-sm font-medium text-white/75">No people found</p>
                    <p className="mt-1 text-xs text-white/35">
                      Try another name or username.
                    </p>
                  </div>
                )
              ) : (
                <p className="rounded-xl bg-white/[0.025] px-3 py-3 text-xs leading-5 text-white/40">
                  Type at least 2 characters to find someone on VANTA.
                </p>
              )}

              <div className="mt-4 border-t border-white/[0.07] pt-3">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">
                  Create a group or channel
                </p>
              </div>

              <div className="space-y-1 pb-2">
                <button
                  type="button"
                  onClick={() => choose(onNewGroup)}
                  className={actionBase + ' hover:bg-white/[0.055]'}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d6a83f]/10 text-[#e6bd58]">
                    <Users size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">New Group</span>
                    <span className="mt-0.5 block text-xs text-white/40">Chat with multiple people</span>
                  </span>
                  <ArrowUpRight size={16} className="shrink-0 text-white/30" />
                </button>
                <button
                  type="button"
                  onClick={() => choose(onNewChannel)}
                  className={actionBase + ' hover:bg-white/[0.055]'}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d6a83f]/10 text-[#e6bd58]">
                    <Megaphone size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">New Channel</span>
                    <span className="mt-0.5 block text-xs text-white/40">Broadcast updates to subscribers</span>
                  </span>
                  <ArrowUpRight size={16} className="shrink-0 text-white/30" />
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close new conversation menu' : 'Start a conversation'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4.25rem+var(--vanta-kb,0px)))] right-4 z-[79] grid h-14 w-14 place-items-center rounded-full border border-[#ffe59a]/35 bg-[#d6a83f] text-[#17130a] shadow-[0_8px_26px_rgba(0,0,0,.42)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e4b94f] hover:shadow-[0_12px_30px_rgba(0,0,0,.48)] active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2d47c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101114] md:bottom-6 md:right-6"
      >
        <Plus
          size={25}
          strokeWidth={2.2}
          className={'transition-transform duration-200 ' + (open ? 'rotate-45' : 'rotate-0')}
        />
      </button>
    </>
  );
}
