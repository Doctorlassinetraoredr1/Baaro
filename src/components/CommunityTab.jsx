import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Hash, Mic, Send, Plus, Users, Search, Lock,
  Crown, Pin, Settings, Volume2, Compass, Sparkles, Globe, Flame, Smile, FileText, X, ArrowLeft, Home, MessageCircle, Heart, Bell, Zap, Coffee, Gamepad2, Briefcase, Code2, BookOpen, Music, MessageSquare
} from 'lucide-react';
import { useCommunity, useChannelMessages, useVoiceChannel, useCurrentUser } from '../hooks/useCommunity';
import FollowButton from '../features/friends/FollowButton.jsx';
import { FriendsTab, FriendRequests } from '../features/friends/index.js';
import { COLORS } from '../theme.js';

const CATEGORIES = [
  { id: 'all', label: 'Tous', icon: Compass, color: '#f59e0b', gradient: 'from-amber-400 to-orange-500', bg: 'rgba(245,158,11,0.15)' },
  { id: 'community', label: 'Communauté', icon: Globe, color: '#06b6d4', gradient: 'from-cyan-500 to-blue-500', bg: 'rgba(6,182,214,0.15)', emoji: '🌍' },
  { id: 'business', label: 'Business', icon: Briefcase, color: '#3b82f6', gradient: 'from-blue-500 to-cyan-500', bg: 'rgba(59,130,246,0.15)', emoji: '💼' },
  { id: 'tech', label: 'Tech', icon: Code2, color: '#10b981', gradient: 'from-emerald-500 to-teal-500', bg: 'rgba(16,185,129,0.15)', emoji: '💻' },
  { id: 'etudes', label: 'Études', icon: BookOpen, color: '#8b5cf6', gradient: 'from-violet-500 to-purple-500', bg: 'rgba(139,92,246,0.15)', emoji: '📚' },
  { id: 'divertissement', label: 'Fun', icon: Gamepad2, color: '#ec4899', gradient: 'from-pink-500 to-rose-500', bg: 'rgba(236,72,153,0.15)', emoji: '🎮' },
];

const getCategoryConfig = (catId) => {
  return CATEGORIES.find(c => c.id === catId) || CATEGORIES[0];
};

// Icônes attractives pour les salons au lieu de #
const getChannelIcon = (channel) => {
  const name = (channel.name || '').toLowerCase();
  if (channel.type === 'voice') return Volume2;
  if (name.includes('general') || name.includes('général')) return MessageCircle;
  if (name.includes('annonce') || name.includes('news')) return Bell;
  if (name.includes('business') || name.includes('startup')) return Briefcase;
  if (name.includes('tech') || name.includes('code')) return Code2;
  if (name.includes('etude') || name.includes('study')) return BookOpen;
  if (name.includes('fun') || name.includes('game') || name.includes('meme')) return Gamepad2;
  if (name.includes('music') || name.includes('vocal') || name.includes('chill')) return Music;
  if (name.includes('café') || name.includes('cafe') || name.includes('chill')) return Coffee;
  return MessageSquare;
};

const getChannelColor = (channel, isActive) => {
  if (isActive) return `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`;
  const name = (channel.name || '').toLowerCase();
  if (name.includes('general')) return 'rgba(251,191,36,0.15)';
  if (name.includes('annonce')) return 'rgba(239,68,68,0.15)';
  if (name.includes('business')) return 'rgba(59,130,246,0.15)';
  if (name.includes('tech')) return 'rgba(16,185,129,0.15)';
  return COLORS.surface2;
};

const getGroupIcon = (group) => {
  const cat = getCategoryConfig(group.category);
  return cat.icon;
};

const getGroupGradient = (group) => {
  const cat = getCategoryConfig(group.category);
  return cat.gradient;
};

const getGroupBg = (group) => {
  const cat = getCategoryConfig(group.category);
  return cat.bg;
};


