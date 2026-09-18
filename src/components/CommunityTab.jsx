import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Hash,
  Mic,
  Send,
  Plus,
  Users,
  Search,
  Lock,
  Crown,
  Shield,
  UserMinus,
  Pin,
  Settings,
  Volume2,
  Compass,
  Sparkles,
  Globe,
  Flame,
  Smile,
  FileText,
  X,
  ArrowLeft,
  Home,
  MessageCircle,
  Heart,
  Bell,
  Zap,
  Coffee,
  Gamepad2,
  Briefcase,
  Code2,
  BookOpen,
  Music,
  MessageSquare,
  Phone
} from 'lucide-react';

import {
  useCommunity,
  useChannelMessages,
  useVoiceChannel,
  useCurrentUser
} from '../hooks/useCommunity';

import FollowButton from '../features/friends/FollowButton.jsx';
import { FriendsTab, FriendRequests } from '../features/friends/index.js';
import ContactsTab from '../features/contacts/ContactsTab.jsx';
import { COLORS } from '../theme.js';

import AnimatedTab from './ui/AnimatedTab.jsx';
import ChannelItem from './community/ChannelItem.jsx';

const CATEGORIES = [
  {
    id: 'all',
    label: 'Tous',
    icon: Compass,
    color: '#f59e0b',
    gradient: 'from-amber-400 to-orange-500',
    bg: 'rgba(245,158,11,0.15)'
  },
  {
    id: 'community',
    label: 'Communauté',
    icon: Globe,
    color: '#06b6d4',
    gradient: 'from-cyan-500 to-blue-500',
    bg: 'rgba(6,182,214,0.15)',
    emoji: '🌍'
  },
  {
    id: 'business',
    label: 'Business',
    icon: Briefcase,
    color: '#3b82f6',
    gradient: 'from-blue-500 to-cyan-500',
    bg: 'rgba(59,130,246,0.15)',
    emoji: '💼'
  },
  {
    id: 'tech',
    label: 'Tech',
    icon: Code2,
    color: '#10b981',
    gradient: 'from-emerald-500 to-teal-500',
    bg: 'rgba(16,185,129,0.15)',
    emoji: '💻'
  },
  {
    id: 'etudes',
    label: 'Études',
    icon: BookOpen,
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-500',
    bg: 'rgba(139,92,246,0.15)',
    emoji: '📚'
  },
  {
    id: 'divertissement',
    label: 'Fun',
    icon: Gamepad2,
    color: '#ec4899',
    gradient: 'from-pink-500 to-rose-500',
    bg: 'rgba(236,72,153,0.15)',
    emoji: '🎮'
  }
];

const getCategoryConfig = (catId) => {
  return CATEGORIES.find((c) => c.id === catId) || CATEGORIES[0];
};

const getRoleLabel = (role) => {
  switch (role) {
    case 'owner':
      return 'Propriétaire';
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Modérateur';
    default:
      return 'Membre';
  }
};

const getRoleIcon = (role) => {
  switch (role) {
    case 'owner':
      return Crown;
    case 'admin':
      return Shield;
    case 'moderator':
      return Shield;
    default:
      return Users;
  }
};

const getRoleColor = (role) => {
  switch (role) {
    case 'owner':
      return COLORS.gold;
    case 'admin':
      return '#60a5fa';
    case 'moderator':
      return COLORS.teal;
    default:
      return COLORS.muted;
  }
};

