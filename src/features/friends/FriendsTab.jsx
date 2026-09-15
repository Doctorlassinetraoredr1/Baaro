import React, { useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useSocial } from '../../hooks/useSocial';

export const FriendsTab = () => {
  const { user, isGuest } = useApp();
  const { friends, fetchFriends, loading } = useSocial(user?.id);

  useEffect(() => {
    if (user && !isGuest) {
      fetchFriends();
    }
  }, [user, isGuest, fetchFriends]);

  if (isGuest) {
    return <div className="p-4">Veuillez vous connecter pour voir vos amis.</div>;
  }

  if (loading) {
    return <div className="p-4">Chargement de la liste d'amis...</div>;
  }

  return (
    <div className="friends-tab-container">
      <h3>Mes Amis ({friends.length})</h3>
      {friends.length === 0 ? (
        <p>Vous n'avez pas encore d'amis réciproques.</p>
      ) : (
        <ul className="friends-list">
          {friends.map((friend) => (
            <li key={friend.id} className="friend-card">
              <img src={friend.avatar_url || '/default-avatar.png'} alt={friend.username} />
              <span>{friend.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
