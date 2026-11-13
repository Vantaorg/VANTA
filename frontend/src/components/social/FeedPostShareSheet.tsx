'use client';

import { motion } from 'framer-motion';
import { Link2, MessageCircle, Smartphone, X } from 'lucide-react';

type FeedShareDestination = 'COPY_LINK' | 'NATIVE' | 'MESSAGE';

type Props = {
  close: () => void;
  share: (destination: FeedShareDestination) => void;
  /** Sheet heading — "Share post" by default, "Share reel" on Reel detail. */
  title?: string;
};

/**
 * FeedPostShareSheet — the bottom sheet for sharing a post or reel. Identical on
 * Home, Profile and the Post/Reel detail pages so the share action interaction
 * UI is consistent. Each destination is a real backend action supplied by the
 * caller (copy link, native share, message).
 */
export default function FeedPostShareSheet({ close, share, title = 'Share post' }: Props) {
  const destinations: Array<[FeedShareDestination, string, typeof Link2]> = [
    ['COPY_LINK', 'Copy link', Link2],
    ['NATIVE', 'Share with…', Smartphone],
    ['MESSAGE', 'Send in VANTA chat', MessageCircle],
  ];
  return <><motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} aria-label="Close share options" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"/><motion.section role="dialog" aria-modal="true" aria-label={title} initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} className="fixed bottom-[var(--vanta-kb,0px)] left-0 right-0 z-50 mx-auto max-h-[calc(var(--vanta-vh,100dvh)-8px)] max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-white/[.1] bg-[#1b2028] p-4 shadow-2xl sm:bottom-1/2 sm:rounded-2xl sm:p-5 sm:translate-y-1/2"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button type="button" onClick={close} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8a8a8a] hover:bg-white/[.05] hover:text-white"><X size={18}/></button></div><div className="space-y-1">{destinations.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => share(id)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-white/85 transition hover:bg-white/[.06]"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/[.06] text-[#e0bb4f]"><Icon size={18}/></span><span className="flex-1">{label}</span><span className="text-xs text-white/35">{id === 'COPY_LINK' ? 'Copy URL' : id === 'MESSAGE' ? 'Choose a conversation' : 'Use device share menu'}</span></button>)}</div></motion.section></>;
}