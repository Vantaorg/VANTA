'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import GiftArtworkUnique from './GiftArtworkUnique';
import { paletteFor, renderGiftArtwork, resolveGiftArtworkId } from './GiftArtworkSvgs';
import { giftArtworkAsset } from './giftArtworkAssets';

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
 * Single render entry for EVERY gift surface in VANTA (Gift Store grid,
 * pickers, gift history, admin, realtime overlay + previews):
 *   1. Existing DB assetUrl wins; known gifts use an optional local WebP next.
 *   2. Any failed image/video safely falls back to the shared SVG artwork.
 *   3. Large hero sizes (>= 140px) render the cinematic WebGL scene if no asset.
 *   4. Everything else renders the shared premium SVG artwork library.
 *
 * This is presentation-only: catalog IDs, names, prices, and send transactions
 * remain unchanged.
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
  const id = key(slug, name);
  const artId = resolveGiftArtworkId(slug, artworkType);
  const resolvedAssetUrl = assetUrl || giftArtworkAsset(slug, name);
  const hue = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  const p = paletteFor(artId, hue);
  // Keep catalog grids GPU-light; reserve WebGL for previews and overlay hero moments.
  const useWebGl = size >= 140;
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
      {resolvedAssetUrl && !assetFailed ? (/\\.(mp4|webm)(\\?|$)/i.test(resolvedAssetUrl)
        ? <video src={resolvedAssetUrl} autoPlay={animate} loop muted playsInline preload={animate ? 'metadata' : 'none'} onError={() => setAssetFailed(true)} className="h-full w-full object-contain" />
        : <img src={resolvedAssetUrl} alt="" loading={animate ? 'eager' : 'lazy'} onError={() => setAssetFailed(true)} className="h-full w-full object-contain" />)
        : useWebGl ? <GiftScene3D id={artId} palette={p} animate={animate} quality={quality} fallback={svg} /> : svg}
    </motion.div>
  );
}
