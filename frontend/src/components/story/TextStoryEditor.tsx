'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { publishTextStory } from '@/lib/storyApi';
import { notifyStoryFeedChanged } from '@/lib/storyEvents';
import { STATUS_MAX_CHARS, STATUS_MAX_LINES, normalizeStatusEditorValue, statusCounts } from '@/lib/statusLimits';
import { DEFAULT_TEXT_STYLE, STORY_BACKGROUNDS, backgroundById, fontById } from '@/components/story/storyPresets';

export interface TextStoryEditorProps { onBack?: () => void; onClose?: () => void; onPublished?: () => void; }

export default function TextStoryEditor({ onBack, onClose, onPublished }: TextStoryEditorProps) {
  const { token } = useAuth();
  const toast = useToast();
  const [text, setText] = useState('');
  const [background, setBackground] = useState(DEFAULT_TEXT_STYLE.background);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const counts = useMemo(() => statusCounts(text), [text]);
  const selectedBackground = useMemo(() => backgroundById(background), [background]);
  const defaultFont = useMemo(() => fontById(DEFAULT_TEXT_STYLE.font), []);
  const remaining = STATUS_MAX_CHARS - counts.chars;
  const canPublish = Boolean(token && text.trim() && !counts.overChars && !counts.overLines && !publishing);

  useEffect(() => { document.querySelector<HTMLTextAreaElement>('[data-text-story-input]')?.focus(); }, []);

  const handlePublish = async () => {
    if (!token) { setError('Please sign in to publish your story.'); return; }
    if (!text.trim() || counts.overChars || counts.overLines || publishing) return;
    setError('');
    setPublishing(true);
    try {
      await publishTextStory(token, text.trim(), {
        background, font: DEFAULT_TEXT_STYLE.font, size: DEFAULT_TEXT_STYLE.size,
        color: selectedBackground.ink || DEFAULT_TEXT_STYLE.color, align: DEFAULT_TEXT_STYLE.align,
        weight: DEFAULT_TEXT_STYLE.weight, italic: false, letterSpacing: defaultFont.letterSpacing,
        lineHeight: defaultFont.lineHeight, alignY: DEFAULT_TEXT_STYLE.alignY, uppercase: false,
      });
      notifyStoryFeedChanged();
      toast.success('Story published');
      onPublished?.();
      onClose?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to publish story.');
    } finally { setPublishing(false); }
  };

  return (
    <div className="flex h-full items-center justify-center bg-black/75 p-3 sm:p-5" data-testid="text-story-editor">
      <section role="dialog" aria-modal="true" aria-label="Write a text story" className="flex max-h-[min(88dvh,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101012] shadow-2xl shadow-black/60">
        <header className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
          <button type="button" onClick={onBack || onClose} aria-label="Back to story media" className="grid h-9 w-9 place-items-center rounded-full text-white/65 transition hover:bg-white/[0.06] hover:text-white"><ArrowLeft size={18} /></button>
          <h2 className="min-w-0 flex-1 text-sm font-semibold text-white">Text story</h2>
          <span className={cn('text-xs tabular-nums', remaining < 0 ? 'text-red-300' : 'text-white/40')} aria-live="polite">{remaining}</span>
          <button type="button" onClick={onClose} aria-label="Close text story" className="grid h-9 w-9 place-items-center rounded-full text-white/55 transition hover:bg-white/[0.06] hover:text-white"><X size={18} /></button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="relative flex min-h-[210px] items-center justify-center overflow-hidden rounded-xl px-5 py-6" style={{ background: selectedBackground.css }}>
            <textarea data-text-story-input value={text} onChange={(event) => setText(normalizeStatusEditorValue(event.target.value))} placeholder="What would you like to share?" aria-label="Story text" rows={5} maxLength={STATUS_MAX_CHARS + 50} className="min-h-[150px] w-full resize-none bg-transparent text-center text-[25px] font-bold leading-tight text-white outline-none placeholder:text-white/55" style={{ color: selectedBackground.ink || DEFAULT_TEXT_STYLE.color, fontFamily: defaultFont.css, lineHeight: defaultFont.lineHeight }} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-medium text-white/55">Background</p><p className="text-[10px] text-white/35">{counts.lines}/{STATUS_MAX_LINES} lines</p></div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Story background">
              {STORY_BACKGROUNDS.slice(0, 8).map((item) => {
                const active = item.id === background;
                return <button key={item.id} type="button" role="radio" aria-checked={active} aria-label={item.label} onClick={() => setBackground(item.id)} className={cn('h-9 w-9 shrink-0 rounded-full transition', active ? 'ring-2 ring-[#dfbd55] ring-offset-2 ring-offset-[#101012]' : 'ring-1 ring-white/20')} style={{ background: item.css }} />;
              })}
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        </div>
        <footer className="shrink-0 border-t border-white/[0.07] p-3">
          <button type="button" onClick={() => void handlePublish()} disabled={!canPublish} className={cn('flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition', canPublish ? 'bg-[#d6b24b] text-black hover:bg-[#e4c66a]' : 'cursor-not-allowed bg-white/[0.08] text-white/35')}>
            {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing…</> : 'Publish story'}
          </button>
        </footer>
      </section>
    </div>
  );
}
