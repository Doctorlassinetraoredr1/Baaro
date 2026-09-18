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

const getChannelIcon = (channel) => {
  const name = (channel?.name || '').toLowerCase();

  if (channel?.type === 'voice') return Volume2;
  if (name.includes('general') || name.includes('général')) return MessageCircle;
  if (name.includes('annonce') || name.includes('news')) return Bell;
  if (name.includes('business') || name.includes('startup')) return Briefcase;
  if (name.includes('tech') || name.includes('code')) return Code2;
  if (name.includes('etude') || name.includes('étude') || name.includes('study')) {
    return BookOpen;
  }
  if (
    name.includes('fun') ||
    name.includes('game') ||
    name.includes('meme')
  ) {
    return Gamepad2;
  }
  if (
    name.includes('music') ||
    name.includes('musique') ||
    name.includes('chill')
  ) {
    return Music;
  }
  if (name.includes('café') || name.includes('cafe')) return Coffee;

  return MessageSquare;
};

const getChannelColor = (channel, isActive) => {
  if (isActive) {
    return `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`;
  }

  const name = (channel?.name || '').toLowerCase();

  if (name.includes('general') || name.includes('général')) {
    return 'rgba(251,191,36,0.15)';
  }

  if (name.includes('annonce')) {
    return 'rgba(239,68,68,0.15)';
  }

  if (name.includes('business')) {
    return 'rgba(59,130,246,0.15)';
  }

  if (name.includes('tech')) {
    return 'rgba(16,185,129,0.15)';
  }

  return COLORS.surface2;
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
    friends,
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

  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');

  const [mobileView, setMobileView] = useState('groups');

  const [msgText, setMsgText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  const [actionError, setActionError] = useState('');
  const [messageError, setMessageError] = useState('');

  const messagesEndRef = useRef(null);

  const {
    messages,
    sendMessage
  } = useChannelMessages(selectedChannel?.id) || {
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

  /*
   * ------------------------------------------------------------
   * ROLE / PERMISSIONS
   * ------------------------------------------------------------
   */

  const myRole = useMemo(() => {
    if (!selectedGroup || !id) return 'member';

    return (
      selectedGroup.members?.find(
        (member) => member.user_id === id
      )?.role || 'member'
    );
  }, [selectedGroup, id]);

  const isOwner = myRole === 'owner';

  const isAdmin = ['owner', 'admin'].includes(myRole);

  /*
   * ------------------------------------------------------------
   * GROUP AUTO-SELECTION
   * ------------------------------------------------------------
   */

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

  /*
   * ------------------------------------------------------------
   * KEEP SELECTED GROUP IN SYNC WITH REFRESHED GROUP DATA
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!selectedGroup?.id || !groups?.length) return;

    const refreshedGroup = groups.find(
      (group) => group.id === selectedGroup.id
    );

    if (refreshedGroup) {
      setSelectedGroup(refreshedGroup);

      if (
        selectedChannel?.id &&
        refreshedGroup.channels?.length &&
        !refreshedGroup.channels.some(
          (channel) => channel.id === selectedChannel.id
        )
      ) {
        setSelectedChannel(
          refreshedGroup.channels.find(
            (channel) => channel.type !== 'voice'
          ) ||
            refreshedGroup.channels[0] ||
            null
        );
      }
    }
  }, [groups]);

  /*
   * ------------------------------------------------------------
   * SCROLL MESSAGES
   * ------------------------------------------------------------
   */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages]);

  /*
   * ------------------------------------------------------------
   * DEBOUNCED SEARCH
   * ------------------------------------------------------------
   */

  useEffect(() => {
    const query = search.trim();

    if (query.length < 2) return;

    const timer = setTimeout(() => {
      loadUsers?.(query);
    }, 350);

    return () => clearTimeout(timer);
  }, [search, loadUsers]);

  /*
   * ------------------------------------------------------------
   * GROUP FILTERS
   * ------------------------------------------------------------
   */

  const filteredGroups = useMemo(() => {
    const query = groupSearch.trim().toLowerCase();

    return (groups || []).filter((group) => {
      const name = (group.name || '').toLowerCase();
      const description = (group.description || '').toLowerCase();

      const matchesSearch =
        !query ||
        name.includes(query) ||
        description.includes(query);

      const matchesCategory =
        selectedCategory === 'all' ||
        (group.category || 'community') === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [groups, groupSearch, selectedCategory]);

  /*
   * ------------------------------------------------------------
   * DISCOVERY SEARCH
   * ------------------------------------------------------------
   */

  const searchedGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    return (groups || []).filter((group) => {
      const name = (group.name || '').toLowerCase();
      const description = (group.description || '').toLowerCase();

      return (
        name.includes(query) ||
        description.includes(query)
      );
    });
  }, [groups, search]);

  const filteredUsersForDiscover = useMemo(() => {
    return (allUsers || []).filter((user) => {
      const matchesCountry =
        selectedCountry === 'all' ||
        user.country === selectedCountry;

      const matchesLanguage =
        selectedLanguage === 'all' ||
        user.language === selectedLanguage;

      return matchesCountry && matchesLanguage;
    });
  }, [
    allUsers,
    selectedCountry,
    selectedLanguage
  ]);

  const searchedUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    return filteredUsersForDiscover.filter((user) => {
      const displayName = (
        user.display_name || ''
      ).toLowerCase();

      const handle = (
        user.handle || ''
      ).toLowerCase();

      return (
        displayName.includes(query) ||
        handle.includes(query)
      );
    });
  }, [
    filteredUsersForDiscover,
    search
  ]);

  /*
   * ------------------------------------------------------------
   * CHANNELS
   * ------------------------------------------------------------
   */

  const textChannels = useMemo(
    () =>
      selectedGroup?.channels?.filter(
        (channel) => channel.type !== 'voice'
      ) || [],
    [selectedGroup]
  );

  const voiceChannels = useMemo(
    () =>
      selectedGroup?.channels?.filter(
        (channel) => channel.type === 'voice'
      ) || [],
    [selectedGroup]
  );

  /*
   * ------------------------------------------------------------
   * GROUP SELECTION
   * ------------------------------------------------------------
   */

  const handleSelectGroup = useCallback((group) => {
    if (!group) return;

    setSelectedGroup(group);

    const firstChannel =
      group.channels?.find(
        (channel) => channel.type !== 'voice'
      ) ||
      group.channels?.[0] ||
      null;

    setSelectedChannel(firstChannel);

    setActiveTab('groups');
    setMobileView('channels');
    setActionError('');
  }, []);

  /*
   * ------------------------------------------------------------
   * CHANNEL SELECTION
   * ------------------------------------------------------------
   */

  const handleSelectChannel = useCallback((channel) => {
    if (!channel) return;

    setSelectedChannel(channel);
    setMobileView('chat');
    setMessageError('');
    setActionError('');
  }, []);

  /*
   * ------------------------------------------------------------
   * CREATE GROUP
   * ------------------------------------------------------------
   */

  const handleCreateGroup = async () => {
    const name = newGroup.name.trim();

    if (!name || creatingGroup) return;

    setCreatingGroup(true);
    setActionError('');

    try {
      const payload = {
        name,
        description:
          newGroup.description?.trim() || null,
        is_public: !!newGroup.is_public,
        category:
          newGroup.category || 'community',
        type: 'community'
      };

      const group = await createGroup(payload);

      setShowCreateGroup(false);

      setNewGroup({
        name: '',
        description: '',
        is_public: true,
        category: 'community',
        type: 'community'
      });

      if (group) {
        setSelectedGroup(group);

        const firstChannel =
          group.channels?.find(
            (channel) => channel.type !== 'voice'
          ) ||
          group.channels?.[0] ||
          null;

        setSelectedChannel(firstChannel);
        setActiveTab('groups');
        setMobileView('channels');
      }
    } catch (error) {
      console.error('create group:', error);

      setActionError(
        error?.message ||
          'Impossible de créer le groupe.'
      );
    } finally {
      setCreatingGroup(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * CREATE CHANNEL
   * ------------------------------------------------------------
   */

  const handleCreateChannel = async () => {
    if (
      !selectedGroup ||
      !newChannel.name.trim() ||
      creatingChannel
    ) {
      return;
    }

    setCreatingChannel(true);
    setActionError('');

    try {
      const channel = await createChannel(
        selectedGroup.id,
        {
          name: newChannel.name.trim(),
          type: newChannel.type,
          description:
            newChannel.topic?.trim() || null,
          topic:
            newChannel.topic?.trim() || null
        }
      );

      setShowCreateChannel(false);

      setNewChannel({
        name: '',
        type: 'text',
        topic: ''
      });

      if (channel) {
        setSelectedChannel(channel);
        setMobileView('chat');
      }
    } catch (error) {
      console.error('create channel:', error);

      setActionError(
        error?.message ||
          'Impossible de créer le canal.'
      );
    } finally {
      setCreatingChannel(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * REMOVE MEMBER
   * ------------------------------------------------------------
   */

  const handleRemoveMember = async (member) => {
    if (!selectedGroup || !member || !isAdmin) return;

    if (member.user_id === id) {
      setActionError(
        'Tu ne peux pas supprimer ton propre compte du groupe depuis cette action.'
      );
      return;
    }

    if (member.role === 'owner') {
      setActionError(
        'Le propriétaire du groupe ne peut pas être supprimé.'
      );
      return;
    }

    const displayName =
      member.profiles?.display_name ||
      member.profiles?.handle ||
      'ce membre';

    const confirmed = window.confirm(
      `Retirer ${displayName} du groupe ?`
    );

    if (!confirmed) return;

    setActionError('');

    try {
      await banMember(
        selectedGroup.id,
        member.user_id
      );
    } catch (error) {
      console.error('remove member:', error);

      setActionError(
        error?.message ||
          'Impossible de retirer ce membre.'
      );
    }
  };

  /*
   * ------------------------------------------------------------
   * SEND MESSAGE
   * ------------------------------------------------------------
   */

  const handleSendMessage = async () => {
    const text = msgText.trim();

    if (
      !text ||
      !selectedChannel ||
      selectedChannel.type === 'voice' ||
      sendingMessage
    ) {
      return;
    }

    setSendingMessage(true);
    setMessageError('');

    try {
      await sendMessage(text);
      setMsgText('');
    } catch (error) {
      console.error('send message:', error);

      setMessageError(
        error?.message ||
          'Impossible d’envoyer le message.'
      );
    } finally {
      setSendingMessage(false);
    }
  };

  /*
   * ------------------------------------------------------------
   * KEYBOARD MESSAGE
   * ------------------------------------------------------------
   */

  const handleMessageKeyDown = (event) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  /*
   * ------------------------------------------------------------
   * LOADING
   * ------------------------------------------------------------
   */

  if (loading) {
    return (
      <div
        className="flex h-[100dvh] items-center justify-center"
        style={{ background: COLORS.bg }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-[18px] animate-pulse"
            style={{
              background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`
            }}
          />

          <p
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: COLORS.muted }}
          >
            Communauté
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col md:flex-row h-[100dvh] md:h-[calc(100vh-70px)] w-full overflow-hidden select-none"
      style={{
        background: COLORS.bg,
        color: COLORS.ivory
      }}
    >
      {/* =====================================================
          DESKTOP RAIL
      ====================================================== */}

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
          className={`w-[52px] h-[52px] rounded-[18px] flex items-center justify-center transition-all duration-300 hover:rounded-[14px] hover:scale-105 ${
            activeTab === 'discover'
              ? 'rounded-[14px] scale-105 shadow-lg shadow-amber-500/20'
              : ''
          }`}
          style={{
            background:
              activeTab === 'discover'
                ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`
                : COLORS.surface2,
            color:
              activeTab === 'discover'
                ? COLORS.bg
                : COLORS.teal
          }}
        >
          <Compass size={24} />
        </button>

        <div
          className="w-8 h-[3px] rounded-full opacity-30 my-1"
          style={{ background: COLORS.border }}
        />

        {groups.slice(0, 15).map((group) => {
          const selected =
            selectedGroup?.id === group.id &&
            activeTab !== 'discover' &&
            activeTab !== 'friends' &&
            activeTab !== 'contacts';

          return (
            <div
              key={group.id}
              className="relative group/rail"
            >
              {selected && (
                <div
                  className="absolute -left-4 top-1/2 -translate-y-1/2 w-[4px] h-8 rounded-r-full"
                  style={{
                    background: COLORS.gold
                  }}
                />
              )}

              <button
                onClick={() =>
                  handleSelectGroup(group)
                }
                className={`w-[52px] h-[52px] rounded-[18px] font-black text-[18px] flex items-center justify-center relative transition-all duration-300 hover:rounded-[14px] hover:scale-105 ${
                  selected
                    ? 'rounded-[14px] shadow-lg shadow-amber-500/20'
                    : ''
                }`}
                style={{
                  background: selected
                    ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`
                    : COLORS.surface2,
                  color: selected
                    ? COLORS.bg
                    : COLORS.muted
                }}
              >
                {group.avatar_url ? (
                  <img
                    src={group.avatar_url}
                    className="w-full h-full rounded-[inherit] object-cover"
                    alt=""
                  />
                ) : (
                  group.name?.[0]?.toUpperCase()
                )}

                {!group.is_public && (
                  <div
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black border-2 flex items-center justify-center"
                    style={{
                      borderColor: COLORS.surface
                    }}
                  >
                    <Lock size={10} />
                  </div>
                )}
              </button>

              {group.is_boosted && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow">
                  <Sparkles
                    size={10}
                    className="text-black"
                  />
                </div>
              )}
            </div>
          );
        })}

        <button
          onClick={() =>
            setShowCreateGroup(true)
          }
          className="w-[52px] h-[52px] rounded-[18px] flex items-center justify-center border-2 border-dashed mt-2 hover:rounded-[14px] hover:border-solid transition-all group/btn"
          style={{
            borderColor: COLORS.border,
            color: COLORS.teal
          }}
        >
          <Plus
            size={22}
            className="group-hover/btn:rotate-90 transition-transform duration-300"
          />
        </button>
      </div>

      {/* =====================================================
          LEFT SIDEBAR
      ====================================================== */}

      <div
        className={`${
          mobileView === 'chat'
            ? 'hidden md:flex'
            : 'flex'
        } w-full md:w-[360px] flex-col border-r shrink-0`}
        style={{
          background: COLORS.surface,
          borderColor: COLORS.border
        }}
      >
        {/* HEADER */}

        <div
          className="h-[64px] px-4 flex items-center justify-between border-b shrink-0"
          style={{
            borderColor: COLORS.border,
            background: `linear-gradient(90deg, ${COLORS.surface} 0%, ${COLORS.surface2} 100%)`
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {mobileView !== 'groups' && (
              <button
                onClick={() => {
                  setMobileView('groups');
                  if (activeTab === 'contacts' || activeTab === 'friends' || activeTab === 'discover') {
                    setActiveTab('groups');
                  }
                }}
                className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/10"
                style={{
                  color: COLORS.ivory
                }}
              >
                <ArrowLeft size={20} />
              </button>
            )}

            <div
              className="w-9 h-9 rounded-[12px] flex items-center justify-center font-black text-[16px] shrink-0 overflow-hidden"
              style={{
                background: (selectedGroup && activeTab === 'groups')
                  ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`
                  : COLORS.surface2,
                color: (selectedGroup && activeTab === 'groups')
                  ? COLORS.bg
                  : COLORS.muted
              }}
            >
              {(selectedGroup && activeTab === 'groups') ? (
                selectedGroup.avatar_url ? (
                  <img
                    src={selectedGroup.avatar_url}
                    className="w-full h-full rounded-[12px] object-cover"
                    alt=""
                  />
                ) : (
                  selectedGroup.name?.[0]?.toUpperCase()
                )
              ) : (
                <Home size={18} />
              )}
            </div>

            <div className="min-w-0">
              <h2
                className="font-black text-[15px] truncate tracking-tight"
                style={{ color: COLORS.ivory }}
              >
                {activeTab === 'discover' || mobileView === 'discover'
                  ? 'Découvrir'
                  : activeTab === 'friends' || mobileView === 'friends'
                  ? 'Amis'
                  : activeTab === 'contacts' || mobileView === 'contacts'
                  ? 'Contacts'
                  : selectedGroup?.name ||
                    'Communautés'}
              </h2>

              <p
                className="text-[11px] truncate flex items-center gap-1"
                style={{ color: COLORS.muted }}
              >
                {selectedGroup && activeTab === 'groups' ? (
                  <>
                    <Users size={10} />
                    {selectedGroup.members?.length || 0}{' '}
                    membres
                  </>
                ) : (
                  `${groups.length} groupes`
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              setShowCreateGroup(true)
            }
            className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: COLORS.gold,
              color: COLORS.bg
            }}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* =================================================
            DESKTOP TABS
        ================================================== */}

        <div
          className="hidden md:flex gap-1 p-2 border-b shrink-0"
          style={{ borderColor: COLORS.border }}
        >
          {[
            {
              id: 'groups',
              label: 'Canaux',
              icon: MessageCircle
            },
            {
              id: 'friends',
              label: 'Amis',
              icon: Heart
            },
            {
              id: 'contacts',
              label: 'Contacts',
              icon: Phone
            }
          ].map((tab) => {
            const Icon = tab.icon;

            const active =
              activeTab === tab.id &&
              mobileView !== 'discover';

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
                  background: active
                    ? COLORS.gold
                    : 'transparent',
                  color: active
                    ? COLORS.bg
                    : COLORS.muted
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* =================================================
            SIDEBAR CONTENT
        ================================================== */}

        <div className="flex-1 overflow-y-auto">
          {/* GROUPS / CHANNELS */}

          {(mobileView === 'groups' ||
            mobileView === 'channels' ||
            activeTab === 'groups') &&
            activeTab !== 'discover' &&
            activeTab !== 'friends' &&
            activeTab !== 'contacts' &&
            mobileView !== 'contacts' &&
            mobileView !== 'friends' &&
            mobileView !== 'discover' && (
              <div className="p-3 space-y-5">
                {/* GROUP LIST */}

                <div
                  className={`${
                    mobileView === 'channels'
                      ? 'hidden md:block'
                      : 'block'
                  } space-y-3`}
                >
                  <div className="relative">
                    <Search
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2"
                      style={{
                        color: COLORS.muted
                      }}
                    />

                    <input
                      value={groupSearch}
                      onChange={(event) =>
                        setGroupSearch(
                          event.target.value
                        )
                      }
                      placeholder="Filtrer les groupes..."
                      className="w-full pl-10 pr-3 py-3 rounded-[14px] text-[14px] font-medium outline-none border focus:border-amber-400/50"
                      style={{
                        background: COLORS.surface2,
                        borderColor: COLORS.border,
                        color: COLORS.ivory
                      }}
                    />
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                    {CATEGORIES.map((category) => {
                      const active =
                        selectedCategory ===
                        category.id;

                      const Icon = category.icon;

                      return (
                        <button
                          key={category.id}
                          onClick={() =>
                            setSelectedCategory(
                              category.id
                            )
                          }
                          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-[11px] font-black whitespace-nowrap transition-all border ${
                            active
                              ? 'scale-105 shadow-lg'
                              : 'hover:scale-102'
                          }`}
                          style={{
                            background: active
                              ? `linear-gradient(135deg, ${category.color}, ${category.color}dd)`
                              : category.bg,
                            color: active
                              ? 'white'
                              : category.color,
                            borderColor: active
                              ? category.color
                              : 'transparent'
                          }}
                        >
                          <Icon size={13} />
                          {category.label}

                          {active && (
                            <span className="ml-1 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="space-y-1.5">
                    {filteredGroups.map((group) => {
                      const selected =
                        selectedGroup?.id ===
                        group.id;

                      const category =
                        getCategoryConfig(
                          group.category
                        );

                      const CategoryIcon =
                        category.icon;

                      return (
                        <button
                          key={group.id}
                          onClick={() =>
                            handleSelectGroup(group)
                          }
                          className={`w-full flex items-center gap-3 p-3 rounded-[16px] text-left border-2 transition-all hover:scale-[1.01] group ${
                            selected
                              ? 'shadow-lg'
                              : ''
                          }`}
                          style={{
                            background: selected
                              ? COLORS.surface2
                              : 'transparent',
                            borderColor: selected
                              ? category.color
                              : 'transparent'
                          }}
                        >
                          <div
                            className="w-12 h-12 rounded-[14px] flex items-center justify-center font-black text-[16px] shrink-0 overflow-hidden shadow-lg relative"
                            style={{
                              background:
                                group.avatar_url
                                  ? 'transparent'
                                  : `linear-gradient(135deg, ${category.color}, ${category.color}cc)`,
                              color: 'white'
                            }}
                          >
                            {group.avatar_url ? (
                              <img
                                src={
                                  group.avatar_url
                                }
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            ) : (
                              <CategoryIcon
                                size={20}
                              />
                            )}

                            {group.is_boosted && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                                <Sparkles
                                  size={8}
                                  className="text-black"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p
                                className="text-[14px] font-black truncate"
                                style={{
                                  color: COLORS.ivory
                                }}
                              >
                                {group.name}
                              </p>

                              {!group.is_public && (
                                <Lock
                                  size={10}
                                  style={{
                                    color: COLORS.muted
                                  }}
                                />
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  background:
                                    category.bg,
                                  color:
                                    category.color
                                }}
                              >
                                <CategoryIcon
                                  size={10}
                                />
                                {category.label}
                              </span>

                              <span
                                className="text-[11px] font-medium"
                                style={{
                                  color: COLORS.muted
                                }}
                              >
                                {group.members
                                  ?.length || 0}{' '}
                                membres
                              </span>
                            </div>
                          </div>

                          {selected && (
                            <div
                              className="w-2 h-2 rounded-full animate-pulse"
                              style={{
                                background:
                                  category.color
                              }}
                            />
                          )}
                        </button>
                      );
                    })}

                    {filteredGroups.length === 0 && (
                      <div className="text-center py-8">
                        <Users
                          size={26}
                          className="mx-auto mb-2 opacity-30"
                        />

                        <p
                          className="text-xs font-bold"
                          style={{
                            color: COLORS.muted
                          }}
                        >
                          Aucun groupe trouvé
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* CHANNEL LIST */}

                <div
                  className={`${
                    mobileView === 'groups'
                      ? 'hidden md:block'
                      : 'block'
                  } space-y-5`}
                >
                  {selectedGroup && (
                    <>
                      {/* TEXT CHANNELS */}

                      <div>
                        <div className="flex items-center justify-between px-1 mb-2">
                          <p
                            className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                            style={{
                              color: COLORS.muted
                            }}
                          >
                            <MessageSquare
                              size={12}
                            />
                            Canaux Texte —{' '}
                            {textChannels.length}
                          </p>

                          {isAdmin && (
                            <button
                              onClick={() =>
                                setShowCreateChannel(
                                  true
                                )
                              }
                              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                              style={{
                                color: COLORS.muted
                              }}
                              title="Créer un canal"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-1">
                          {textChannels.map(
                            (channel) => {
                              const active =
                                selectedChannel?.id ===
                                channel.id;

                              const Icon =
                                getChannelIcon(
                                  channel
                                );

                              return (
                                <button
                                  key={channel.id}
                                  onClick={() =>
                                    handleSelectChannel(
                                      channel
                                    )
                                  }
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left group transition-all hover:scale-[1.01] ${
                                    active
                                      ? 'shadow-md'
                                      : ''
                                  }`}
                                  style={{
                                    background: active
                                      ? 'rgba(251,191,36,0.15)'
                                      : 'transparent',
                                    border: `1px solid ${
                                      active
                                        ? 'rgba(251,191,36,0.3)'
                                        : 'transparent'
                                    }`,
                                    color: active
                                      ? COLORS.gold
                                      : COLORS.muted
                                  }}
                                >
                                  <div
                                    className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                                    style={{
                                      background:
                                        getChannelColor(
                                          channel,
                                          active
                                        ),
                                      color: active
                                        ? COLORS.gold
                                        : COLORS.muted
                                    }}
                                  >
                                    <Icon
                                      size={16}
                                    />
                                  </div>

                                  <span
                                    className={`text-[13.5px] font-bold truncate ${
                                      active
                                        ? 'text-amber-400'
                                        : ''
                                    }`}
                                  >
                                    {channel.name}
                                  </span>

                                  {active && (
                                    <div className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                  )}
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>

                      {/* VOICE CHANNELS */}

                      <div>
                        <div className="flex items-center justify-between px-1 mb-2">
                          <p
                            className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
                            style={{
                              color: COLORS.muted
                            }}
                          >
                            <Volume2 size={12} />
                            Vocaux —{' '}
                            {voiceChannels.length}
                          </p>
                        </div>

                        <div className="space-y-1">
                          {voiceChannels.map(
                            (channel) => {
                              const Icon =
                                getChannelIcon(
                                  channel
                                );

                              const active =
                                selectedChannel?.id ===
                                channel.id;

                              return (
                                <button
                                  key={channel.id}
                                  onClick={() =>
                                    handleSelectChannel(
                                      channel
                                    )
                                  }
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left hover:bg-white/5 transition-all"
                                  style={{
                                    background: active
                                      ? 'rgba(20,184,166,0.1)'
                                      : 'transparent',
                                    color: active
                                      ? COLORS.teal
                                      : COLORS.muted
                                  }}
                                >
                                  <div
                                    className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                                    style={{
                                      background: active
                                        ? 'rgba(20,184,166,0.2)'
                                        : COLORS.surface2
                                    }}
                                  >
                                    <Icon size={16} />
                                  </div>

                                  <span className="text-[13.5px] font-bold">
                                    {channel.name}
                                  </span>

                                  <div className="ml-auto flex -space-x-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  </div>
                                </button>
                              );
                            }
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

          {/* =================================================
              DISCOVER
          ================================================== */}

          {(mobileView === 'discover' || activeTab === 'discover') && (
            <div className="p-4 space-y-6">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{
                    color: COLORS.muted
                  }}
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Groupes, @amis..."
                  className="w-full pl-12 pr-4 py-4 rounded-[16px] text-[15px] font-medium outline-none border-2"
                  style={{
                    background: COLORS.surface2,
                    borderColor: COLORS.border,
                    color: COLORS.ivory
                  }}
                />
              </div>

              {!search ? (
                <>
                  {/* POPULAR GROUPS */}

                  <div className="space-y-3">
                    <p
                      className="text-[12px] font-black uppercase tracking-widest flex items-center gap-2"
                      style={{
                        color: COLORS.ivory
                      }}
                    >
                      <Flame
                        size={14}
                        className="text-orange-500"
                      />
                      Groupes populaires
                    </p>

                    {groups.slice(0, 5).map(
                      (group) => {
                        const category =
                          getCategoryConfig(
                            group.category
                          );

                        const CategoryIcon =
                          category.icon;

                        return (
                          <div
                            key={group.id}
                            onClick={() =>
                              handleSelectGroup(
                                group
                              )
                            }
                            className="p-4 rounded-[20px] border-2 flex gap-4 cursor-pointer hover:scale-[1.02] transition-all group"
                            style={{
                              background:
                                COLORS.surface2,
                              borderColor:
                                COLORS.border
                            }}
                          >
                            <div
                              className="w-14 h-14 rounded-[16px] flex items-center justify-center font-black text-[18px] shrink-0 shadow-lg relative overflow-hidden"
                              style={{
                                background:
                                  group.avatar_url
                                    ? 'transparent'
                                    : `linear-gradient(135deg, ${category.color}, ${category.color}dd)`
                              }}
                            >
                              {group.avatar_url ? (
                                <img
                                  src={
                                    group.avatar_url
                                  }
                                  className="w-full h-full object-cover"
                                  alt=""
                                />
                              ) : (
                                <CategoryIcon
                                  size={24}
                                  className="text-white"
                                />
                              )}

                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p
                                  className="font-black text-[15px] truncate"
                                  style={{
                                    color:
                                      COLORS.ivory
                                  }}
                                >
                                  {group.name}
                                </p>

                                <span
                                  className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1"
                                  style={{
                                    background:
                                      category.bg,
                                    color:
                                      category.color
                                  }}
                                >
                                  <CategoryIcon
                                    size={10}
                                  />
                                  {category.label}
                                </span>
                              </div>

                              <p
                                className="text-[12px] line-clamp-2"
                                style={{
                                  color:
                                    COLORS.muted
                                }}
                              >
                                {group.description ||
                                  `Communauté Baaro • ${
                                    group.members
                                      ?.length || 0
                                  } membres`}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* NEW USERS */}

                  <div className="space-y-3">
                    <p
                      className="text-[12px] font-black uppercase tracking-widest"
                      style={{
                        color: COLORS.ivory
                      }}
                    >
                      Nouveaux membres
                    </p>

                    <div className="space-y-2">
                      {allUsers
                        .slice(0, 6)
                        .map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center justify-between gap-3 p-3 rounded-[16px] border"
                            style={{
                              background:
                                COLORS.surface2,
                              borderColor:
                                COLORS.border
                            }}
                          >
                            <div
                              className="flex items-center gap-3 min-w-0 cursor-pointer"
                              onClick={() =>
                                onOpenProfile?.(
                                  user.id
                                )
                              }
                            >
                              <img
                                src={
                                  user.avatar_url ||
                                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                    user.display_name ||
                                      user.handle ||
                                      'user'
                                  )}`
                                }
                                className="w-11 h-11 rounded-full"
                                alt=""
                              />

                              <div className="min-w-0">
                                <p
                                  className="text-[14px] font-black truncate"
                                  style={{
                                    color:
                                      COLORS.ivory
                                  }}
                                >
                                  {user.display_name ||
                                    'Utilisateur'}
                                </p>

                                <p
                                  className="text-[11px] truncate"
                                  style={{
                                    color:
                                      COLORS.muted
                                  }}
                                >
                                  @{user.handle ||
                                    'user'}
                                </p>
                              </div>
                            </div>

                            {id &&
                              user.id !== id && (
                                <FollowButton
                                  targetId={user.id}
                                />
                              )}
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  {/* SEARCH GROUPS */}

                  <div className="space-y-2">
                    <p
                      className="text-[11px] font-black uppercase"
                      style={{
                        color: COLORS.muted
                      }}
                    >
                      Groupes •{' '}
                      {searchedGroups.length}
                    </p>

                    {searchedGroups
                      .slice(0, 10)
                      .map((group) => (
                        <div
                          key={group.id}
                          onClick={() =>
                            handleSelectGroup(
                              group
                            )
                          }
                          className="p-3 rounded-[16px] border flex gap-3 cursor-pointer"
                          style={{
                            background:
                              COLORS.surface2,
                            borderColor:
                              COLORS.border
                          }}
                        >
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center font-black overflow-hidden"
                            style={{
                              background:
                                `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`
                            }}
                          >
                            {group.avatar_url ? (
                              <img
                                src={
                                  group.avatar_url
                                }
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            ) : (
                              group.name?.[0]
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className="font-black text-[14px]"
                              style={{
                                color:
                                  COLORS.ivory
                              }}
                            >
                              {group.name}
                            </p>

                            <p
                              className="text-[12px] truncate"
                              style={{
                                color:
                                  COLORS.muted
                              }}
                            >
                              {group.description ||
                                ''}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* SEARCH USERS */}

                  <div className="space-y-2">
                    <p
                      className="text-[11px] font-black uppercase"
                      style={{
                        color: COLORS.muted
                      }}
                    >
                      Personnes •{' '}
                      {searchedUsers.length}
                    </p>

                    {searchedUsers
                      .slice(0, 10)
                      .map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between gap-2 p-3 rounded-[16px] border"
                          style={{
                            background:
                              COLORS.surface2,
                            borderColor:
                              COLORS.border
                          }}
                        >
                          <div
                            className="flex items-center gap-3 min-w-0 cursor-pointer"
                            onClick={() =>
                              onOpenProfile?.(
                                user.id
                              )
                            }
                          >
                            <img
                              src={
                                user.avatar_url ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                  user.display_name ||
                                    user.handle ||
                                    'user'
                                )}`
                              }
                              className="w-11 h-11 rounded-full"
                              alt=""
                            />

                            <div className="min-w-0">
                              <p
                                className="text-[14px] font-black truncate"
                                style={{
                                  color:
                                    COLORS.ivory
                                }}
                              >
                                {user.display_name ||
                                  'Utilisateur'}
                              </p>

                              <p
                                className="text-[11px]"
                                style={{
                                  color:
                                    COLORS.muted
                                }}
                              >
                                @{user.handle ||
                                  'user'}
                              </p>
                            </div>
                          </div>

                          {id &&
                            user.id !== id && (
                              <FollowButton
                                targetId={user.id}
                              />
                            )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =================================================
              FRIENDS
          ================================================== */}

          {(mobileView === 'friends' || activeTab === 'friends') && (
            <div className="p-3 space-y-4">
              <FriendRequests
                onOpenProfile={onOpenProfile}
              />

              <div
                className="h-[1px]"
                style={{
                  background: COLORS.border
                }}
              />

              <FriendsTab
                onOpenProfile={onOpenProfile}
              />
            </div>
          )}

          {/* =================================================
              CONTACTS
          ================================================== */}

          {(mobileView === 'contacts' || activeTab === 'contacts') && (
            <ContactsTab
              onOpenProfile={onOpenProfile}
            />
          )}
        </div>
      </div>

      {/* =====================================================
          CHAT AREA
      ====================================================== */}

      <div
        className={`${
          mobileView === 'chat'
            ? 'flex'
            : 'hidden'
        } md:flex flex-1 flex-col min-w-0`}
        style={{ background: COLORS.bg }}
      >
        {/* =================================================
            NO CHANNEL
        ================================================== */}

        {!selectedChannel ? (
          <div
            className="flex-1 flex flex-col items-center justify-center p-8 text-center"
            style={{
              color: COLORS.muted
            }}
          >
            <div
              className="w-24 h-24 rounded-[28px] flex items-center justify-center mb-6"
              style={{
                background: COLORS.surface2
              }}
            >
              <MessageCircle
                size={36}
                className="opacity-20"
              />
            </div>

            <h3
              className="font-black text-[20px] mb-2"
              style={{
                color: COLORS.ivory
              }}
            >
              Bienvenue
            </h3>

            <p className="text-[14px] max-w-[320px]">
              Sélectionne un canal pour discuter.
            </p>

            <button
              onClick={() =>
                setMobileView('groups')
              }
              className="md:hidden mt-6 px-6 py-3 rounded-full font-black text-[13px]"
              style={{
                background: COLORS.gold,
                color: COLORS.bg
              }}
            >
              Voir les groupes
            </button>
          </div>
        ) : selectedChannel.type === 'voice' ? (
          /* =================================================
             VOICE
          ================================================== */

          <div className="flex-1 flex flex-col">
            <div
              className="h-[64px] px-4 flex items-center gap-3 border-b"
              style={{
                borderColor: COLORS.border
              }}
            >
              <button
                onClick={() =>
                  setMobileView('channels')
                }
                className="md:hidden p-2 -ml-1 rounded-xl"
              >
                <ArrowLeft size={20} />
              </button>

              <Volume2
                size={18}
                style={{
                  color: COLORS.teal
                }}
              />

              <h3
                className="font-black text-[15px]"
                style={{
                  color: COLORS.ivory
                }}
              >
                {selectedChannel.name}
              </h3>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
              {voiceLoading ? (
                <div
                  className="text-sm font-bold"
                  style={{
                    color: COLORS.muted
                  }}
                >
                  Chargement des participants...
                </div>
              ) : voiceParticipants?.length ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-6">
                  {voiceParticipants.map(
                    (participant) => {
                      const profile =
                        participant.profiles;

                      const avatar =
                        profile?.avatar_url ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                          profile?.display_name ||
                            profile?.handle ||
                            participant.user_id ||
                            'user'
                        )}`;

                      return (
                        <div
                          key={`${participant.channel_id}-${participant.user_id}`}
                          className="flex flex-col items-center gap-2"
                        >
                          <div className="relative">
                            <img
                              src={avatar}
                              className={`w-20 h-20 rounded-full object-cover ${
                                participant.user_id ===
                                id
                                  ? 'ring-2 ring-emerald-400'
                                  : ''
                              }`}
                              alt=""
                            />

                            <div
                              className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2"
                              style={{
                                background:
                                  '#22c55e',
                                borderColor:
                                  COLORS.bg
                              }}
                            />
                          </div>

                          <span
                            className="text-xs font-bold max-w-[90px] truncate"
                            style={{
                              color:
                                COLORS.ivory
                            }}
                          >
                            {profile?.display_name?.split(
                              ' '
                            )[0] ||
                              profile?.handle ||
                              'Membre'}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <div
                    className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{
                      background:
                        COLORS.surface2
                    }}
                  >
                    <Volume2
                      size={30}
                      style={{
                        color: COLORS.muted
                      }}
                    />
                  </div>

                  <p
                    className="font-black"
                    style={{
                      color: COLORS.ivory
                    }}
                  >
                    Aucun participant
                  </p>

                  <p
                    className="text-xs mt-1"
                    style={{
                      color: COLORS.muted
                    }}
                  >
                    Sois le premier à rejoindre le
                    vocal.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                {!isJoined ? (
                  <button
                    onClick={async () => {
                      try {
                        await joinVoice();
                      } catch (error) {
                        setActionError(
                          error?.message ||
                            'Impossible de rejoindre le vocal.'
                        );
                      }
                    }}
                    className="px-10 py-4 rounded-full font-black flex items-center gap-3"
                    style={{
                      background: COLORS.teal,
                      color: COLORS.bg
                    }}
                  >
                    <Mic size={20} />
                    Rejoindre
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        await leaveVoice();
                      } catch (error) {
                        setActionError(
                          error?.message ||
                            'Impossible de quitter le vocal.'
                        );
                      }
                    }}
                    className="px-10 py-4 rounded-full font-black bg-red-500 text-white flex items-center gap-3"
                  >
                    <X size={20} />
                    Quitter
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* =================================================
             TEXT CHANNEL
          ================================================== */

          <>
            {/* CHAT HEADER */}

            <div
              className="h-[64px] px-4 flex items-center justify-between border-b"
              style={{
                borderColor: COLORS.border,
                background: COLORS.surface
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() =>
                    setMobileView('channels')
                  }
                  className="md:hidden p-2 -ml-1 rounded-xl"
                >
                  <ArrowLeft size={20} />
                </button>

                {(() => {
                  const Icon =
                    getChannelIcon(
                      selectedChannel
                    );

                  return (
                    <div
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`,
                        color: COLORS.bg
                      }}
                    >
                      <Icon size={16} />
                    </div>
                  );
                })()}

                <div className="min-w-0">
                  <h3
                    className="font-black text-[15px] truncate"
                    style={{
                      color: COLORS.ivory
                    }}
                  >
                    {selectedChannel.name}
                  </h3>

                  <p
                    className="text-[10px] truncate"
                    style={{
                      color: COLORS.muted
                    }}
                  >
                    {selectedChannel.topic ||
                      selectedChannel.description ||
                      'Discussion'}
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  setShowMembers(
                    (current) => !current
                  )
                }
                className="p-2.5 rounded-xl"
                style={{
                  background: showMembers
                    ? 'rgba(251,191,36,0.15)'
                    : COLORS.surface2,
                  color: showMembers
                    ? COLORS.gold
                    : COLORS.muted
                }}
                title="Afficher les membres"
              >
                <Users size={18} />
              </button>
            </div>

            {/* ACTION ERROR */}

            {actionError && (
              <div
                className="mx-4 mt-3 px-4 py-3 rounded-xl border flex items-center justify-between gap-3"
                style={{
                  background:
                    'rgba(239,68,68,0.10)',
                  borderColor:
                    'rgba(239,68,68,0.25)',
                  color: '#fca5a5'
                }}
              >
                <span className="text-xs font-bold">
                  {actionError}
                </span>

                <button
                  onClick={() =>
                    setActionError('')
                  }
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex flex-1 overflow-hidden">
              {/* =================================================
                  MESSAGE AREA
              ================================================== */}

              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                  {messages.length === 0 ? (
                    <div className="text-center py-24">
                      <div
                        className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                        style={{
                          background:
                            COLORS.surface2
                        }}
                      >
                        {(() => {
                          const Icon =
                            getChannelIcon(
                              selectedChannel
                            );

                          return (
                            <Icon
                              size={28}
                              style={{
                                color:
                                  COLORS.muted
                              }}
                            />
                          );
                        })()}
                      </div>

                      <p
                        className="font-black text-[16px] mb-1"
                        style={{
                          color:
                            COLORS.ivory
                        }}
                      >
                        Bienvenue dans{' '}
                        {selectedChannel.name}
                      </p>

                      <p
                        className="text-[13px]"
                        style={{
                          color:
                            COLORS.muted
                        }}
                      >
                        C'est le début de
                        l'histoire.
                      </p>
                    </div>
                  ) : (
                    messages.map(
                      (message, index) => {
                        const previous =
                          messages[index - 1];

                        const showAvatar =
                          !previous ||
                          previous.sender_id !==
                            message.sender_id;

                        const profile =
                          message.profiles;

                        const avatar =
                          profile?.avatar_url ||
                          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                            profile?.display_name ||
                              profile?.handle ||
                              message.sender_id ||
                              'user'
                          )}`;

                        return (
                          <div
                            key={message.id}
                            className={`flex gap-3 px-2 py-1.5 rounded-[12px] hover:bg-white/[0.03] ${
                              showAvatar
                                ? 'mt-4'
                                : ''
                            }`}
                          >
                            <div className="w-9 shrink-0">
                              {showAvatar && (
                                <img
                                  src={avatar}
                                  className="w-9 h-9 rounded-full object-cover"
                                  alt=""
                                />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              {showAvatar && (
                                <div className="flex items-baseline gap-2">
                                  <span
                                    className="text-[14px] font-black"
                                    style={{
                                      color:
                                        COLORS.ivory
                                    }}
                                  >
                                    {profile?.display_name ||
                                      'Membre'}
                                  </span>

                                  <span
                                    className="text-[11px]"
                                    style={{
                                      color:
                                        COLORS.muted
                                    }}
                                  >
                                    {message.created_at
                                      ? new Date(
                                          message.created_at
                                        ).toLocaleTimeString(
                                          'fr-FR',
                                          {
                                            hour: '2-digit',
                                            minute:
                                              '2-digit'
                                          }
                                        )
                                      : ''}
                                  </span>
                                </div>
                              )}

                              <p
                                className="text-[14.5px] leading-[22px] break-words"
                                style={{
                                  color:
                                    COLORS.ivory
                                }}
                              >
                                {message.text ||
                                  message.content}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    )
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* MESSAGE ERROR */}

                {messageError && (
                  <div
                    className="mx-3 mb-2 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between"
                    style={{
                      background:
                        'rgba(239,68,68,0.10)',
                      color: '#fca5a5'
                    }}
                  >
                    <span>{messageError}</span>

                    <button
                      onClick={() =>
                        setMessageError('')
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* MESSAGE INPUT */}

                <div
                  className="p-3 border-t"
                  style={{
                    borderColor: COLORS.border,
                    background: COLORS.surface
                  }}
                >
                  <div
                    className="flex items-end gap-2 rounded-[24px] border-2 px-2 py-2"
                    style={{
                      background:
                        COLORS.surface2,
                      borderColor:
                        COLORS.border
                    }}
                  >
                    <textarea
                      value={msgText}
                      onChange={(event) => {
                        setMsgText(
                          event.target.value
                        );

                        if (messageError) {
                          setMessageError('');
                        }
                      }}
                      onKeyDown={
                        handleMessageKeyDown
                      }
                      placeholder={`Message dans ${selectedChannel.name}`}
                      rows={1}
                      className="flex-1 bg-transparent py-2.5 text-[15px] font-medium outline-none resize-none max-h-[120px]"
                      style={{
                        color: COLORS.ivory
                      }}
                    />

                    <button
                      onClick={
                        handleSendMessage
                      }
                      disabled={
                        !msgText.trim() ||
                        sendingMessage
                      }
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-30"
                      style={{
                        background:
                          msgText.trim() &&
                          !sendingMessage
                            ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`
                            : COLORS.surface,
                        color:
                          msgText.trim() &&
                          !sendingMessage
                            ? COLORS.bg
                            : COLORS.muted
                      }}
                    >
                      {sendingMessage ? (
                        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* =================================================
                  MEMBERS PANEL
              ================================================== */}

              {showMembers && (
                <aside
                  className="hidden md:flex w-[280px] flex-col border-l shrink-0"
                  style={{
                    background:
                      COLORS.surface,
                    borderColor:
                      COLORS.border
                  }}
                >
                  <div
                    className="h-[64px] px-4 flex items-center justify-between border-b shrink-0"
                    style={{
                      borderColor:
                        COLORS.border
                    }}
                  >
                    <div>
                      <p
                        className="font-black text-[13px]"
                        style={{
                          color:
                            COLORS.ivory
                        }}
                      >
                        Membres
                      </p>

                      <p
                        className="text-[10px]"
                        style={{
                          color:
                            COLORS.muted
                        }}
                      >
                        {selectedGroup?.members
                          ?.length || 0}{' '}
                        membre
                        {(selectedGroup
                          ?.members?.length ||
                          0) > 1
                          ? 's'
                          : ''}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setShowMembers(false)
                      }
                      className="p-2 rounded-lg hover:bg-white/10"
                      style={{
                        color:
                          COLORS.muted
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    {selectedGroup?.members
                      ?.length ? (
                      <div className="space-y-1">
                        {selectedGroup.members.map(
                          (member) => {
                            const profile =
                              member.profiles;

                            const RoleIcon =
                              getRoleIcon(
                                member.role
                              );

                            const avatar =
                              profile?.avatar_url ||
                              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                profile?.display_name ||
                                  profile?.handle ||
                                  member.user_id ||
                                  'user'
                              )}`;

                            const isSelf =
                              member.user_id ===
                              id;

                            const canRemove =
                              isAdmin &&
                              !isSelf &&
                              member.role !==
                                'owner';

                            return (
                              <div
                                key={`${member.group_id}-${member.user_id}`}
                                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] group"
                              >
                                <button
                                  onClick={() =>
                                    onOpenProfile?.(
                                      member.user_id
                                    )
                                  }
                                  className="shrink-0"
                                >
                                  <img
                                    src={avatar}
                                    className="w-9 h-9 rounded-full object-cover"
                                    alt=""
                                  />
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p
                                      className="text-[12px] font-black truncate"
                                      style={{
                                        color:
                                          COLORS.ivory
                                      }}
                                    >
                                      {profile?.display_name ||
                                        profile?.handle ||
                                        'Membre'}
                                    </p>

                                    {isSelf && (
                                      <span
                                        className="text-[8px] px-1.5 py-0.5 rounded-full font-black"
                                        style={{
                                          background:
                                            'rgba(251,191,36,0.15)',
                                          color:
                                            COLORS.gold
                                        }}
                                      >
                                        TOI
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <RoleIcon
                                      size={10}
                                      style={{
                                        color:
                                          getRoleColor(
                                            member.role
                                          )
                                      }}
                                    />

                                    <span
                                      className="text-[9px] font-bold"
                                      style={{
                                        color:
                                          getRoleColor(
                                            member.role
                                          )
                                      }}
                                    >
                                      {getRoleLabel(
                                        member.role
                                      )}
                                    </span>
                                  </div>
                                </div>

                                {canRemove && (
                                  <button
                                    onClick={() =>
                                      handleRemoveMember(
                                        member
                                      )
                                    }
                                    className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-red-500/10 transition-all"
                                    style={{
                                      color:
                                        '#f87171'
                                    }}
                                    title="Retirer du groupe"
                                  >
                                    <UserMinus
                                      size={15}
                                    />
                                  </button>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-10">
                        <Users
                          size={28}
                          className="mx-auto mb-3 opacity-30"
                        />

                        <p
                          className="text-xs font-bold"
                          style={{
                            color:
                              COLORS.muted
                          }}
                        >
                          Aucun membre
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ADMIN INFO */}

                  {isAdmin && (
                    <div
                      className="p-3 border-t"
                      style={{
                        borderColor:
                          COLORS.border
                      }}
                    >
                      <button
                        onClick={() =>
                          setShowCreateChannel(
                            true
                          )
                        }
                        className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-black"
                        style={{
                          background:
                            COLORS.surface2,
                          color:
                            COLORS.muted
                        }}
                      >
                        <Plus size={14} />
                        Nouveau canal
                      </button>
                    </div>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {/* =====================================================
          MOBILE BOTTOM NAVIGATION
      ====================================================== */}

      <div
        className="flex md:hidden h-[72px] border-t items-center justify-between px-2 pb-[env(safe-area-inset-bottom)] shrink-0"
        style={{
          background: COLORS.surface,
          borderColor: COLORS.border
        }}
      >
        {[
          {
            id: 'groups',
            icon: Home,
            label: 'Groupes'
          },
          {
            id: 'channels',
            icon: MessageCircle,
            label: 'Canaux'
          },
          {
            id: 'discover',
            icon: Compass,
            label: 'Découvrir'
          },
          {
            id: 'friends',
            icon: Users,
            label: 'Amis'
          },
          {
            id: 'contacts',
            icon: Phone,
            label: 'Contacts'
          }
        ].map((tab) => {
          const Icon = tab.icon;

          const active =
            mobileView === tab.id ||
            (tab.id === 'groups' &&
              activeTab === 'groups' &&
              ![
                'discover',
                'friends',
                'contacts'
              ].includes(mobileView));

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
                className={`w-8 h-8 rounded-[10px] flex items-center justify-center transition-all ${
                  active
                    ? 'shadow-lg scale-105'
                    : ''
                }`}
                style={{
                  background: active
                    ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`
                    : 'transparent',
                  color: active
                    ? COLORS.bg
                    : COLORS.muted
                }}
              >
                <Icon size={18} />
              </div>

              <span
                className="text-[9px] font-black mt-1"
                style={{
                  color: active
                    ? COLORS.gold
                    : COLORS.muted
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* =====================================================
          CREATE GROUP MODAL
      ====================================================== */}

      {showCreateGroup && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-end md:items-center justify-center z-[100] p-0 md:p-4"
          onClick={() =>
            !creatingGroup &&
            setShowCreateGroup(false)
          }
        >
          <div
            className="w-full md:max-w-[460px] rounded-t-[32px] md:rounded-[24px] border-2 shadow-2xl p-7 max-h-[92dvh] overflow-y-auto"
            style={{
              background: COLORS.surface,
              borderColor: COLORS.border
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div
              className="w-12 h-1.5 rounded-full mx-auto mb-6 md:hidden"
              style={{
                background: COLORS.border
              }}
            />

            <div className="flex items-center justify-between mb-6">
              <h3
                className="font-black text-[20px]"
                style={{
                  color: COLORS.ivory
                }}
              >
                Créer un groupe
              </h3>

              <button
                onClick={() =>
                  setShowCreateGroup(false)
                }
                disabled={creatingGroup}
                className="p-2 rounded-xl hover:bg-white/10"
                style={{
                  color: COLORS.muted
                }}
              >
                <X size={18} />
              </button>
            </div>

            <input
              value={newGroup.name}
              onChange={(event) =>
                setNewGroup({
                  ...newGroup,
                  name: event.target.value
                })
              }
              placeholder="Nom du groupe"
              className="w-full p-4 rounded-[14px] mb-3 text-[15px] font-bold outline-none border-2"
              style={{
                background: COLORS.surface2,
                borderColor: COLORS.border,
                color: COLORS.ivory
              }}
              autoFocus
            />

            <textarea
              value={newGroup.description}
              onChange={(event) =>
                setNewGroup({
                  ...newGroup,
                  description:
                    event.target.value
                })
              }
              placeholder="Description"
              rows={3}
              className="w-full p-4 rounded-[14px] mb-4 text-[14px] outline-none border-2 resize-none"
              style={{
                background: COLORS.surface2,
                borderColor: COLORS.border,
                color: COLORS.ivory
              }}
            />

            <div className="mb-5">
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{
                  color: COLORS.muted
                }}
              >
                Visibilité
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setNewGroup({
                      ...newGroup,
                      is_public: true
                    })
                  }
                  className="flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black"
                  style={{
                    background:
                      newGroup.is_public
                        ? 'rgba(20,184,166,0.15)'
                        : COLORS.surface2,
                    borderColor:
                      newGroup.is_public
                        ? COLORS.teal
                        : COLORS.border,
                    color:
                      newGroup.is_public
                        ? COLORS.teal
                        : COLORS.muted
                  }}
                >
                  <Globe size={15} />
                  Public
                </button>

                <button
                  onClick={() =>
                    setNewGroup({
                      ...newGroup,
                      is_public: false
                    })
                  }
                  className="flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 text-xs font-black"
                  style={{
                    background:
                      !newGroup.is_public
                        ? 'rgba(251,191,36,0.15)'
                        : COLORS.surface2,
                    borderColor:
                      !newGroup.is_public
                        ? COLORS.gold
                        : COLORS.border,
                    color:
                      !newGroup.is_public
                        ? COLORS.gold
                        : COLORS.muted
                  }}
                >
                  <Lock size={15} />
                  Privé
                </button>
              </div>
            </div>

            <p
              className="text-[10px] font-black uppercase tracking-widest mb-2"
              style={{
                color: COLORS.muted
              }}
            >
              Catégorie
            </p>

            <div className="flex gap-2 flex-wrap mb-6">
              {CATEGORIES.slice(1).map(
                (category) => {
                  const Icon = category.icon;

                  const active =
                    newGroup.category ===
                    category.id;

                  return (
                    <button
                      key={category.id}
                      onClick={() =>
                        setNewGroup({
                          ...newGroup,
                          category:
                            category.id
                        })
                      }
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-black border-2 ${
                        active
                          ? 'scale-105 shadow'
                          : ''
                      }`}
                      style={{
                        background: active
                          ? COLORS.gold
                          : COLORS.surface2,
                        color: active
                          ? COLORS.bg
                          : COLORS.muted,
                        borderColor: active
                          ? COLORS.gold
                          : COLORS.border
                      }}
                    >
                      <Icon size={14} />
                      {category.label}
                    </button>
                  );
                }
              )}
            </div>

            {actionError && (
              <div
                className="mb-4 px-3 py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background:
                    'rgba(239,68,68,0.10)',
                  color: '#fca5a5'
                }}
              >
                {actionError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setShowCreateGroup(false)
                }
                disabled={creatingGroup}
                className="flex-1 py-4 rounded-[14px] font-black disabled:opacity-50"
                style={{
                  background: COLORS.surface2,
                  color: COLORS.muted
                }}
              >
                Annuler
              </button>

              <button
                onClick={handleCreateGroup}
                disabled={
                  !newGroup.name.trim() ||
                  creatingGroup
                }
                className="flex-1 py-4 rounded-[14px] font-black disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`,
                  color: COLORS.bg
                }}
              >
                {creatingGroup ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Créer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          CREATE CHANNEL MODAL
      ====================================================== */}

      {showCreateChannel && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-end md:items-center justify-center z-[100] p-0 md:p-4"
          onClick={() =>
            !creatingChannel &&
            setShowCreateChannel(false)
          }
        >
          <div
            className="w-full md:max-w-[400px] rounded-t-[32px] md:rounded-[24px] border-2 shadow-2xl p-7"
            style={{
              background: COLORS.surface,
              borderColor: COLORS.border
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="flex items-center justify-between mb-6">
              <h3
                className="font-black text-[18px]"
                style={{
                  color: COLORS.ivory
                }}
              >
                Nouveau canal
              </h3>

              <button
                onClick={() =>
                  setShowCreateChannel(false)
                }
                disabled={creatingChannel}
                className="p-2 rounded-xl hover:bg-white/10"
                style={{
                  color: COLORS.muted
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p
              className="text-xs mb-4"
              style={{
                color: COLORS.muted
              }}
            >
              Dans{' '}
              <strong
                style={{
                  color: COLORS.ivory
                }}
              >
                {selectedGroup?.name}
              </strong>
            </p>

            <input
              value={newChannel.name}
              onChange={(event) =>
                setNewChannel({
                  ...newChannel,
                  name: event.target.value
                })
              }
              placeholder="nom-du-canal"
              className="w-full p-4 rounded-[14px] mb-3 text-[15px] font-bold outline-none border-2"
              style={{
                background: COLORS.surface2,
                borderColor: COLORS.border,
                color: COLORS.ivory
              }}
              autoFocus
            />

            <input
              value={newChannel.topic}
              onChange={(event) =>
                setNewChannel({
                  ...newChannel,
                  topic: event.target.value
                })
              }
              placeholder="Sujet ou description du canal"
              className="w-full p-4 rounded-[14px] mb-4 text-[14px] outline-none border-2"
              style={{
                background: COLORS.surface2,
                borderColor: COLORS.border,
                color: COLORS.ivory
              }}
            />

            <div className="flex gap-3 mb-6">
              <button
                onClick={() =>
                  setNewChannel({
                    ...newChannel,
                    type: 'text'
                  })
                }
                className="flex-1 py-3.5 rounded-[14px] font-black flex items-center justify-center gap-2 border-2"
                style={{
                  background:
                    newChannel.type ===
                    'text'
                      ? COLORS.gold
                      : COLORS.surface2,
                  color:
                    newChannel.type ===
                    'text'
                      ? COLORS.bg
                      : COLORS.muted,
                  borderColor:
                    newChannel.type ===
                    'text'
                      ? COLORS.gold
                      : COLORS.border
                }}
              >
                <MessageSquare
                  size={16}
                />
                Texte
              </button>

              <button
                onClick={() =>
                  setNewChannel({
                    ...newChannel,
                    type: 'voice'
                  })
                }
                className="flex-1 py-3.5 rounded-[14px] font-black flex items-center justify-center gap-2 border-2"
                style={{
                  background:
                    newChannel.type ===
                    'voice'
                      ? COLORS.teal
                      : COLORS.surface2,
                  color:
                    newChannel.type ===
                    'voice'
                      ? COLORS.bg
                      : COLORS.muted,
                  borderColor:
                    newChannel.type ===
                    'voice'
                      ? COLORS.teal
                      : COLORS.border
                }}
              >
                <Volume2 size={16} />
                Vocal
              </button>
            </div>

            {actionError && (
              <div
                className="mb-4 px-3 py-2.5 rounded-xl text-xs font-bold"
                style={{
                  background:
                    'rgba(239,68,68,0.10)',
                  color: '#fca5a5'
                }}
              >
                {actionError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setShowCreateChannel(false)
                }
                disabled={creatingChannel}
                className="flex-1 py-4 rounded-[14px] font-black disabled:opacity-50"
                style={{
                  background: COLORS.surface2,
                  color: COLORS.muted
                }}
              >
                Annuler
              </button>

              <button
                onClick={handleCreateChannel}
                disabled={
                  !newChannel.name.trim() ||
                  creatingChannel
                }
                className="flex-1 py-4 rounded-[14px] font-black disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: COLORS.gold,
                  color: COLORS.bg
                }}
              >
                {creatingChannel ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Créer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