export default function CommunityTab({ onOpenProfile }) {
  const { id } = useCurrentUser();
  const { friends, allUsers, groups, createGroup, createChannel, banMember, loading, loadUsers } = useCommunity();
  
  const [activeTab, setActiveTab] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', is_public: true, category: 'community', type: 'community' });
  const [newChannel, setNewChannel] = useState({ name: '', type: 'text', topic: '' });
  const [search, setSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showMembers, setShowMembers] = useState(true);
  const [mobileView, setMobileView] = useState('groups');

  const { messages, sendMessage } = useChannelMessages(selectedChannel?.id) || { messages: [], sendMessage: ()=>{} };
  const { participants: voiceParticipants, isJoined, joinVoice, leaveVoice } = useVoiceChannel(selectedChannel?.id);
  const [msgText, setMsgText] = useState('');
  const messagesEndRef = useRef(null);

  const myRole = useMemo(() => selectedGroup?.members?.find(m => m.user_id === id)?.role || 'member', [selectedGroup, id]);
  const isAdmin = ['owner', 'admin'].includes(myRole);

  useEffect(() => { if (!selectedGroup && groups.length > 0) { setSelectedGroup(groups[0]); setSelectedChannel(groups[0].channels?.[0] || null); } }, [groups, selectedGroup]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (search.trim().length >= 2) loadUsers?.(search.trim()); }, [search]);

  // Filtres internationaux optionnels - pas de Bamako forcé
  const [selectedCountry, setSelectedCountry] = useState('all');
  const [selectedLanguage, setSelectedLanguage] = useState('all');

  // Extraire pays et langues uniques depuis les profils (international)
  const availableCountries = useMemo(() => {
    const countries = [...new Set(allUsers.map(u => u.country).filter(Boolean))].sort();
    return countries.slice(0, 20); // limiter pour UI
  }, [allUsers]);

  const availableLanguages = useMemo(() => {
    const langs = [...new Set(allUsers.map(u => u.language).filter(Boolean))].sort();
    return langs.length ? langs : ['fr', 'en', 'ar', 'es']; // fallback international
  }, [allUsers]);

  const filteredGroups = useMemo(() => groups.filter(g => {
    const ms = !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()) || (g.description||'').toLowerCase().includes(groupSearch.toLowerCase());
    const mc = selectedCategory === 'all' || (g.category || 'community') === selectedCategory;
    return ms && mc;
  }), [groups, groupSearch, selectedCategory]);

  const searchedGroups = useMemo(() => { if (!search) return []; const s = search.toLowerCase(); return groups.filter(g => g.name.toLowerCase().includes(s) || (g.description||'').toLowerCase().includes(s)); }, [groups, search]);
  
  const filteredUsersForDiscover = useMemo(() => {
    return allUsers.filter(u => {
      const matchCountry = selectedCountry === 'all' || u.country === selectedCountry;
      const matchLang = selectedLanguage === 'all' || u.language === selectedLanguage;
      return matchCountry && matchLang;
    });
  }, [allUsers, selectedCountry, selectedLanguage]);

  const searchedUsers = useMemo(() => { 
    if (!search) return []; 
    const s = search.toLowerCase(); 
    return filteredUsersForDiscover.filter(u => (u.display_name||'').toLowerCase().includes(s) || (u.handle||'').toLowerCase().includes(s)); 
  }, [filteredUsersForDiscover, search]);

  const textChannels = useMemo(() => selectedGroup?.channels?.filter(c => c.type !== 'voice') || [], [selectedGroup]);
  const voiceChannels = useMemo(() => selectedGroup?.channels?.filter(c => c.type === 'voice') || [], [selectedGroup]);

  const handleSelectGroup = (g) => { setSelectedGroup(g); setSelectedChannel(g.channels?.[0] || null); setActiveTab('groups'); setMobileView('channels'); };
  const handleSelectChannel = (ch) => { setSelectedChannel(ch); setMobileView('chat'); };
  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) return;
    try {
      const payload = { name: newGroup.name.trim(), description: newGroup.description?.trim() || null, is_public: !!newGroup.is_public, category: newGroup.category || 'bamako', type: 'community' };
      const g = await createGroup(payload);
      setShowCreateGroup(false); setNewGroup({ name: '', description: '', is_public: true, category: 'community', type: 'community' });
      if (g) { setSelectedGroup(g); setSelectedChannel(g.channels?.[0] || null); setMobileView('channels'); }
    } catch (e) { alert('Erreur: ' + (e.message||'')); }
  };
  const handleCreateChannel = async () => {
    if (!newChannel.name.trim() || !selectedGroup) return;
    try {
      const ch = await createChannel(selectedGroup.id, { name: newChannel.name.trim(), type: newChannel.type, description: newChannel.topic });
      setShowCreateChannel(false); setNewChannel({ name: '', type: 'text', topic: '' });
      if (ch) { setSelectedChannel(ch); setMobileView('chat'); }
    } catch (e) { alert('Erreur: ' + (e.message||'')); }
  };
  const handleSendMessage = () => { if (!msgText.trim()) return; sendMessage(msgText); setMsgText(''); };

  if (loading) return <div className="flex h-[100dvh] items-center justify-center" style={{ background: COLORS.bg }}><div className="flex flex-col items-center gap-3"><div className="w-14 h-14 rounded-[18px] animate-pulse" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` }} /><p className="text-xs font-bold tracking-widest uppercase" style={{ color: COLORS.muted }}>Communauté</p></div></div>;

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] md:h-[calc(100vh-70px)] w-full overflow-hidden select-none" style={{ background: COLORS.bg, color: COLORS.ivory }}>
      {/* RAIL DESKTOP - Plus de doublon découvrir */}
      <div className="hidden md:flex w-[80px] flex-col items-center py-4 gap-3 border-r shrink-0 overflow-y-auto scrollbar-none" style={{ background: `linear-gradient(180deg, ${COLORS.surface} 0%, #0f0f0f 100%)`, borderColor: COLORS.border }}>
        <button onClick={()=>{ setActiveTab('discover'); setMobileView('discover'); }} className={`w-[52px] h-[52px] rounded-[18px] flex items-center justify-center transition-all duration-300 hover:rounded-[14px] hover:scale-105 ${activeTab==='discover' ? 'rounded-[14px] scale-105 shadow-lg shadow-amber-500/20' : ''}`} style={{ background: activeTab==='discover' ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface2, color: activeTab==='discover' ? COLORS.bg : COLORS.teal }}><Compass size={24} /></button>
        <div className="w-8 h-[3px] rounded-full opacity-30 my-1" style={{ background: COLORS.border }} />
        {groups.slice(0,15).map(g => {
          const sel = selectedGroup?.id === g.id && activeTab !== 'discover' && activeTab !== 'friends';
          return (
            <div key={g.id} className="relative group/rail">
              {sel && <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-[4px] h-8 rounded-r-full" style={{ background: COLORS.gold }} />}
              <button onClick={()=>handleSelectGroup(g)} className={`w-[52px] h-[52px] rounded-[18px] font-black text-[18px] flex items-center justify-center relative transition-all duration-300 hover:rounded-[14px] hover:scale-105 ${sel ? 'rounded-[14px] shadow-lg shadow-amber-500/20' : ''}`} style={{ background: sel ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface2, color: sel ? COLORS.bg : COLORS.muted }}>
                {g.avatar_url ? <img src={g.avatar_url} className="w-full h-full rounded-[inherit] object-cover" alt="" /> : g.name[0]?.toUpperCase()}
                {!g.is_public && <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-black border-2 flex items-center justify-center" style={{ borderColor: COLORS.surface }}><Lock size={10} /></div>}
              </button>
              {g.is_boosted && <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow"><Sparkles size={10} className="text-black" /></div>}
            </div>
          );
        })}
        <button onClick={()=>setShowCreateGroup(true)} className="w-[52px] h-[52px] rounded-[18px] flex items-center justify-center border-2 border-dashed mt-2 hover:rounded-[14px] hover:border-solid transition-all group/btn" style={{ borderColor: COLORS.border, color: COLORS.teal }}><Plus size={22} className="group-hover/btn:rotate-90 transition-transform duration-300" /></button>
      </div>

      <div className={`${mobileView==='chat' ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] flex-col border-r shrink-0`} style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <div className="h-[64px] px-4 flex items-center justify-between border-b shrink-0" style={{ borderColor: COLORS.border, background: `linear-gradient(90deg, ${COLORS.surface} 0%, ${COLORS.surface2} 100%)` }}>
          <div className="flex items-center gap-3 min-w-0">
            {mobileView!=='groups' && <button onClick={()=>setMobileView('groups')} className="md:hidden p-2 -ml-2 rounded-xl hover:bg-white/10" style={{ color: COLORS.ivory }}><ArrowLeft size={20} /></button>}
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center font-black text-[16px] shrink-0" style={{ background: selectedGroup ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface2, color: selectedGroup ? COLORS.bg : COLORS.muted }}>{selectedGroup ? (selectedGroup.avatar_url ? <img src={selectedGroup.avatar_url} className="w-full h-full rounded-[12px] object-cover" alt="" /> : selectedGroup.name[0]?.toUpperCase()) : <Home size={18} />}</div>
            <div className="min-w-0"><h2 className="font-black text-[15px] truncate tracking-tight" style={{ color: COLORS.ivory }}>{activeTab==='discover' ? 'Découvrir' : activeTab==='friends' ? 'Amis' : selectedGroup?.name || 'Communautés'}</h2><p className="text-[11px] truncate flex items-center gap-1" style={{ color: COLORS.muted }}>{selectedGroup ? <><Users size={10} /> {selectedGroup.members?.length||0} membres</> : `${groups.length} groupes`}</p></div>
          </div>
          <button onClick={()=>setShowCreateGroup(true)} className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: COLORS.gold, color: COLORS.bg }}><Plus size={18} /></button>
        </div>

        {/* TABS SIMPLIFIÉS - Plus de doublon découvrir */}
        <div className="flex gap-1 p-2 border-b shrink-0" style={{ borderColor: COLORS.border }}>
          {[{id:'groups', label:'Salons', icon: MessageCircle},{id:'friends', label:'Amis', icon: Heart}].map(tab => {
            const Icon = tab.icon; const active = activeTab===tab.id && mobileView!=='discover';
            return <button key={tab.id} onClick={()=>{ setActiveTab(tab.id); setMobileView(tab.id); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[12px] text-[11px] font-black uppercase tracking-wider ${active ? 'shadow-md' : ''}`} style={{ background: active ? COLORS.gold : 'transparent', color: active ? COLORS.bg : COLORS.muted }}><Icon size={14} /> {tab.label}</button>;
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          {(mobileView==='groups' || mobileView==='channels' || activeTab==='groups') && activeTab!=='discover' && activeTab!=='friends' && (
            <div className="p-3 space-y-5">
              <div className={`${mobileView==='channels' ? 'hidden md:block' : 'block'} space-y-3`}>
                <div className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} /><input value={groupSearch} onChange={e=>setGroupSearch(e.target.value)} placeholder="Filtrer les groupes..." className="w-full pl-10 pr-3 py-3 rounded-[14px] text-[14px] font-medium outline-none border focus:border-amber-400/50" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} /></div>
                <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">{CATEGORIES.map(cat => { 
                  const active = selectedCategory===cat.id; 
                  const Icon = cat.icon; 
                  return (
                    <button key={cat.id} onClick={()=>setSelectedCategory(cat.id)} className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-[11px] font-black whitespace-nowrap transition-all border ${active?'scale-105 shadow-lg' : 'hover:scale-102'}`} style={{ background: active ? `linear-gradient(135deg, ${cat.color}, ${cat.color}dd)` : cat.bg, color: active ? 'white' : cat.color, borderColor: active ? cat.color : 'transparent' }}>
                      <Icon size={13} /> {cat.label}
                      {active && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                    </button>
                  ); 
                })}</div>
                <div className="space-y-1.5">{filteredGroups.map(g => { 
                  const sel = selectedGroup?.id===g.id; 
                  const cat = getCategoryConfig(g.category);
                  const CatIcon = cat.icon;
                  return (
                    <button key={g.id} onClick={()=>handleSelectGroup(g)} className={`w-full flex items-center gap-3 p-3 rounded-[16px] text-left border-2 transition-all hover:scale-[1.01] group ${sel ? 'shadow-lg' : ''}`} style={{ background: sel ? COLORS.surface2 : 'transparent', borderColor: sel ? cat.color : 'transparent' }}>
                      <div className="w-12 h-12 rounded-[14px] flex items-center justify-center font-black text-[16px] shrink-0 overflow-hidden shadow-lg relative" style={{ background: g.avatar_url ? 'transparent' : `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)` , color: 'white' }}>
                        {g.avatar_url ? <img src={g.avatar_url} className="w-full h-full object-cover" alt="" /> : <CatIcon size={20} />}
                        {g.is_boosted && <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center"><Sparkles size={8} className="text-black" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[14px] font-black truncate" style={{ color: COLORS.ivory }}>{g.name}</p>
                          {!g.is_public && <Lock size={10} style={{ color: COLORS.muted }} />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: cat.bg, color: cat.color }}><CatIcon size={10} /> {cat.label}</span>
                          <span className="text-[11px] font-medium" style={{ color: COLORS.muted }}>{g.members?.length||0} membres</span>
                        </div>
                      </div>
                      {sel && <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: cat.color }} />}
                    </button>
                  ); 
                })}</div>
              </div>
              <div className={`${mobileView==='groups' ? 'hidden md:block' : 'block'} space-y-5`}>
                {selectedGroup ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between px-1 mb-2">
                        <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: COLORS.muted }}><MessageSquare size={12} /> Salons Texte — {textChannels.length}</p>
                        {isAdmin && <button onClick={()=>setShowCreateChannel(true)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: COLORS.muted }}><Plus size={14} /></button>}
                      </div>
                      <div className="space-y-1">
                        {textChannels.map(ch => { 
                          const a = selectedChannel?.id===ch.id; 
                          const Icon = getChannelIcon(ch);
                          return (
                            <button key={ch.id} onClick={()=>handleSelectChannel(ch)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left group transition-all hover:scale-[1.01] ${a ? 'shadow-md' : ''}`} style={{ background: a ? 'rgba(251,191,36,0.15)' : 'transparent', border: `1px solid ${a ? 'rgba(251,191,36,0.3)' : 'transparent'}`, color: a ? COLORS.gold : COLORS.muted }}>
                              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 transition-all" style={{ background: getChannelColor(ch, a), color: a ? COLORS.gold : COLORS.muted }}>
                                <Icon size={16} />
                              </div>
                              <span className={`text-[13.5px] font-bold truncate ${a ? 'text-amber-400' : ''}`}>{ch.name}</span>
                              {a && <div className="ml-auto w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                            </button>
                          ); 
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest px-1 mb-2 flex items-center gap-1.5" style={{ color: COLORS.muted }}><Volume2 size={12} /> Vocaux — {voiceChannels.length}</p>
                      <div className="space-y-1">
                        {voiceChannels.map(ch => {
                          const Icon = getChannelIcon(ch);
                          const a = selectedChannel?.id===ch.id;
                          return (
                            <button key={ch.id} onClick={()=>handleSelectChannel(ch)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left hover:bg-white/5 transition-all" style={{ background: a ? 'rgba(20,184,166,0.1)' : 'transparent', color: a ? COLORS.teal : COLORS.muted }}>
                              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: a ? 'rgba(20,184,166,0.2)' : COLORS.surface2 }}>
                                <Icon size={16} />
                              </div>
                              <span className="text-[13.5px] font-bold">{ch.name}</span>
                              <div className="ml-auto flex -space-x-1">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
          {(mobileView==='discover' || activeTab==='discover') && (
            <div className="p-4 space-y-6">
              <div className="relative"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Groupes, @amis..." className="w-full pl-12 pr-4 py-4 rounded-[16px] text-[15px] font-medium outline-none border-2" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} /></div>
              {!search ? (
                <>
                  <div className="space-y-3"><p className="text-[12px] font-black uppercase tracking-widest flex items-center gap-2" style={{ color: COLORS.ivory }}><Flame size={14} className="text-orange-500" /> Groupes populaires</p>{groups.slice(0,5).map(g => {
                    const cat = getCategoryConfig(g.category);
                    const CatIcon = cat.icon;
                    return (
                      <div key={g.id} onClick={()=>handleSelectGroup(g)} className="p-4 rounded-[20px] border-2 flex gap-4 cursor-pointer hover:scale-[1.02] transition-all group" style={{ background: COLORS.surface2, borderColor: COLORS.border }}>
                        <div className="w-14 h-14 rounded-[16px] flex items-center justify-center font-black text-[18px] shrink-0 shadow-lg relative overflow-hidden" style={{ background: g.avatar_url ? 'transparent' : `linear-gradient(135deg, ${cat.color}, ${cat.color}dd)` }}>
                          {g.avatar_url ? <img src={g.avatar_url} className="w-full h-full object-cover" alt="" /> : <CatIcon size={24} className="text-white" />}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-black text-[15px] truncate" style={{ color: COLORS.ivory }}>{g.name}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1" style={{ background: cat.bg, color: cat.color }}><CatIcon size={10} /> {cat.label}</span>
                          </div>
                          <p className="text-[12px] line-clamp-2" style={{ color: COLORS.muted }}>{g.description||'Communauté Baaro • ' + (g.members?.length||0) + ' membres'}</p>
                        </div>
                      </div>
                    );
                  })}</div>
                  <div className="space-y-3"><p className="text-[12px] font-black uppercase tracking-widest" style={{ color: COLORS.ivory }}>Nouveaux membres</p><div className="space-y-2">{allUsers.slice(0,6).map(u => <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-[16px] border" style={{ background: COLORS.surface2, borderColor: COLORS.border }}><div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={()=>onOpenProfile?.(u.id)}><img src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.display_name}`} className="w-11 h-11 rounded-full" alt="" /><div className="min-w-0"><p className="text-[14px] font-black truncate" style={{ color: COLORS.ivory }}>{u.display_name}</p><p className="text-[11px] truncate" style={{ color: COLORS.muted }}>@{u.handle||'user'}</p></div></div>{id && u.id!==id && <FollowButton targetId={u.id} />}</div>)}</div></div>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2"><p className="text-[11px] font-black uppercase" style={{ color: COLORS.muted }}>Groupes • {searchedGroups.length}</p>{searchedGroups.slice(0,6).map(g => <div key={g.id} onClick={()=>handleSelectGroup(g)} className="p-3 rounded-[16px] border flex gap-3 cursor-pointer" style={{ background: COLORS.surface2, borderColor: COLORS.border }}><div className="w-12 h-12 rounded-xl flex items-center justify-center font-black" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` }}>{g.name[0]}</div><div className="flex-1 min-w-0"><p className="font-black text-[14px]" style={{ color: COLORS.ivory }}>{g.name}</p><p className="text-[12px]" style={{ color: COLORS.muted }}>{g.description||''}</p></div></div>)}</div>
                  <div className="space-y-2"><p className="text-[11px] font-black uppercase" style={{ color: COLORS.muted }}>Personnes • {searchedUsers.length}</p>{searchedUsers.slice(0,8).map(u => <div key={u.id} className="flex items-center justify-between gap-2 p-3 rounded-[16px] border" style={{ background: COLORS.surface2, borderColor: COLORS.border }}><div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={()=>onOpenProfile?.(u.id)}><img src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.display_name}`} className="w-11 h-11 rounded-full" alt="" /><div className="min-w-0"><p className="text-[14px] font-black truncate" style={{ color: COLORS.ivory }}>{u.display_name}</p><p className="text-[11px]" style={{ color: COLORS.muted }}>@{u.handle||'user'}</p></div></div>{id && u.id!==id && <FollowButton targetId={u.id} />}</div>)}</div>
                </div>
              )}
            </div>
          )}
          {(mobileView==='friends' || activeTab==='friends') && (<div className="p-3 space-y-4"><FriendRequests onOpenProfile={onOpenProfile} /><div className="h-[1px]" style={{ background: COLORS.border }} /><FriendsTab onOpenProfile={onOpenProfile} /></div>)}
        </div>
      </div>

      <div className={`${mobileView==='chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`} style={{ background: COLORS.bg }}>
        {!selectedChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center" style={{ color: COLORS.muted }}>
            <div className="w-24 h-24 rounded-[28px] flex items-center justify-center mb-6" style={{ background: COLORS.surface2 }}><MessageCircle size={36} className="opacity-20" /></div>
            <h3 className="font-black text-[20px] mb-2" style={{ color: COLORS.ivory }}>Bienvenue</h3><p className="text-[14px] max-w-[320px]">Sélectionne un salon pour discuter.</p>
            <button onClick={()=>setMobileView('groups')} className="md:hidden mt-6 px-6 py-3 rounded-full font-black text-[13px]" style={{ background: COLORS.gold, color: COLORS.bg }}>Voir les groupes</button>
          </div>
        ) : selectedChannel.type==='voice' ? (
          <div className="flex-1 flex flex-col"><div className="h-[64px] px-4 flex items-center gap-3 border-b" style={{ borderColor: COLORS.border }}><button onClick={()=>setMobileView('channels')} className="md:hidden p-2 -ml-1 rounded-xl"><ArrowLeft size={20} /></button><Volume2 size={18} style={{ color: COLORS.teal }} /><h3 className="font-black text-[15px]" style={{ color: COLORS.ivory }}>{selectedChannel.name}</h3></div><div className="flex-1 flex flex-col items-center justify-center p-8 gap-8"><div className="grid grid-cols-3 gap-6">{(voiceParticipants||[]).map(p => <div key={p.user_id} className="flex flex-col items-center gap-2"><img src={p.avatar_url} className="w-20 h-20 rounded-full" alt="" /><span className="text-xs font-bold" style={{ color: COLORS.ivory }}>{p.display_name?.split(' ')[0]}</span></div>)}</div><div className="flex gap-3">{!isJoined ? <button onClick={joinVoice} className="px-10 py-4 rounded-full font-black flex items-center gap-3" style={{ background: COLORS.teal, color: COLORS.bg }}><Mic size={20} /> Rejoindre</button> : <button onClick={leaveVoice} className="px-10 py-4 rounded-full font-black bg-red-500 text-white flex items-center gap-3"><X size={20} /> Quitter</button>}</div></div></div>
        ) : (
          <>
            <div className="h-[64px] px-4 flex items-center justify-between border-b" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={()=>setMobileView('channels')} className="md:hidden p-2 -ml-1 rounded-xl"><ArrowLeft size={20} /></button>
                {(() => { const Icon = getChannelIcon(selectedChannel); return <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`, color: COLORS.bg }}><Icon size={16} /></div>; })()}
                <h3 className="font-black text-[15px] truncate" style={{ color: COLORS.ivory }}>{selectedChannel.name}</h3>
                <span className="text-[11px] px-2 py-1 rounded-full font-bold" style={{ background: COLORS.surface2, color: COLORS.muted }}>{selectedChannel.topic || selectedChannel.description || 'Discussion'}</span>
              </div>
              <button onClick={()=>setShowMembers(!showMembers)} className="p-2.5 rounded-xl" style={{ background: COLORS.surface2, color: COLORS.muted }}><Users size={18} /></button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-1">{messages.length===0 ? <div className="text-center py-24"><div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: COLORS.surface2 }}>{(() => { const Icon = getChannelIcon(selectedChannel); return <Icon size={28} style={{ color: COLORS.muted }} />; })()}</div><p className="font-black text-[16px] mb-1" style={{ color: COLORS.ivory }}>Bienvenue dans {selectedChannel.name}</p><p className="text-[13px]" style={{ color: COLORS.muted }}>C'est le début de l'histoire.</p></div> : messages.map((m, idx) => { const prev = messages[idx-1]; const showAvatar = !prev || prev.sender_id !== m.sender_id; return <div key={m.id} className={`flex gap-3 px-2 py-1.5 rounded-[12px] hover:bg-white/[0.03] ${showAvatar ? 'mt-4' : ''}`}><div className="w-9 shrink-0">{showAvatar && <img src={m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.profiles?.display_name}`} className="w-9 h-9 rounded-full" alt="" />}</div><div className="flex-1 min-w-0">{showAvatar && <div className="flex items-baseline gap-2"><span className="text-[14px] font-black" style={{ color: COLORS.ivory }}>{m.profiles?.display_name || 'Membre'}</span><span className="text-[11px]" style={{ color: COLORS.muted }}>{new Date(m.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span></div>}<p className="text-[14.5px] leading-[22px] break-words" style={{ color: COLORS.ivory }}>{m.text || m.content}</p></div></div>; })}<div ref={messagesEndRef} /></div>
                <div className="p-3 border-t" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
                  <div className="flex items-end gap-2 rounded-[24px] border-2 px-2 py-2" style={{ background: COLORS.surface2, borderColor: COLORS.border }}>
                    <textarea value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && !e.shiftKey){e.preventDefault(); handleSendMessage();}}} placeholder={`Message dans ${selectedChannel.name}`} rows={1} className="flex-1 bg-transparent py-2.5 text-[15px] font-medium outline-none resize-none max-h-[120px]" style={{ color: COLORS.ivory }} />
                    <button onClick={handleSendMessage} disabled={!msgText.trim()} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 disabled:opacity-30" style={{ background: msgText.trim() ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface, color: msgText.trim() ? COLORS.bg : COLORS.muted }}><Send size={16} /></button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MOBILE BOTTOM - Plus de doublon, 4 items seulement */}
      <div className="flex md:hidden h-[72px] border-t items-center justify-around px-1 pb-[env(safe-area-inset-bottom)] shrink-0" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        {[{id:'groups', icon: Home, label: 'Groupes'},{id:'channels', icon: MessageCircle, label: 'Salons'},{id:'discover', icon: Compass, label: 'Découvrir'},{id:'friends', icon: Users, label: 'Amis'}].map(tab => { const Icon = tab.icon; const active = mobileView===tab.id || (tab.id==='groups' && activeTab==='groups' && mobileView!=='discover' && mobileView!=='friends'); return <button key={tab.id} onClick={()=>{ if(tab.id==='groups'){ setActiveTab('groups'); setMobileView('groups'); } else { setActiveTab(tab.id); setMobileView(tab.id); } }} className="flex flex-col items-center justify-center gap-1 py-2 px-3 rounded-[16px]"><div className={`w-9 h-9 rounded-[12px] flex items-center justify-center transition-all ${active ? 'shadow-lg scale-105' : ''}`} style={{ background: active ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : 'transparent', color: active ? COLORS.bg : COLORS.muted }}><Icon size={20} /></div><span className="text-[10px] font-black" style={{ color: active ? COLORS.gold : COLORS.muted }}>{tab.label}</span></button>; })}
      </div>

      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-end md:items-center justify-center z-[100] p-0 md:p-4" onClick={()=>setShowCreateGroup(false)}>
          <div className="w-full md:max-w-[460px] rounded-t-[32px] md:rounded-[24px] border-2 shadow-2xl p-7 max-h-[92dvh] overflow-y-auto" style={{ background: COLORS.surface, borderColor: COLORS.border }} onClick={e=>e.stopPropagation()}>
            <div className="w-12 h-1.5 rounded-full mx-auto mb-6 md:hidden" style={{ background: COLORS.border }} />
            <h3 className="font-black text-[20px] mb-6" style={{ color: COLORS.ivory }}>Créer un groupe</h3>
            <input value={newGroup.name} onChange={e=>setNewGroup({...newGroup, name: e.target.value})} placeholder="Nom du groupe" className="w-full p-4 rounded-[14px] mb-3 text-[15px] font-bold outline-none border-2" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} autoFocus />
            <textarea value={newGroup.description} onChange={e=>setNewGroup({...newGroup, description: e.target.value})} placeholder="Description" rows={3} className="w-full p-4 rounded-[14px] mb-4 text-[14px] outline-none border-2 resize-none" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
            <div className="flex gap-2 flex-wrap mb-6">{CATEGORIES.slice(1).map(c=>{ const Icon=c.icon; return <button key={c.id} onClick={()=>setNewGroup({...newGroup, category: c.id})} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-black border-2 ${newGroup.category===c.id?'scale-105 shadow' : ''}`} style={{ background: newGroup.category===c.id?COLORS.gold:COLORS.surface2, color: newGroup.category===c.id?COLORS.bg:COLORS.muted, borderColor: newGroup.category===c.id?COLORS.gold:COLORS.border }}><Icon size={14} /> {c.label}</button>; })}</div>
            <div className="flex gap-3"><button onClick={()=>setShowCreateGroup(false)} className="flex-1 py-4 rounded-[14px] font-black" style={{ background: COLORS.surface2, color: COLORS.muted }}>Annuler</button><button onClick={handleCreateGroup} disabled={!newGroup.name.trim()} className="flex-1 py-4 rounded-[14px] font-black disabled:opacity-50" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`, color: COLORS.bg }}>Créer</button></div>
          </div>
        </div>
      )}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-end md:items-center justify-center z-[100] p-0 md:p-4" onClick={()=>setShowCreateChannel(false)}>
          <div className="w-full md:max-w-[400px] rounded-t-[32px] md:rounded-[24px] border-2 shadow-2xl p-7" style={{ background: COLORS.surface, borderColor: COLORS.border }} onClick={e=>e.stopPropagation()}>
            <h3 className="font-black text-[18px] mb-6" style={{ color: COLORS.ivory }}>Nouveau salon dans {selectedGroup?.name}</h3>
            <input value={newChannel.name} onChange={e=>setNewChannel({...newChannel, name: e.target.value})} placeholder="nom-du-salon" className="w-full p-4 rounded-[14px] mb-3 text-[15px] font-bold outline-none border-2" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} autoFocus />
            <div className="flex gap-3 mb-6">
              <button onClick={()=>setNewChannel({...newChannel, type:'text'})} className="flex-1 py-3.5 rounded-[14px] font-black flex items-center justify-center gap-2 border-2" style={{ background: newChannel.type==='text'?COLORS.gold:COLORS.surface2, color: newChannel.type==='text'?COLORS.bg:COLORS.muted, borderColor: newChannel.type==='text'?COLORS.gold:COLORS.border }}><MessageSquare size={16} /> Texte</button>
              <button onClick={()=>setNewChannel({...newChannel, type:'voice'})} className="flex-1 py-3.5 rounded-[14px] font-black flex items-center justify-center gap-2 border-2" style={{ background: newChannel.type==='voice'?COLORS.teal:COLORS.surface2, color: newChannel.type==='voice'?COLORS.bg:COLORS.muted, borderColor: newChannel.type==='voice'?COLORS.teal:COLORS.border }}><Volume2 size={16} /> Vocal</button>
            </div>
            <div className="flex gap-3"><button onClick={()=>setShowCreateChannel(false)} className="flex-1 py-4 rounded-[14px] font-black" style={{ background: COLORS.surface2, color: COLORS.muted }}>Annuler</button><button onClick={handleCreateChannel} className="flex-1 py-4 rounded-[14px] font-black" style={{ background: COLORS.gold, color: COLORS.bg }}>Créer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