export default function CommunityTab({ onOpenProfile }) {
  const { id } = useCurrentUser();

  const {
    allUsers,
    groups,
    createGroup,
    createChannel,
    banMember,
    loading,
    loadUsers
  } = useCommunity();

  const [activeTab, setActiveTab] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showMembers, setShowMembers] = useState(true);

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    is_public: true,
    category: 'community',
    type: 'community'
  });

  const [newChannel, setNewChannel] = useState({
    name: '',
    type: 'text',
    topic: ''
  });

  const [search, setSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [mobileView, setMobileView] = useState('groups');

  const [msgText, setMsgText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  const [actionError, setActionError] = useState('');
  const [messageError, setMessageError] = useState('');

  const messagesEndRef = useRef(null);

  const { messages, sendMessage } = useChannelMessages(selectedChannel?.id) || {
    messages: [],
    sendMessage: async () => {}
  };

  const {
    participants: voiceParticipants,
    isJoined,
    joinVoice,
    leaveVoice,
    loading: voiceLoading
  } = useVoiceChannel(selectedChannel?.id);

  const myRole = useMemo(() => {
    if (!selectedGroup || !id) return 'member';
    return (
      selectedGroup.members?.find((member) => member.user_id === id)?.role ||
      'member'
    );
  }, [selectedGroup, id]);

  const isAdmin = ['owner', 'admin'].includes(myRole);

  useEffect(() => {
    if (!selectedGroup && groups?.length > 0) {
      const firstGroup = groups[0];
      setSelectedGroup(firstGroup);
      const firstChannel =
        firstGroup.channels?.find((channel) => channel.type !== 'voice') ||
        firstGroup.channels?.[0] ||
        null;
      setSelectedChannel(firstChannel);
    }
  }, [groups, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup?.id || !groups?.length) return;
    const refreshedGroup = groups.find((group) => group.id === selectedGroup.id);
    if (refreshedGroup) {
      setSelectedGroup(refreshedGroup);
    }
  }, [groups]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();
    return (groups || []).filter((group) => {
      const name = (group.name || '').toLowerCase();
      const description = (group.description || '').toLowerCase();
      const matchesSearch = !query || name.includes(query) || description.includes(query);
      const matchesCategory =
        selectedCategory === 'all' || (group.category || 'community') === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [groups, groupSearch, selectedCategory]);

  const textChannels = useMemo(
    () => selectedGroup?.channels?.filter((channel) => channel.type !== 'voice') || [],
    [selectedGroup]
  );

  const voiceChannels = useMemo(
    () => selectedGroup?.channels?.filter((channel) => channel.type === 'voice') || [],
    [selectedGroup]
  );

  const handleSelectGroup = useCallback((group) => {
    if (!group) return;
    setSelectedGroup(group);
    const firstChannel =
      group.channels?.find((channel) => channel.type !== 'voice') ||
      group.channels?.[0] ||
      null;
    setSelectedChannel(firstChannel);
    setActiveTab('groups');
    setMobileView('channels');
    setActionError('');
  }, []);

  const handleSelectChannel = useCallback((channel) => {
    if (!channel) return;
    setSelectedChannel(channel);
    setMobileView('chat');
    setMessageError('');
    setActionError('');
  }, []);

  const handleSendMessage = async () => {
    const text = msgText.trim();
    if (!text || !selectedChannel || selectedChannel.type === 'voice' || sendingMessage) return;
    setSendingMessage(true);
    setMessageError('');
    try {
      await sendMessage(text);
      setMsgText('');
    } catch (error) {
      setMessageError(error?.message || 'Impossible d’envoyer le message.');
    } finally {
      setSendingMessage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center" style={{ background: COLORS.bg }}>
        <div className="w-14 h-14 rounded-[18px] animate-pulse" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` }} />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col md:flex-row h-[100dvh] md:h-[calc(100vh-70px)] w-full overflow-hidden select-none"
      style={{ background: COLORS.bg, color: COLORS.ivory }}
    >
      {/* DESKTOP RAIL */}
      <div
        className="hidden md:flex w-[80px] flex-col items-center py-4 gap-3 border-r shrink-0 overflow-y-auto scrollbar-none"
        style={{
          background: `linear-gradient(180deg, ${COLORS.surface} 0%, #0f0f0f 100%)`,
          borderColor: COLORS.border
        }}
      >
        <button
          onClick={() => {
            setActiveTab('discover');
            setMobileView('discover');
          }}
          className={`w-[52px] h-[52px] rounded-[18px] flex items-center justify-center transition-all ${
            activeTab === 'discover' ? 'rounded-[14px] scale-105 shadow-lg shadow-amber-500/20' : ''
          }`}
          style={{
            background: activeTab === 'discover' ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface2,
            color: activeTab === 'discover' ? COLORS.bg : COLORS.teal
          }}
        >
          <Compass size={24} />
        </button>

        <div className="w-8 h-[3px] rounded-full opacity-30 my-1" style={{ background: COLORS.border }} />

        {groups.slice(0, 15).map((group) => {
          const selected = selectedGroup?.id === group.id && activeTab === 'groups';

          return (
            <button
              key={group.id}
              onClick={() => handleSelectGroup(group)}
              className={`w-[52px] h-[52px] rounded-[18px] font-black text-[18px] flex items-center justify-center relative transition-all ${
                selected ? 'rounded-[14px] shadow-lg shadow-amber-500/20' : ''
              }`}
              style={{
                background: selected ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface2,
                color: selected ? COLORS.bg : COLORS.muted
              }}
            >
              {group.avatar_url ? (
                <img src={group.avatar_url} className="w-full h-full rounded-[inherit] object-cover" alt="" />
              ) : (
                group.name?.[0]?.toUpperCase()
              )}
            </button>
          );
        })}
      </div>

      {/* LEFT SIDEBAR */}
      <div
        className={`${mobileView === 'chat' ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] flex-col border-r shrink-0`}
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
      >
        {/* HEADER */}
        <div className="h-[64px] px-4 flex items-center justify-between border-b shrink-0" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center gap-3 min-w-0">
            {mobileView !== 'groups' && (
              <button
                onClick={() => {
                  setMobileView('groups');
                  if (['contacts', 'friends', 'discover'].includes(activeTab)) {
                    setActiveTab('groups');
                  }
                }}
                className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/10"
              >
                <ArrowLeft size={20} />
              </button>
            )}

            <h2 className="font-black text-[15px] truncate" style={{ color: COLORS.ivory }}>
              {activeTab === 'discover' || mobileView === 'discover'
                ? 'Découvrir'
                : activeTab === 'friends' || mobileView === 'friends'
                ? 'Amis'
                : activeTab === 'contacts' || mobileView === 'contacts'
                ? 'Contacts'
                : selectedGroup?.name || 'Communautés'}
            </h2>
          </div>
        </div>

        {/* DESKTOP TABS */}
        <div className="hidden md:flex gap-1 p-2 border-b shrink-0" style={{ borderColor: COLORS.border }}>
          {[
            { id: 'groups', label: 'Canaux', icon: MessageCircle },
            { id: 'friends', label: 'Amis', icon: Heart },
            { id: 'contacts', label: 'Contacts', icon: Phone }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id && mobileView !== 'discover';

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileView(tab.id);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[12px] text-[11px] font-black uppercase tracking-wider ${
                  active ? 'shadow-md' : ''
                }`}
                style={{
                  background: active ? COLORS.gold : 'transparent',
                  color: active ? COLORS.bg : COLORS.muted
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SIDEBAR CONTENT AVEC ANIMATION */}
        <div className="flex-1 overflow-y-auto">
          <AnimatedTab tabKey={mobileView}>
            {(mobileView === 'groups' || mobileView === 'channels') &&
              !['discover', 'friends', 'contacts'].includes(activeTab) && (
                <div className="p-3 space-y-3">
                  {textChannels.map((channel) => (
                    <ChannelItem
                      key={channel.id}
                      channel={channel}
                      isActive={selectedChannel?.id === channel.id}
                      unreadCount={channel.unread_count || 0}
                      lastMessage={channel.last_message}
                      onSelect={handleSelectChannel}
                    />
                  ))}
                </div>
              )}

            {(mobileView === 'friends' || activeTab === 'friends') && (
              <FriendsTab onOpenProfile={onOpenProfile} />
            )}

            {(mobileView === 'contacts' || activeTab === 'contacts') && (
              <ContactsTab onOpenProfile={onOpenProfile} />
            )}
          </AnimatedTab>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`} style={{ background: COLORS.bg }}>
        {selectedChannel && (
          <div className="flex-1 flex flex-col justify-between p-4">
            <div className="flex-1 overflow-y-auto space-y-2">
              {messages.map((m) => (
                <div key={m.id} className="p-2 rounded bg-white/5">{m.text || m.content}</div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2 pt-2">
              <input
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Message..."
                className="flex-1 p-3 rounded-[12px] bg-white/10 text-white outline-none"
              />
              <button onClick={handleSendMessage} className="p-3 rounded-[12px]" style={{ background: COLORS.gold, color: COLORS.bg }}>
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION MOBILE */}
      <div className="flex md:hidden h-[72px] border-t items-center justify-between px-2 shrink-0" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        {[
          { id: 'groups', icon: Home, label: 'Groupes' },
          { id: 'channels', icon: MessageCircle, label: 'Canaux' },
          { id: 'discover', icon: Compass, label: 'Découvrir' },
          { id: 'friends', icon: Users, label: 'Amis' },
          { id: 'contacts', icon: Phone, label: 'Contacts' }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = mobileView === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                const targetTab = tab.id === 'channels' ? 'groups' : tab.id;
                setActiveTab(targetTab);
                setMobileView(tab.id);
              }}
              className="flex flex-col items-center justify-center flex-1 py-1"
            >
              <div
                className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${active ? 'shadow-lg' : ''}`}
                style={{
                  background: active ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : 'transparent',
                  color: active ? COLORS.bg : COLORS.muted
                }}
              >
                <Icon size={18} />
              </div>
              <span className="text-[9px] font-black mt-1" style={{ color: active ? COLORS.gold : COLORS.muted }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
