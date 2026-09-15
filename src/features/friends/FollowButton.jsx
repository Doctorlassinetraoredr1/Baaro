import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { useToast } from '../../components/ToastContext.jsx';

export default function FollowButton({ targetUserId, currentUserId }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return undefined;

    const checkFollow = async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('followed_id', targetUserId)
        .eq('status', 'accepted')
        .maybeSingle();

      if (!error && active) setIsFollowing(Boolean(data));
    };

    checkFollow();

    const channel = supabase
      .channel(`follow-status:${currentUserId}:${targetUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${currentUserId}`,
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (row?.followed_id === targetUserId) checkFollow();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, targetUserId]);

  const handleToggle = async () => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId || loading) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('toggle_follow', {
        p_target: targetUserId,
      });

      if (error) throw error;

      const following = Boolean(data);
      setIsFollowing(following);
      showToast(following ? 'Abonnement réussi !' : 'Désabonné', following ? 'success' : 'info');
    } catch (error) {
      console.error('Erreur follow:', error);
      showToast("Erreur lors de l'abonnement", 'error');
    } finally {
      setLoading(false);
    }
  };

  if (currentUserId === targetUserId) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-4 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-2 ${
        isFollowing
          ? 'bg-gray-200 text-gray-800 hover:bg-red-100 hover:text-red-600'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <span className="animate-pulse">...</span>
      ) : isFollowing ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Abonné
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          S'abonner
        </>
      )}
    </button>
  );
}
