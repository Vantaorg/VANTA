'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import GiftArtworkUnique from './GiftArtworkUnique';

export type GiftArtworkProps = {
  slug?: string;
  name?: string;
  artworkType?: string;
  assetUrl?: string;
  size?: number;
  animate?: boolean;
  className?: string;
  /** 0-5 artistic intensity derived from the EXISTING price/rarity/impact. */
  quality?: number;
};

/**
 * Shared renderer for every VANTA gift surface: store, picker, history,
 * realtime overlay, admin and previews. Catalog-provided media still wins;
 * otherwise the 63 known catalog slugs each receive their own artwork identity.
 *
 * Presentation only: gift IDs, names, prices, balances and send transactions
 * are not changed by this component.
 */
export default function GiftArtwork({
  slug,
  name,
  assetUrl,
  size = 120,
  animate = true,
  className = '',
  quality = 1,
}: GiftArtworkProps) {
  const [assetFailed, setAssetFailed] = useState(false);
  const id = (slug || name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const common = {
    initial: { y: 0, rotate: 0, scale: 1 },
    animate: animate ? { y: [0, -5, 0], rotate: [-2, 2, -2], scale: [1, 1.04, 1] } : undefined,
    transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' as const },
  };

  return (
    <motion.div {...common} className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {assetUrl && !assetFailed ? (/\.(mp4|webm)(\?|$)/i.test(assetUrl)
        ? <video src={assetUrl} autoPlay={animate} loop muted playsInline preload={animate ? 'metadata' : 'none'} onError={() => setAssetFailed(true)} className="h-full w-full object-contain" />
        : <img src={assetUrl} alt="" loading={animate ? 'eager' : 'lazy'} onError={() => setAssetFailed(true)} className="h-full w-full object-contain" />)
        : <GiftArtworkUnique slug={id} name={name} size={size} quality={quality} />}
    </motion.div>
  );
}
