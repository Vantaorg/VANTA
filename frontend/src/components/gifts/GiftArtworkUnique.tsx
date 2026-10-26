'use client';

import { useId } from 'react';

type Props = { slug?: string; name?: string; size?: number; quality?: number };

/** A distinct visual identity for each real catalog slug; presentation only. */
const ART: Record<string, { glyph: string; a: string; b: string; c: string }> = {
  'thumbs-up': { glyph: '👍', a: '#a6f7ff', b: '#31bfff', c: '#2254ef' },
  fire: { glyph: '🔥', a: '#fff3a0', b: '#ff7a1a', c: '#ed174d' },
  rose: { glyph: '🌹', a: '#ffc4df', b: '#f02d70', c: '#7c174c' },
  heart: { glyph: '💗', a: '#ffd1f2', b: '#ff3e9e', c: '#9c2fe8' },
  'happy-day': { glyph: '🎉', a: '#fff6a1', b: '#ffad32', c: '#ff4d91' },
  teddy: { glyph: '🧸', a: '#ffe3b7', b: '#c98a4a', c: '#79442d' },
  'fancy-pearl': { glyph: '🦪', a: '#ffffff', b: '#b9eaff', c: '#8b63ff' },
  'first-place': { glyph: '🏅', a: '#fff3a6', b: '#e8ac32', c: '#a85b10' },
  'lets-ride': { glyph: '🏎️', a: '#c8fbff', b: '#2cb9f0', c: '#2c36db' },
  'gold-medal': { glyph: '🥇', a: '#fff4a6', b: '#f0b52e', c: '#9e5b0b' },
  'elite-status': { glyph: '🛩️', a: '#e8f7ff', b: '#86bdff', c: '#3849d9' },
  yacht: { glyph: '🛥️', a: '#d7ffff', b: '#30d5ed', c: '#1856c7' },
  diamond: { glyph: '💎', a: '#ffffff', b: '#83dfff', c: '#3c5eff' },
  crown: { glyph: '👑', a: '#fff1a6', b: '#f4bd37', c: '#9b4be7' },
  'neon-flare': { glyph: '🌟', a: '#fff3b1', b: '#ff7b37', c: '#e62cce' },
  'ember-orbit': { glyph: '☄️', a: '#ffd3a0', b: '#ff653b', c: '#8d32ff' },
  'solar-cinder': { glyph: '☀️', a: '#fff6a2', b: '#ff9d27', c: '#f04443' },
  'crimson-bloom': { glyph: '🌺', a: '#ffc6de', b: '#f02c6c', c: '#77184d' },
  'velvet-rose': { glyph: '🥀', a: '#ffd2e5', b: '#d92c75', c: '#501e59' },
  'aurora-petal': { glyph: '🌷', a: '#d8fff5', b: '#c25cff', c: '#2f7ef5' },
  'prism-kiss': { glyph: '💋', a: '#ffd4f3', b: '#ff419d', c: '#7449f5' },
  'luminous-embrace': { glyph: '💞', a: '#ffd6f4', b: '#ff5aa8', c: '#693cf4' },
  'starry-love': { glyph: '💘', a: '#ffe1ff', b: '#e746ff', c: '#3e5eff' },
  'confetti-rocket': { glyph: '🚀', a: '#fff1a6', b: '#ff6eab', c: '#7d4bff' },
  'aurora-party': { glyph: '🎊', a: '#b7fff5', b: '#5a8dff', c: '#c64dff' },
  'celebration-orb': { glyph: '🔮', a: '#ffd7ff', b: '#b94dff', c: '#3a4cff' },
  'moon-shell': { glyph: '🐚', a: '#fff0f6', b: '#ffb5d9', c: '#716bff' },
  'iridescent-relic': { glyph: '🪬', a: '#e8ffff', b: '#7cd7ff', c: '#a14fff' },
  'tide-pearl': { glyph: '🫧', a: '#e6ffff', b: '#70caff', c: '#7656f7' },
  'champion-ribbon': { glyph: '🎗️', a: '#fff2a5', b: '#ffb52f', c: '#e44e85' },
  'victory-medallion': { glyph: '🏆', a: '#fff5b2', b: '#eab033', c: '#a35c10' },
  'diamond-league': { glyph: '💠', a: '#ffffff', b: '#66d9ff', c: '#514eff' },
  'hyper-roadster': { glyph: '🏎️', a: '#ffd7d7', b: '#ff334f', c: '#742bff' },
  'aurora-coupe': { glyph: '🚘', a: '#caffff', b: '#27d9d0', c: '#554bff' },
  'velocity-x': { glyph: '🏁', a: '#f4fbff', b: '#55baff', c: '#2630bd' },
  'skyline-jet': { glyph: '✈️', a: '#f3fcff', b: '#7cbcff', c: '#3d4fe8' },
  'cloud-nine': { glyph: '☁️', a: '#ffffff', b: '#b8e4ff', c: '#7b78ff' },
  'royal-flight': { glyph: '🛫', a: '#fff0bd', b: '#a9caff', c: '#714bdf' },
  'frost-prism': { glyph: '🧊', a: '#ffffff', b: '#8ee9ff', c: '#4566ff' },
  'glacier-shard': { glyph: '❄️', a: '#ffffff', b: '#9fe8ff', c: '#4b7cff' },
  'polar-star': { glyph: '🌠', a: '#ffffff', b: '#8beaff', c: '#5b50ff' },
  'solar-crown': { glyph: '🌞', a: '#fff4a6', b: '#ffb52f', c: '#e95b34' },
  'empire-crown': { glyph: '👑', a: '#fff0ad', b: '#d7a02b', c: '#6138c9' },
  'celestial-crown': { glyph: '♛', a: '#f9e8ff', b: '#bd7bff', c: '#3d3bd1' },
  'crystal-star': { glyph: '✦', a: '#ffffff', b: '#85e5ff', c: '#7355ff' },
  'violet-comet': { glyph: '☄️', a: '#f8d5ff', b: '#a45bff', c: '#3159ff' },
  'quantum-orb': { glyph: '🔮', a: '#f6d5ff', b: '#a45cff', c: '#234cff' },
  'holo-badge': { glyph: '🎖️', a: '#f5ffff', b: '#76dcff', c: '#8b50ff' },
  'plasma-ring': { glyph: '💍', a: '#e6ffff', b: '#68d8ff', c: '#a14eff' },
  'nova-scepter': { glyph: '🪄', a: '#fff2c2', b: '#f3a9ff', c: '#5745ff' },
  'eclipse-gem': { glyph: '🌑', a: '#f2d7ff', b: '#8d63ff', c: '#171e69' },
  'starlight-capsule': { glyph: '🪩', a: '#ffffff', b: '#77e5ff', c: '#bb4eff' },
  'infinite-spark': { glyph: '✨', a: '#fff6b2', b: '#8f9dff', c: '#c44eff' },
  'galaxy-crest': { glyph: '🌌', a: '#e7d8ff', b: '#8d63ff', c: '#2445d8' },
  'cosmic-wings': { glyph: '🪽', a: '#e8f7ff', b: '#9a87ff', c: '#3c49c7' },
  'phoenix-flame': { glyph: '🪽', a: '#fff0a6', b: '#ff6739', c: '#c52b74' },
  'royal-dragon': { glyph: '🐉', a: '#b8ffd4', b: '#35c982', c: '#7b32d9' },
  'aurora-castle': { glyph: '🏰', a: '#f3dfff', b: '#9b75ff', c: '#2b47b8' },
  'platinum-throne': { glyph: '🪑', a: '#ffffff', b: '#c8d7f7', c: '#5c52d7' },
  'time-crystal': { glyph: '⌛', a: '#fff3bf', b: '#8fe7ff', c: '#6650e9' },
  'nebula-heart': { glyph: '💜', a: '#f7d5ff', b: '#a84dff', c: '#2e3fd8' },
  'lunar-rose': { glyph: '🌙', a: '#fff0f9', b: '#b4a1ff', c: '#4d47b7' },
  'golden-horizon': { glyph: '🌅', a: '#fff4a4', b: '#ff9b38', c: '#7a42e8' },
};

