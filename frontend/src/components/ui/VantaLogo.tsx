'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface VantaLogoProps {
  size?: number;
  className?: string;
  variant?: 'white' | 'black' | 'monochrome';
  showText?: boolean;
  textSize?: 'sm' | 'md' | 'lg';
}

const textSizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' };

function VantaMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/branding/pwa-192.png"
      width={size}
      height={size}
      alt="VANTA"
      className={cn('shrink-0 rounded-[22%] object-contain', className)}
      draggable={false}
    />
  );
}

export default function VantaLogo({ size = 36, className = '', variant = 'monochrome', showText = false, textSize = 'md' }: VantaLogoProps) {
  const dark = variant === 'black';
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <VantaMark size={size} />
      {showText && <span className={cn('font-semibold tracking-[0.2em]', textSizes[textSize], dark ? 'text-black' : 'text-white')}>VANTA</span>}
    </span>
  );
}

export function VantaWordmark({ size = 'md', className, variant = 'white' }: { size?: 'sm' | 'md' | 'lg'; className?: string; variant?: 'white' | 'black' }) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 36 : 32;
  const textClass = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <VantaMark size={iconSize} />
      <span className={cn('font-semibold tracking-[0.18em]', textClass, variant === 'black' ? 'text-black' : 'text-white')}>VANTA</span>
    </span>
  );
}

export function VantaNavbarLogo({ className }: { className?: string }) {
  return <VantaWordmark size="sm" className={className} />;
}
