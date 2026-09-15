import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export const useSocial = (userId) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_user_friends', { user_id_param: userId });
      if (error) throw error;
      
      if (data && data.length > 0) {
        const friendIds = data.map(f => f.friend_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', friendIds);
          
        if (profilesError) throw profilesError;
        setFriends(profiles || []);
      } else {
        setFriends([]);
      }
    } catch (err) {
      console.error('Erreur chargement amis:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { friends, fetchFriends, loading };
};
