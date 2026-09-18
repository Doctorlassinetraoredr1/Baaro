import React from 'react';
import { COLORS } from '../../theme.js';

export default function UnreadBadge({ count, isMention = false }) {
  if (!count || count <= 0) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-black rounded-full shadow-lg border border-black/20 animate-pulse ${
        isMention ? 'bg-red-500 text-white' : ''
      }`}
      style={{
        background: isMention ? '#ef4444' : COLORS.gold,
        color: isMention ? '#ffffff' : COLORS.bg
      }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