const FALLBACK = { glyph: '🎁', a: '#f4c8ff', b: '#a855f7', c: '#ec4899' };

export default function GiftArtworkUnique({ slug, name, size = 120, quality = 1 }: Props) {
  const art = ART[(slug || '').toLowerCase()] || ART[(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')] || FALLBACK;
  const reactId = useId();
  const uid = ((slug || name || 'gift').replace(/[^a-z0-9]/gi, '') + reactId).replace(/[^a-zA-Z0-9_-]/g, '');
  const level = Math.max(0, Math.min(5, quality));
  return (
    <svg viewBox="0 0 160 160" width="100%" height="100%" role="img" aria-label={name || slug || 'VANTA gift artwork'} className="overflow-visible drop-shadow-[0_16px_22px_rgba(0,0,0,.45)]">
      <defs>
        <radialGradient id={uid + '-aura'} cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor={art.b} stopOpacity={0.42 + level * 0.045} />
          <stop offset="60%" stopColor={art.c} stopOpacity=".19" />
          <stop offset="100%" stopColor={art.c} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={uid + '-ring'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={art.a} />
          <stop offset="52%" stopColor={art.b} />
          <stop offset="100%" stopColor={art.c} />
        </linearGradient>
        <filter id={uid + '-glow'} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="80" cy="142" rx="43" ry="8" fill={art.c} opacity=".24" />
      <circle cx="80" cy="77" r="65" fill={'url(#' + uid + '-aura)'} />
      <circle cx="80" cy="77" r="54" fill="none" stroke={'url(#' + uid + '-ring)'} strokeWidth="1.5" strokeDasharray="3 8" opacity=".8" />
      <circle cx="80" cy="77" r="44" fill="none" stroke={art.a} strokeWidth=".8" opacity=".3" />
      <path d="M29 79 Q80 18 131 79 Q80 137 29 79Z" fill={art.b} opacity=".09" stroke={art.a} strokeWidth=".7" strokeOpacity=".55" />
      <path d="M80 18 L84 28 L95 29 L87 37 L89 48 L80 42 L71 48 L73 37 L65 29 L76 28Z" fill={art.a} opacity=".8" />
      <text x="80" y="98" textAnchor="middle" fontSize="62" dominantBaseline="middle" filter={'url(#' + uid + '-glow)'}>{art.glyph}</text>
      <circle cx="35" cy="61" r="2.6" fill={art.a} />
      <circle cx="124" cy="93" r="2.3" fill={art.a} />
      <path d="M47 119 l4 -8 l4 8 l-4 8Z M112 42 l3 -6 l3 6 l-3 6Z" fill={art.a} opacity=".9" />
      <ellipse cx="80" cy="136" rx="26" ry="2.8" fill={art.a} opacity=".25" />
    </svg>
  );
}
