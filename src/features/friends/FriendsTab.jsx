import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';

export function FriendsTab() {
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadProfiles = async (ids) => {
    if (!ids?.length) return [];
    const uniqueIds = [...new Set(ids.filter(Boolean))];

    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, handle, flag, avatar_url, bio')
      .in('user_id', uniqueIds);

    if (error) throw error;
    return data || [];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'friends') {
        const { data: ids, error } = await getFriends();
        if (error) throw error;
        setFriends(await loadProfiles(ids));
      } else if (activeTab === 'followers') {
        const { data: ids, error } = await getFollowers();
        if (error) throw error;
        setFollowers(await loadProfiles(ids));
      } else if (activeTab === 'following') {
        const { data: ids, error } = await getFollowing();
        if (error) throw error;
        setFollowing(await loadProfiles(ids));
      } else if (activeTab === 'requests') {
        const { data, error } = await getPendingRequests();
        if (error) throw error;

        const profiles = await loadProfiles((data || []).map((req) => req.follower_id));
        const byId = new Map(profiles.map((p) => [p.user_id, p]));

        setPending(
          (data || [])
            .map((req) => ({
              ...byId.get(req.follower_id),
              follow_id: req.id,
            }))
            .filter((u) => u?.user_id)
        );
      }
    } catch (error) {
      console.error('Erreur communauté:', error);
    } finally {
      setLoading(false);
    }
  };

  const {
    getFollowers,
    getFollowing,
    getFriends,
    getPendingRequests,
    followUser,
    unfollowUser,
    acceptFriendRequest,
    rejectFriendRequest,
  } = {
    getFollowers: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: [] };
      const { data, error } = await supabase
        .from('follows').select('follower_id')
        .eq('followed_id', user.id).eq('status', 'accepted');
      return { data: (data || []).map((x) => x.follower_id), error };
    },
    getFollowing: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: [] };
      const { data, error } = await supabase
        .from('follows').select('followed_id')
        .eq('follower_id', user.id).eq('status', 'accepted');
      return { data: (data || []).map((x) => x.followed_id), error };
    },
    getFriends: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: [] };
      const { data, error } = await supabase
        .from('follows').select('followed_id')
        .eq('follower_id', user.id).eq('is_friend', true).eq('status', 'accepted');
      return { data: (data || []).map((x) => x.followed_id), error };
    },
    getPendingRequests: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { data: [] };
      const { data, error } = await supabase
        .from('follows').select('id, follower_id')
        .eq('followed_id', user.id).eq('is_friend', true).eq('status', 'pending');
      return { data: data || [], error };
    },
    followUser: async (id) => supabase.rpc('toggle_follow', { p_target: id }),
    unfollowUser: async (id) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      return supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', id);
    },
    acceptFriendRequest: async (id) =>
      supabase.from('follows').update({ status: 'accepted' }).eq('id', id),
    rejectFriendRequest: async (id) =>
      supabase.from('follows').update({ status: 'rejected', is_friend: false }).eq('id', id),
  };

  const handleFollow = async (userId) => {
    await followUser(userId);
    loadData();
  };

  const handleUnfollow = async (userId) => {
    await unfollowUser(userId);
    loadData();
  };

  const handleAccept = async (followId) => {
    await acceptFriendRequest(followId);
    loadData();
  };

  const handleReject = async (followId) => {
    await rejectFriendRequest(followId);
    loadData();
  };

  const tabs = [
    { id: 'friends', label: '👫 Amis' },
    { id: 'followers', label: '📥 Abonnés' },
    { id: 'following', label: '📤 Abonnements' },
    { id: 'requests', label: '📩 Demandes' },
  ];

  const renderUser = (user, type) => {
    if (!user) return null;
    const id = user.user_id;
    const name = user.display_name || 'Membre';
    const handle = user.handle || '@utilisateur';
    const flag = user.flag || '🌍';
    const avatar = user.avatar_url;

    return (
      <div key={id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800/70 transition">
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <span className="text-2xl">{flag}</span>
          )}
          <div>
            <p className="font-semibold text-white">{name}</p>
            <p className="text-sm text-gray-400">{handle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {type === 'followers' && (
            <button onClick={() => handleFollow(id)} className="bg-gold-500 text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gold-400 transition">
              + Suivre
            </button>
          )}
          {type === 'following' && (
            <button onClick={() => handleUnfollow(id)} className="bg-gray-700 text-gray-300 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gray-600 transition">
              ✓ Suivi
            </button>
          )}
          {type === 'requests' && (
            <div className="flex gap-2">
              <button onClick={() => handleAccept(user.follow_id)} className="bg-green-500 text-black px-3 py-1.5 rounded-full text-sm font-medium hover:bg-green-400 transition">✓</button>
              <button onClick={() => handleReject(user.follow_id)} className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-red-500/30 transition">✕</button>
            </div>
          )}
          {type === 'friends' && (
            <button className="bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full text-sm">💬</button>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) return <div className="text-center py-8 text-gray-400"><div className="animate-spin text-2xl mb-2">⏳</div>Chargement...</div>;

    const configs = {
      friends: [friends, '👫', '👀 Aucun ami pour le moment.'],
      followers: [followers, '📥', '📭 Aucun abonné.'],
      following: [following, '📤', '📭 Vous ne suivez personne.'],
      requests: [pending, '📩', '✅ Aucune demande en attente.'],
    };
    const [list, icon, emptyMsg] = configs[activeTab];

    if (!list.length) return <div className="text-center py-12 text-gray-400"><p className="text-4xl mb-3">{icon}</p><p>{emptyMsg}</p></div>;

    return <div className="space-y-2">{list.map((item) => renderUser(item, activeTab))}</div>;
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-white mb-4">👥 Communauté</h2>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.id ? 'bg-gold-500 text-black' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
}
