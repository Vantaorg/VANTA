'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DiscoverTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: 'foryou', label: 'For You' },
  { id: 'trending', label: 'Trending' },
  { id: 'live', label: 'Live' },
  { id: 'creators', label: 'Creators' },
  { id: 'communities', label: 'Communities' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'music', label: 'Music' },
  { id: 'sports', label: 'Sports' },
  { id: 'technology', label: 'Technology' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'education', label: 'Education' },
  { id: 'business', label: 'Business' },
  { id: 'news', label: 'News' },
];

export default function DiscoverTabs({ activeTab, onTabChange }: DiscoverTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide gap-1 pb-1 -mb-1"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'relative shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[var(--surface-active)]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="discoverTab"
                  className="absolute inset-0 rounded-lg bg-[var(--surface-active)] border border-[#d6a83f]/20"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}