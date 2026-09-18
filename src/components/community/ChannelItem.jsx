import React from 'react';
import { MessageSquare, Volume2 } from 'lucide-react';
import { COLORS } from '../../theme.js';
import UnreadBadge from './UnreadBadge.jsx';

export default function ChannelItem({ channel, isActive, unreadCount = 0, lastMessage, onSelect }) {
  const isVoice = channel.type === 'voice';

  return (
    <button
      onClick={() => onSelect(channel)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[14px] text-left group transition-all duration-200 hover:scale-[1.01] ${
        isActive ? 'shadow-md border' : 'hover:bg-white/[0.04]'
      }`}
      style={{
        background: isActive ? 'rgba(251,191,36,0.12)' : 'transparent',
        borderColor: isActive ? 'rgba(251,191,36,0.3)' : 'transparent',
        color: isActive ? COLORS.gold : COLORS.ivory
      }}
    >
      <div
        className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
        style={{
          background: isActive
            ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`
            : 'rgba(255,255,255,0.06)',
          color: isActive ? COLORS.bg : COLORS.muted
        }}
      >
        {isVoice ? <Volume2 size={16} /> : <MessageSquare size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-[13.5px] truncate ${unreadCount > 0 ? 'font-black text-white' : 'font-bold'}`}>
            {channel.name}
          </span>
          {lastMessage?.time && (
            <span className="text-[10px]" style={{ color: COLORS.muted }}>
              {lastMessage.time}
            </span>
          )}
        </div>

        {lastMessage?.text && !isVoice && (
          <p className="text-[11px] truncate font-medium opacity-70" style={{ color: COLORS.muted }}>
            {lastMessage.sender ? `${lastMessage.sender}: ` : ''}{lastMessage.text}
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        <UnreadBadge count={unreadCount} />
        {isActive && unreadCount === 0 && (
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        )}
      </div>
    </button>
  );
}
