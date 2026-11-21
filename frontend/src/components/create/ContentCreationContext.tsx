'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { QuoteRef } from '@/lib/quotePost';

type CreationFlow = 'post' | 'story' | 'live' | 'reel' | null;

/** Draft authored in the "+" Go Live modal, carried into the Live Studio so
 *  a user's setup (title, category, thumbnail) is never lost on navigation. */
export interface LiveDraft {
  title: string;
  category: string;
  thumbnailUrl?: string;
}

interface ContentCreationState {
  activeFlow: CreationFlow;
  createHubOpen: boolean;
  liveDraft: LiveDraft | null;
  setLiveDraft: (draft: LiveDraft) => void;
  clearLiveDraft: () => void;
  openCreateHub: () => void;
  closeCreateHub: () => void;
  /** Text pre-filled into the post composer (used by Quote). */
  postPrefill: string;
  /** Post being quoted in the composer (shown as a card, URL appended on publish). */
  quoteTarget: QuoteRef | null;
  openQuotePost: (prefill: string | QuoteRef) => void;
  openPostModal: () => void;
  openStoryModal: () => void;
  openGoLiveModal: () => void;
  openReelUploader: () => void;
  closeAll: () => void;
}

const ContentCreationContext = createContext<ContentCreationState | null>(null);

export function ContentCreationProvider({ children }: { children: ReactNode }) {
  const [activeFlow, setActiveFlow] = useState<CreationFlow>(null);
  const [createHubOpen, setCreateHubOpen] = useState(false);
  const [postPrefill, setPostPrefill] = useState('');
  const [quoteTarget, setQuoteTarget] = useState<QuoteRef | null>(null);
  const [liveDraft, setLiveDraftState] = useState<LiveDraft | null>(null);

  const setLiveDraft = useCallback((draft: LiveDraft) => setLiveDraftState(draft), []);
  const clearLiveDraft = useCallback(() => setLiveDraftState(null), []);

  const openCreateHub = useCallback(() => setCreateHubOpen(true), []);
  const closeCreateHub = useCallback(() => setCreateHubOpen(false), []);

  const openPostModal = useCallback(() => {
    setPostPrefill('');
    setQuoteTarget(null);
    setActiveFlow('post');
  }, []);

  const openQuotePost = useCallback((prefill: string | QuoteRef) => {
    if (typeof prefill === 'string') { setPostPrefill(prefill); setQuoteTarget(null); }
    else { setPostPrefill(''); setQuoteTarget(prefill); }
    setActiveFlow('post');
  }, []);

  const openGoLiveModal = useCallback(() => {
    setActiveFlow('live');
  }, []);

  const openStoryModal = useCallback(() => {
    setActiveFlow('story');
  }, []);

  const openReelUploader = useCallback(() => {
    setActiveFlow('reel');
  }, []);

  const closeAll = useCallback(() => {
    setActiveFlow(null);
    setCreateHubOpen(false);
    setQuoteTarget(null);
  }, []);

  return (
    <ContentCreationContext.Provider
      value={{
        activeFlow,
        createHubOpen,
        liveDraft,
        setLiveDraft,
        clearLiveDraft,
        openCreateHub,
        closeCreateHub,
        postPrefill,
        quoteTarget,
        openQuotePost,
        openPostModal,
        openStoryModal,
        openGoLiveModal,
        openReelUploader,
        closeAll,
      }}
    >
      {children}
    </ContentCreationContext.Provider>
  );
}

export function useContentCreation() {
  const ctx = useContext(ContentCreationContext);
  if (!ctx) {
    throw new Error('useContentCreation must be used within a ContentCreationProvider');
  }
  return ctx;
}