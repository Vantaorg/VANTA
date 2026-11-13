'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useContentCreation } from './ContentCreationContext';
import { GO_LIVE_ROUTE } from '@/lib/goLiveEntry';
import {
  Plus,
  ImagePlus,
  Clapperboard,
  Radio,
  X,
  Zap,
  ChevronRight,
} from 'lucide-react';

interface CreateHubProps {
  open: boolean;
  onClose: () => void;
}

const creationOptions = [
  {
    id: 'post',
    icon: ImagePlus,
    label: 'Create Post',
    description: 'Share text, photos or a video',
  },
  {
    id: 'reel',
    icon: Clapperboard,
    label: 'Upload Reel',
    description: 'Share a short vertical video',
  },
  {
    id: 'livestream',
    icon: Radio,
    label: 'Go Live',
    description: 'Start a live broadcast',
  },
  {
    id: 'story',
    icon: Zap,
    label: 'Story',
    description: 'Post a moment that lasts 24 hours',
  },
];

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, y: '100%' },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 30, stiffness: 320 } },
  exit: { opacity: 0, y: '100%', transition: { duration: 0.2, ease: 'easeIn' } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.035 + i * 0.025, duration: 0.24, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function CreateHub({ open, onClose }: CreateHubProps) {
  const router = useRouter();
  const { openPostModal, openStoryModal, openReelUploader } = useContentCreation();

  const handleSelect = (option: typeof creationOptions[number]) => {
    onClose();

    switch (option.id) {
      case 'post':
        openPostModal();
        break;
      case 'story':
        openStoryModal();
        break;
      case 'reel':
        openReelUploader();
        break;
      case 'livestream':
        // Keep livestream creation on its dedicated pre-live screen.
        router.push(GO_LIVE_ROUTE);
        break;
    }
  };

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close create menu"
            tabIndex={-1}
            className="fixed inset-0 z-[var(--z-modal-backdrop)] cursor-default bg-black/65 backdrop-blur-[2px]"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />

          <motion.section
            id="vanta-create-hub"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vanta-create-title"
            className="fixed inset-x-0 bottom-[var(--vanta-kb,0px)] z-[var(--z-modal)] mx-auto flex w-full max-w-[480px] flex-col"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex max-h-[min(560px,calc(var(--vanta-vh,100dvh)-1rem))] flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-white/[0.08] bg-[#1F2630] pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_55px_rgba(0,0,0,0.45)]">
              <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-white/20" />

              <header className="flex shrink-0 items-center justify-between px-5 pb-4 pt-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#d6a83f]/12 text-[#e6bd58]">
                    <Plus size={21} strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <h2 id="vanta-create-title" className="text-[17px] font-semibold tracking-tight text-white">Create</h2>
                    <p className="mt-0.5 text-xs text-white/45">Choose how you want to share.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a83f]/70"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1">
                <div className="space-y-1.5">
                  {creationOptions.map((option, i) => {
                    const Icon = option.icon;
                    return (
                      <motion.button
                        key={option.id}
                        type="button"
                        custom={i}
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        onClick={() => handleSelect(option)}
                        className={cn(
                          'group flex min-h-[68px] w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition-colors',
                          'border border-transparent bg-[#171f29]/75 hover:border-white/[0.07] hover:bg-[#263240] active:bg-[#2b3948]',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d6a83f]/70',
                        )}
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#d6a83f]/10 text-[#e6bd58] transition-colors group-hover:bg-[#d6a83f]/15">
                          <Icon size={20} strokeWidth={1.9} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-white">{option.label}</span>
                          <span className="mt-1 block text-xs leading-4 text-white/45">{option.description}</span>
                        </span>
                        <ChevronRight size={17} className="shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-white/55" />
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
