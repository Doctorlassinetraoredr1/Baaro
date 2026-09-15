import { useState, useEffect, useCallback } from 'react';
import { supabase, getFollowers, getFollowing, getFriends, getPendingRequests, followUser, unfollowUser, acceptFriendRequest, rejectFriendRequest } from '../../supabaseClient.js';

export function FriendsTab() {
  const [activeTab, setActiveTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadProfiles = useCallback(async (ids) => {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];
    if (!uniqueIds.length) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, handle, flag, avatar_url, bio')
      .in('user_id', uniqueIds);
    if (error) throw error;
    return data || [];
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'friends') {
        const { data, error } = await getFriends();
        if (error) throw error;
        setFriends(await loadProfiles(data));
      } else if (activeTab === 'followers') {
        const { data, error } = await getFollowers();
        if (error) throw error;
        setFollowers(await loadProfiles(data));
      } else if (activeTab === 'following') {
        const { data, error } = await getFollowing();
        if (error) throw error;
        setFollowing(await loadProfiles(data));
      } else {
        const { data, error } = await getPendingRequests();
        if (error) throw error;
        const profiles = await loadProfiles((data || []).map((req) => req.follower_id));
        const byId = new Map(profiles.map((p) => [p.user_id, p]));
        setPending((data || []).map((req) => ({
          ...byId.get(req.follower_id),
          request_user_id: req.follower_id,
        })).filter((u) => u?.user_id));
      }
    } catch (error) {
      console.error('Erreur communauté:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadProfiles]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleFollow = async (userId) => {
    const { error } = await followUser(userId);
    if (error) console.error('Erreur abonnement:', error);
    await loadData();
  };

  const handleUnfollow = async (userId) => {
    const { error } = await unfollowUser(userId);
    if (error) console.error('Erreur désabonnement:', error);
    await loadData();
  };

  const handleAccept = async (requestUserId) => {
    const { error } = await acceptFriendRequest(requestUserId);
    if (error) console.error('Erreur acceptation ami:', error);
    await loadData();
  };

  const handleReject = async (requestUserId) => {
    const { error } = await rejectFriendRequest(requestUserId);
    if (error) console.error('Erreur refus ami:', error);
    await loadData();
  };

  const tabs = [
    { id: 'friends', label: '👫 Amis' },
    { id: 'followers', label: '📥 Abonnés' },
    { id: 'following', label: '📤 Abonnements' },
    { id: 'requests', label: '📩 Demandes' },
  ];

  const renderUser = (user, type) => {
    if (!user) return null;
    const userId = user.user_id;
    const name = user.display_name || 'Membre';
    const handle = user.handle || '@utilisateur';
    const flag = user.flag || '🌍';
    const avatar = user.avatar_url;

    return (
      <div key={userId} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl hover:bg-gray-800/70 transition">
        <div className="flex items-center gap-3">
          {avatar ? <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" /> : <span className="text-2xl">{flag}</span>}
          <div>
            <p className="font-semibold text-white">{name}</p>
            <p className="text-sm text-gray-400">{handle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {type === 'followers' && <button onClick={() => handleFollow(userId)} className="bg-gold-500 text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gold-400 transition">+ Suivre</button>}
          {type === 'following' && <button onClick={() => handleUnfollow(userId)} className="bg-gray-700 text-gray-300 px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gray-600 transition">✓ Suivi</button>}
          {type === 'requests' && (
            <div className="flex gap-2">
              <button onClick={() => handleAccept(user.request_user_id)} className="bg-green-500 text-black px-3 py-1.5 rounded-full text-sm font-medium hover:bg-green-400 transition">✓</button>
              <button onClick={() => handleReject(user.request_user_id)} className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full text-sm font-medium hover:bg-red-500/30 transition">✕</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const current = activeTab === 'friends' ? friends : activeTab === 'followers' ? followers : activeTab === 'following' ? following : pending;

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="flex gap-2 overflow-x-auto mb-4">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      {loading ? <p className="text-center text-gray-400 py-8">Chargement...</p> : current.length ? <div className="space-y-2">{current.map((user) => renderUser(user, activeTab))}</div> : <p className="text-center text-gray-500 py-8">Aucun élément</p>}
    </div>
  );
}
