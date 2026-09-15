import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { supabase } from '../../lib/supabaseClient';

export const FollowButton = ({ targetUserId, onRequireAuth }) => {
  const { user, isGuest } = useApp();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || isGuest || !targetUserId) return;

    const checkFollowStatus = async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (!error && data) {
        setIsFollowing(true);
      }
    };

    checkFollowStatus();
  }, [user, isGuest, targetUserId]);

  const handleFollowToggle = async (e) => {
    e.stopPropagation();

    if (isGuest || !user) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    const previousState = isFollowing;
    setIsFollowing(!previousState);
    setLoading(true);

    try {
      if (previousState) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .insert([{ follower_id: user.id, following_id: targetUserId }]);
        if (error) throw error;
      }
    } catch (err) {
      console.error("Erreur lors de la mise à jour de l'abonnement:", err);
      setIsFollowing(previousState);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleFollowToggle} 
      disabled={loading}
      className={`btn-follow ${isFollowing ? 'following' : ''}`}
    >
      {isFollowing ? 'Abonné(e)' : 'S\'abonner'}
    </button>
  );
};
