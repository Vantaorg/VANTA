'use client';

import { motion } from 'framer-motion';
import { Quote, Repeat2, X } from 'lucide-react';

type Props = {
  close: () => void;
  repost: () => void;
  quote: () => void;
};

// Repost menu for a post: only Repost and Quote. Copy link, Share with… and
// Send in VANTA chat live in the 3-dot menu (FeedPostMoreSheet).
export default function FeedPostRepostSheet({ close, repost, quote }: Props) {
  const options: Array<[string, string, typeof Repeat2, () => void]> = [
    ['repost', 'Repost', Repeat2, repost],
    ['quote', 'Quote', Quote, quote],
  ];
  return <><motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} aria-label="Close repost options" className="fixed inset-0 z-[89] bg-black/70 backdrop-blur-sm"/><motion.section role="dialog" aria-modal="true" aria-label="Repost" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} className="fixed bottom-[var(--vanta-kb,0px)] left-0 right-0 z-[90] mx-auto max-h-[calc(var(--vanta-vh,100dvh)-8px)] max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-white/[.1] bg-[#1b2028] p-4 shadow-2xl sm:bottom-1/2 sm:rounded-2xl sm:p-5 sm:translate-y-1/2"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Repost</h2><button type="button" onClick={close} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8a8a8a] hover:bg-white/[.05] hover:text-white"><X size={18}/></button></div><div className="space-y-1">{options.map(([id, label, Icon, run]) => <button key={id} type="button" onClick={run} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-white/85 transition hover:bg-white/[.06]"><span className="grid h-9 w-9 place-items-center rounded-full bg-white/[.06] text-[#e0bb4f]"><Icon size={18}/></span><span className="flex-1">{label}</span></button>)}</div></motion.section></>;
}
