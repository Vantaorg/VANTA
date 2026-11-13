'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Hash, MessageCircle, Plus, Search, Users, X } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

interface MessagesCreateButtonProps {
  search: string;
  results: any[];
  onSearch: (value: string) => void;
  onSelectUser: (person: any) => void | Promise<void>;
  onNewGroup: () => void;
  onNewChannel: () => void;
}

export default function MessagesCreateButton({
  search,
  results,
  onSearch,
  onSelectUser,
  onNewGroup,
  onNewChannel,
}: MessagesCreateButtonProps) {
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 120);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.clearTimeout(timer);
    };
  }, [open]);

  const choose = (action: () => void | Promise<void>) => {
    setOpen(false);
    void action();
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.button type="button" aria-label="Close new chat menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 z-[80] cursor-default bg-black/65 backdrop-blur-[2px]" />
            <motion.section role="dialog" aria-modal="true" aria-labelledby="new-chat-title" initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.98 }} transition={{ type: 'spring', damping: 28, stiffness: 340 }} className="fixed inset-x-0 bottom-0 z-[81] mx-auto flex max-h-[min(82dvh,700px)] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] border border-white/[0.09] bg-[#101012] shadow-[0_-18px_70px_rgba(0,0,0,.55)] md:bottom-6 md:rounded-[26px]">
              <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-white/20 md:hidden" />
              <header className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#d6a83f]/25 bg-[#d6a83f]/10 text-[#f2c75c]"><MessageCircle size={19}/></div>
                <div className="min-w-0 flex-1"><h2 id="new-chat-title" className="text-sm font-semibold text-white">New conversation</h2><p className="mt-0.5 text-[11px] text-white/40">Start a chat, group, or channel</p></div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-white/55 hover:bg-white/[0.06] hover:text-white"><X size={18}/></button>
              </header>
              <div className="shrink-0 px-4 py-3"><label htmlFor="new-chat-search" className="sr-only">Search people</label><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"/><input ref={searchRef} id="new-chat-search" type="search" value={search} onChange={event => onSearch(event.target.value)} placeholder="Search people" className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#18181b] pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#d6a83f]/45"/></div></div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(16px,env(safe-area-inset-bottom))]">
                <div className="mb-1 flex items-center justify-between px-2 pt-1"><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-white/35">People</p>{search.length > 0 && <button type="button" onClick={() => onSearch('')} className="text-[11px] text-[#f2c75c]">Clear</button>}</div>
                {results.map(person => <button key={person.id} type="button" onClick={() => choose(() => onSelectUser(person))} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition hover:bg-white/[0.05]"><Avatar src={person.avatar} alt={person.username || person.fullName} size="sm"/><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{person.fullName || person.username}</span><span className="mt-0.5 block truncate text-[11px] text-white/40">@{person.username}</span></span><ArrowUpRight size={15} className="text-white/30"/></button>)}
                {search.trim().length >= 2 && results.length === 0 && <p className="px-3 py-4 text-xs text-white/40">No people found. Try another name.</p>}{search.trim().length < 2 && <p className="px-3 py-2 text-xs text-white/30">Search by name or username to start a direct chat.</p>}
                <div className="mb-2 mt-4 border-t border-white/[0.07] pt-3"><p className="px-2 text-[10px] font-semibold uppercase tracking-[.15em] text-white/35">Create a space</p></div>
                <button type="button" onClick={() => choose(onNewGroup)} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left transition hover:bg-white/[0.05]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#d6a83f]/20 bg-[#d6a83f]/[0.08] text-[#e5b849]"><Users size={19}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">New group</span><span className="mt-0.5 block text-[11px] text-white/40">Chat together with friends</span></span><ArrowUpRight size={15} className="text-white/30 transition group-hover:text-[#f2c75c]"/></button>
                <button type="button" onClick={() => choose(onNewChannel)} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left transition hover:bg-white/[0.05]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#d6a83f]/20 bg-[#d6a83f]/[0.08] text-[#e5b849]"><Hash size={19}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">New channel</span><span className="mt-0.5 block text-[11px] text-white/40">Share updates with an audience</span></span><ArrowUpRight size={15} className="text-white/30 transition group-hover:text-[#f2c75c]"/></button>
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
      <motion.button type="button" onClick={() => setOpen(value => !value)} initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: open ? 45 : 0 }} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }} className="vanta-floating-action fixed bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4.25rem+var(--vanta-kb,0px)))] right-4 z-[79] grid h-[52px] w-[52px] place-items-center md:bottom-6 md:right-6" aria-label={open ? 'Close new conversation menu' : 'New conversation'} aria-haspopup="dialog" aria-expanded={open}><Plus size={27} strokeWidth={2.4}/></motion.button>
    </>
  );
}
