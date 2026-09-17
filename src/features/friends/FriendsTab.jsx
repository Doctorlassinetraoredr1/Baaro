import React, { useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useSocial } from '../../hooks/useSocial';
import { COLORS } from '../../theme';

export const FriendsTab = ({ onOpenProfile }) => {
  const { user, isGuest } = useApp();
  const { friends, fetchFriends, loading } = useSocial(user?.id);

  useEffect(() => {
    if (user && !isGuest) {
      fetchFriends();
    }
  }, [user, isGuest, fetchFriends]);

  if (isGuest) {
    return (
      <div className="p-4 text-center" style={{ color: COLORS.muted }}>
        Veuillez vous connecter pour voir vos amis.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center" style={{ color: COLORS.muted }}>
        Chargement de la liste d'amis...
      </div>
    );
  }

  return (
    <div className="friends-tab-container p-4">
      <h3 className="text-xl font-bold mb-4" style={{ color: COLORS.ivory }}>
        Mes Amis ({friends.length})
      </h3>
      {friends.length === 0 ? (
        <p style={{ color: COLORS.muted }}>Vous n'avez pas encore d'amis réciproques.</p>
      ) : (
        <ul className="friends-list space-y-2">
          {friends.map((friend) => (
            <li
              key={friend.id}
              className="friend-card flex items-center gap-3 p-3 rounded-lg border transition hover:scale-[1.02] cursor-pointer"
              style={{ 
                background: COLORS.surface,
                borderColor: COLORS.border,
              }}
              onClick={() => onOpenProfile?.(friend.id)}
            >
              <img 
                src={friend.avatar_url || '/default-avatar.png'} 
                alt={friend.username}
                className="w-12 h-12 rounded-full object-cover border-2"
                style={{ borderColor: COLORS.gold }}
              />
              <div className="flex-1">
                <div className="font-semibold" style={{ color: COLORS.ivory }}>
                  {friend.username} {friend.flag}
                </div>
                {friend.handle && (
                  <div className="text-xs" style={{ color: COLORS.muted }}>
                    {friend.handle.startsWith('@') ? friend.handle : `@${friend.handle}`}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
