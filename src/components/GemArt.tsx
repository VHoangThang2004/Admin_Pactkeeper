import React from 'react';

interface GemArtProps {
  tier?: number;
  gemsAmount?: number;
  className?: string;
  size?: number;
}

/**
 * GemArt Component - HoYoverse AAA Gaming Aesthetic
 * 
 * Renders high-fidelity prismatic SVG crystals inspired by Genshin Impact Genesis Crystals
 * and Honkai: Star Rail Oneiric Shards across 6 rarity/value tiers.
 */
export const GemArt: React.FC<GemArtProps> = ({
  tier,
  gemsAmount = 100,
  className = '',
  size = 72,
}) => {
  // Determine tier based on explicit prop or amount
  let determinedTier = tier;
  if (determinedTier === undefined) {
    if (gemsAmount < 200) determinedTier = 1;
    else if (gemsAmount < 500) determinedTier = 2;
    else if (gemsAmount < 1000) determinedTier = 3;
    else if (gemsAmount < 2500) determinedTier = 4;
    else if (gemsAmount < 6000) determinedTier = 5;
    else determinedTier = 6;
  }

  // Tier 1: Single Pristine Crystal
  if (determinedTier === 1) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <filter id="glow-1" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="gem-g1" x1="20" y1="20" x2="80" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#67e8f9" />
            <stop offset="0.5" stopColor="#06b6d4" />
            <stop offset="1" stopColor="#0369a1" />
          </linearGradient>
          <linearGradient id="facet-top" x1="50" y1="15" x2="50" y2="45" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e0f2fe" />
            <stop offset="1" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        {/* Ambient Halo */}
        <circle cx="50" cy="50" r="32" fill="#06b6d4" opacity="0.25" filter="url(#glow-1)" />
        {/* Crystal Facets */}
        <polygon points="50,12 78,35 68,88 32,88 22,35" fill="url(#gem-g1)" />
        <polygon points="50,12 78,35 62,48 38,48 22,35" fill="url(#facet-top)" opacity="0.9" />
        <polygon points="38,48 62,48 50,86" fill="#0284c7" opacity="0.85" />
        <polygon points="22,35 38,48 32,88" fill="#0891b2" opacity="0.7" />
        <polygon points="78,35 62,48 68,88" fill="#0e7490" opacity="0.95" />
        {/* Sparkle highlights */}
        <polygon points="50,22 52,32 62,34 52,36 50,46 48,36 38,34 48,32" fill="#ffffff" opacity="0.85" />
      </svg>
    );
  }

  // Tier 2: Tri-Crystal Cluster
  if (determinedTier === 2) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <filter id="glow-2" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="cyan-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a5f3fc" />
            <stop offset="0.6" stopColor="#0891b2" />
            <stop offset="1" stopColor="#155e75" />
          </linearGradient>
        </defs>
        {/* Halo */}
        <circle cx="50" cy="52" r="36" fill="#0891b2" opacity="0.28" filter="url(#glow-2)" />
        {/* Left Shard */}
        <g transform="rotate(-18 35 60)">
          <polygon points="35,26 48,42 42,76 25,74 22,42" fill="url(#cyan-grad)" opacity="0.85" />
          <polygon points="35,26 48,42 38,50 22,42" fill="#cffafe" opacity="0.9" />
        </g>
        {/* Right Shard */}
        <g transform="rotate(20 65 60)">
          <polygon points="65,28 78,44 72,78 55,76 52,44" fill="url(#cyan-grad)" opacity="0.85" />
          <polygon points="65,28 78,44 68,52 52,44" fill="#67e8f9" opacity="0.8" />
        </g>
        {/* Center Main Crystal */}
        <polygon points="50,14 74,38 64,88 36,88 26,38" fill="url(#cyan-grad)" />
        <polygon points="50,14 74,38 60,49 40,49 26,38" fill="#ecfeff" opacity="0.95" />
        <polygon points="40,49 60,49 50,86" fill="#0284c7" opacity="0.9" />
        {/* Sparkles */}
        <circle cx="50" cy="28" r="2.5" fill="#ffffff" />
        <circle cx="72" cy="55" r="1.5" fill="#e0f2fe" />
      </svg>
    );
  }

  // Tier 3: Velvet Pouch of Crystals
  if (determinedTier === 3) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <filter id="glow-3" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="pouch-body" x1="20" y1="35" x2="80" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1e293b" />
            <stop offset="0.6" stopColor="#0f172a" />
            <stop offset="1" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="gold-rope" x1="30" y1="38" x2="70" y2="45" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fef08a" />
            <stop offset="0.5" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#b45309" />
          </linearGradient>
        </defs>
        {/* Back gems shining out */}
        <circle cx="50" cy="38" r="28" fill="#38bdf8" opacity="0.35" filter="url(#glow-3)" />
        <polygon points="50,12 62,26 50,40 38,26" fill="#a5f3fc" />
        <polygon points="34,18 44,28 36,38 26,28" fill="#38bdf8" />
        <polygon points="66,18 76,28 68,38 58,28" fill="#38bdf8" />
        {/* Pouch base */}
        <path
          d="M32 40 C20 45 18 68 24 82 C30 92 70 92 76 82 C82 68 80 45 68 40 Z"
          fill="url(#pouch-body)"
          stroke="#f2bf4e"
          strokeWidth="1.5"
        />
        {/* Golden Embroidered Sigil */}
        <path d="M50 56 L58 64 L50 72 L42 64 Z" stroke="#f2bf4e" strokeWidth="1.5" fill="none" opacity="0.8" />
        <circle cx="50" cy="64" r="2.5" fill="#f2bf4e" />
        {/* Tied rope collar */}
        <path d="M30 42 Q50 48 70 42" stroke="url(#gold-rope)" strokeWidth="4" strokeLinecap="round" />
        <path d="M46 45 L42 54" stroke="url(#gold-rope)" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M54 45 L58 54" stroke="url(#gold-rope)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  // Tier 4: Ornate Gold-Trimmed Chest
  if (determinedTier === 4) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <filter id="glow-4" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="chest-metal" x1="0" y1="30" x2="0" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1e1b4b" />
            <stop offset="1" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="gold-trim" x1="0" y1="20" x2="100" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fef08a" />
            <stop offset="0.5" stopColor="#f2bf4e" />
            <stop offset="1" stopColor="#92400e" />
          </linearGradient>
        </defs>
        {/* Crystal Glow from Chest */}
        <ellipse cx="50" cy="40" rx="35" ry="25" fill="#38bdf8" opacity="0.4" filter="url(#glow-4)" />
        {/* Crystals overflowing */}
        <polygon points="50,15 62,28 50,42 38,28" fill="#e0f2fe" />
        <polygon points="35,22 45,34 38,44 26,34" fill="#38bdf8" />
        <polygon points="65,22 75,34 68,44 56,34" fill="#38bdf8" />
        {/* Chest Lid open back */}
        <path d="M18 36 L50 20 L82 36 L50 42 Z" fill="#312e81" opacity="0.5" />
        {/* Chest Body */}
        <path d="M16 45 L84 45 L78 85 L22 85 Z" fill="url(#chest-metal)" stroke="url(#gold-trim)" strokeWidth="2" />
        {/* Chest bands */}
        <line x1="34" y1="45" x2="36" y2="85" stroke="url(#gold-trim)" strokeWidth="3" />
        <line x1="66" y1="45" x2="64" y2="85" stroke="url(#gold-trim)" strokeWidth="3" />
        {/* Golden lock */}
        <rect x="44" y="48" width="12" height="15" rx="3" fill="url(#gold-trim)" stroke="#78350f" strokeWidth="1" />
        <circle cx="50" cy="54" r="2" fill="#0f172a" />
      </svg>
    );
  }

  // Tier 5: Dragon's Hoard / Treasure Trove
  if (determinedTier === 5) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <defs>
          <filter id="glow-5" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="9" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="dragon-gold" x1="0" y1="10" x2="100" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fffbeb" />
            <stop offset="0.4" stopColor="#f59e0b" />
            <stop offset="1" stopColor="#78350f" />
          </linearGradient>
        </defs>
        {/* Cosmic aura */}
        <circle cx="50" cy="48" r="42" fill="#f59e0b" opacity="0.32" filter="url(#glow-5)" />
        <circle cx="50" cy="48" r="30" fill="#38bdf8" opacity="0.25" filter="url(#glow-5)" />
        {/* Big Chest */}
        <path d="M14 42 L86 42 L78 88 L22 88 Z" fill="#18181b" stroke="url(#dragon-gold)" strokeWidth="2.5" />
        {/* Overflowing Gem Pile */}
        <polygon points="50,8 65,24 50,42 35,24" fill="#fef08a" />
        <polygon points="30,16 44,28 36,44 22,30" fill="#38bdf8" />
        <polygon points="70,16 82,30 72,44 58,28" fill="#a855f7" />
        <polygon points="20,28 32,38 24,50 12,40" fill="#38bdf8" />
        <polygon points="80,28 90,40 80,50 68,38" fill="#f43f5e" />
        {/* Dragon Sigil Plate */}
        <path d="M50 50 L64 62 L50 78 L36 62 Z" fill="url(#dragon-gold)" stroke="#fff" strokeWidth="1" />
        <circle cx="50" cy="62" r="4" fill="#ef4444" />
        {/* Side ornaments */}
        <path d="M14 42 Q30 35 50 35 Q70 35 86 42" stroke="url(#dragon-gold)" strokeWidth="3" fill="none" />
        <circle cx="50" cy="20" r="2.5" fill="#ffffff" />
      </svg>
    );
  }

  // Tier 6: Imperial Vault / Kingdom's Treasury (Grand Tier)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <filter id="glow-6" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="11" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="crown-gold" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#fef08a" />
          <stop offset="0.7" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#78350f" />
        </linearGradient>
      </defs>
      {/* Blazing Divine Aura */}
      <circle cx="50" cy="50" r="45" fill="#f59e0b" opacity="0.35" filter="url(#glow-6)" />
      <circle cx="50" cy="45" r="32" fill="#38bdf8" opacity="0.35" filter="url(#glow-6)" />
      {/* Massive Vault Base */}
      <path
        d="M12 40 L88 40 L80 90 L20 90 Z"
        fill="#09090b"
        stroke="url(#crown-gold)"
        strokeWidth="3"
      />
      {/* Imperial Crown on Top */}
      <path
        d="M26 32 L34 14 L50 24 L66 14 L74 32 Z"
        fill="url(#crown-gold)"
        stroke="#fff"
        strokeWidth="1"
      />
      <circle cx="50" cy="24" r="3" fill="#ef4444" />
      <circle cx="34" cy="14" r="2.5" fill="#38bdf8" />
      <circle cx="66" cy="14" r="2.5" fill="#38bdf8" />
      {/* Radiant Prismatic Jewels */}
      <polygon points="50,30 64,44 50,58 36,44" fill="#a5f3fc" />
      <polygon points="22,34 34,46 25,58 14,46" fill="#f43f5e" />
      <polygon points="78,34 88,46 76,58 66,46" fill="#a855f7" />
      {/* Center Royal Seal */}
      <circle cx="50" cy="68" r="12" fill="url(#crown-gold)" />
      <path d="M50 60 L54 66 L60 68 L54 70 L50 76 L46 70 L40 68 L46 66 Z" fill="#09090b" />
      <line x1="20" y1="40" x2="80" y2="40" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
};

