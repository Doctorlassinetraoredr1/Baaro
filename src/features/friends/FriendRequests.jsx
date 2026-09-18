import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { useCurrentUser } from '../../hooks/useCommunity';
import { COLORS } from '../../theme.js';
import { Check, X, User, Loader2 } from 'lucide-react';

export const FriendRequests = ({ onOpenProfile }) => {
  const { id } = useCurrentUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!id) { setRequests([]); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id, created_at')
        .eq('followed_id', id)
        .eq('status', 'pending')
        .eq('is_friend', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        const followerIds = data.map(r => r.follower_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, handle, avatar_url, country, language, flag')
          .in('id', followerIds);
        const requestsWithProfiles = data.map(request => ({
          ...request,
          profile: profiles?.find(p => p.id === request.follower_id)
        }));
        setRequests(requestsWithProfiles);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Erreur chargement demandes:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const acceptRequest = async (followerId) => {
    try {
      const { error } = await supabase
        .from('follows')
        .update({ status: 'accepted', is_friend: true })
        .eq('follower_id', followerId)
        .eq('followed_id', id)
        .eq('status', 'pending');
      if (error) throw error;
      fetchRequests();
    } catch (error) {
      console.error('Erreur acceptation:', error);
    }
  };

  const rejectRequest = async (followerId) => {
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('followed_id', id)
        .eq('status', 'pending');
      if (error) throw error;
      fetchRequests();
    } catch (error) {
      console.error('Erreur rejet:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 size={24} className="animate-spin" style={{ color: COLORS.gold }} />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="p-4 text-center" style={{ color: COLORS.muted }}>
        <User size={48} className="mx-auto mb-2 opacity-50" />
        <p>Aucune demande d'ami en attente</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <h3 className="text-sm font-bold mb-3 uppercase tracking-wider" style={{ color: COLORS.muted }}>
        Demandes d'amis ({requests.length})
      </h3>
      <div className="space-y-2">
        {requests.map((request) => (
          <div
            key={request.follower_id}
            className="flex items-center gap-3 p-3 rounded-[14px] border-2"
            style={{ background: COLORS.surface2, borderColor: COLORS.border }}
          >
            <img
              src={request.profile?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${request.profile?.display_name||'M'}`}
              alt={request.profile?.display_name}
              className="w-10 h-10 rounded-full object-cover border-2 cursor-pointer"
              style={{ borderColor: COLORS.gold }}
              onClick={() => onOpenProfile?.(request.follower_id)}
            />
            <div className="flex-1 min-w-0">
              <div className="font-black text-sm truncate flex items-center gap-1" style={{ color: COLORS.ivory }}>
                {request.profile?.display_name || 'Membre'} {request.profile?.flag && <span>{request.profile.flag}</span>}
              </div>
              <div className="text-xs truncate" style={{ color: COLORS.muted }}>
                @{request.profile?.handle || 'membre'} • {request.profile?.country||'International'} {request.profile?.language ? `• ${request.profile.language.toUpperCase()}` : ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => acceptRequest(request.follower_id)}
                className="p-2 rounded-full transition hover:scale-110 shadow"
                style={{ background: COLORS.gold, color: COLORS.bg }}
                title="Accepter"
              >
                <Check size={18} />
              </button>
              <button
                onClick={() => rejectRequest(request.follower_id)}
                className="p-2 rounded-full transition hover:scale-110"
                style={{ background: 'rgba(255,0,0,0.15)', color: '#ff4444', border: `1px solid rgba(255,0,0,0.2)` }}
                title="Rejeter"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendRequests;