// Blessing / Monthly Pass Icon (HoYoverse Welkin Moon Style)
export const BlessingPassArt: React.FC<{ size?: number; className?: string }> = ({
  size = 72,
  className = '',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <filter id="moon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="moon-gold" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fef08a" />
          <stop offset="0.5" stopColor="#eab308" />
          <stop offset="1" stopColor="#854d0e" />
        </linearGradient>
        <linearGradient id="crescent" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f0f9ff" />
          <stop offset="0.6" stopColor="#bae6fd" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Halo */}
      <circle cx="50" cy="50" r="38" fill="#38bdf8" opacity="0.35" filter="url(#moon-glow)" />
      {/* Outer Golden Astrolabe Ring */}
      <circle cx="50" cy="50" r="42" stroke="url(#moon-gold)" strokeWidth="2.5" />
      <circle cx="50" cy="50" r="38" stroke="url(#moon-gold)" strokeWidth="1" strokeDasharray="3 3" />
      {/* 4 Cardinal Diamond Stars */}
      <polygon points="50,4 52,10 50,16 48,10" fill="#fef08a" />
      <polygon points="50,84 52,90 50,96 48,90" fill="#fef08a" />
      <polygon points="4,50 10,52 16,50 10,48" fill="#fef08a" />
      <polygon points="84,50 90,52 96,50 90,48" fill="#fef08a" />
      {/* Crescent Moon */}
      <path
        d="M50 18 C67 18 80 32 80 50 C80 68 67 82 50 82 C58 74 62 63 62 50 C62 37 58 26 50 18 Z"
        fill="url(#crescent)"
      />
      {/* Glowing Star in Embrace of Moon */}
      <polygon
        points="40,36 43,45 52,48 43,51 40,60 37,51 28,48 37,45"
        fill="#fef08a"
        filter="url(#moon-glow)"
      />
      <circle cx="40" cy="48" r="2.5" fill="#ffffff" />
    </svg>
  );
};
