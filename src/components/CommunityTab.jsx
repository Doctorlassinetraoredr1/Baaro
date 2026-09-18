import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Hash, Mic, MicOff, Send, Plus, Users, Search, MoreVertical, ShieldAlert,
  MessageSquare, Crown, Pin, Settings, Volume2, Compass, Sparkles, Lock, Globe, Flame, Smile, FileText, Menu, X, ChevronLeft, ArrowLeft
} from 'lucide-react';
import { useCommunity, useChannelMessages, useVoiceChannel } from '../hooks/useCommunity';
import { FollowButton, FriendsTab, FriendRequests } from '../features/friends/index.js';
import { COLORS } from '../theme.js';

const CATEGORIES = [
  { id: 'all', label: 'Tous', icon: Compass },
  { id: 'bamako', label: 'Bamako', icon: Flame },
  { id: 'business', label: 'Business', icon: Crown },
  { id: 'tech', label: 'Tech', icon: Hash },
  { id: 'etudes', label: 'Etudes', icon: FileText },
  { id: 'divertissement', label: 'Fun', icon: Smile },
];

export default function CommunityTab({ id, onOpenProfile }) {
  const { friends, allUsers, groups, createGroup, createChannel, banMember, loading } = useCommunity(id);
  const [activeTab, setActiveTab] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', is_public: true, category: 'bamako', type: 'community' });
  const [newChannel, setNewChannel] = useState({ name: '', type: 'text', topic: '' });
  const [search, setSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showMembers, setShowMembers] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);

  const { messages, sendMessage, isSending } = useChannelMessages(selectedChannel?.id) || { messages: [], sendMessage: ()=>{}, isSending: false };
  const { participants: voiceParticipants, isJoined, joinVoice, leaveVoice } = useVoiceChannel(selectedChannel?.id, id);
  const [msgText, setMsgText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const myRole = useMemo(() => selectedGroup?.members?.find(m => m.user_id === id || m.id === id)?.role || 'member', [selectedGroup, id]);
  const isAdmin = ['owner', 'admin'].includes(myRole);

  useEffect(() => {
    if (!selectedGroup && groups.length > 0) {
      setSelectedGroup(groups[0]);
      setSelectedChannel(groups[0].channels?.[0] || null);
    }
  }, [groups, selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close drawer when selecting channel on mobile
  useEffect(() => {
    if (selectedChannel && window.innerWidth < 768) {
      setMobileDrawerOpen(false);
    }
  }, [selectedChannel]);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const matchSearch = !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase());
      const matchCat = selectedCategory === 'all' || (g.category || 'bamako') === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [groups, groupSearch, selectedCategory]);

  const textChannels = useMemo(() => selectedGroup?.channels?.filter(c => c.type !== 'voice') || [], [selectedGroup]);
  const voiceChannels = useMemo(() => selectedGroup?.channels?.filter(c => c.type === 'voice') || [], [selectedGroup]);

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) return;
    try {
      const payload = { ...newGroup, is_public: newGroup.is_public, category: newGroup.category };
      const g = await createGroup(payload);
      setShowCreateGroup(false);
      setNewGroup({ name: '', description: '', is_public: true, category: 'bamako', type: 'community' });
      if (g) { setSelectedGroup(g); setSelectedChannel(g.channels?.[0] || null); }
      setMobileRailOpen(false);
    } catch (error) { console.error(error); }
  };

  const handleCreateChannel = async () => {
    if (!newChannel.name.trim() || !selectedGroup) return;
    try {
      const ch = await createChannel(selectedGroup.id, { name: newChannel.name, type: newChannel.type, description: newChannel.topic, topic: newChannel.topic });
      setShowCreateChannel(false);
      setNewChannel({ name: '', type: 'text', topic: '' });
      if (ch) setSelectedChannel(ch);
    } catch (e) { console.error(e); }
  };

  const handleSendMessage = () => {
    if (!msgText.trim() || !id || isSending) return;
    sendMessage(msgText, id);
    setMsgText('');
    inputRef.current?.focus();
  };

  const handleBanMember = async (groupId, memberId) => {
    if (!window.confirm("Bannir ce membre ?")) return;
    try { await banMember(groupId, memberId); } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] md:h-[calc(100vh-70px)] w-full animate-pulse" style={{ background: COLORS.bg }}>
        <div className="hidden md:flex w-[72px] border-r" style={{ background: COLORS.surface, borderColor: COLORS.border }} />
        <div className="hidden md:flex w-64 border-r" style={{ background: COLORS.surface, borderColor: COLORS.border }} />
        <div className="flex-1 flex items-center justify-center"><span className="text-xs" style={{ color: COLORS.muted }}>Chargement...</span></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] md:h-[calc(100vh-70px)] w-full overflow-hidden" style={{ background: COLORS.bg, color: COLORS.ivory }}>
      
      {/* MOBILE TOP BAR */}
      <div className="flex md:hidden h-14 items-center justify-between px-3 border-b shrink-0" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileRailOpen(!mobileRailOpen)} className="p-2 rounded-xl" style={{ background: COLORS.surface2, color: COLORS.ivory }}><Menu size={18} /></button>
          <button onClick={() => setMobileDrawerOpen(true)} className="p-2 rounded-xl" style={{ background: COLORS.surface2, color: COLORS.ivory }}><Hash size={18} /></button>
          <div className="ml-1 min-w-0">
            <p className="font-bold text-[14px] truncate max-w-[140px]" style={{ color: COLORS.ivory }}>{selectedGroup?.name || 'Communauté'}</p>
            <p className="text-[11px] truncate max-w-[140px]" style={{ color: COLORS.muted }}>#{selectedChannel?.name || 'general'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setActiveTab(activeTab === 'discover' ? 'groups' : 'discover')} className="p-2 rounded-xl" style={{ background: activeTab==='discover' ? COLORS.gold : COLORS.surface2, color: activeTab==='discover' ? COLORS.bg : COLORS.muted }}><Compass size={18} /></button>
          <button onClick={() => setShowCreateGroup(true)} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: COLORS.gold, color: COLORS.bg }}><Plus size={18} /></button>
        </div>
      </div>

      {/* MOBILE RAIL DRAWER (horizontal groups) */}
      {mobileRailOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm" onClick={() => setMobileRailOpen(false)}>
          <div className="w-[88px] h-full flex flex-col items-center py-4 gap-3 overflow-y-auto" style={{ background: COLORS.surface, borderRight: `1px solid ${COLORS.border}` }} onClick={e=>e.stopPropagation()}>
            <button onClick={() => { setActiveTab('discover'); setMobileRailOpen(false); setMobileDrawerOpen(true); }} className="w-14 h-14 rounded-[18px] flex items-center justify-center" style={{ background: activeTab==='discover' ? COLORS.gold : COLORS.surface2, color: activeTab==='discover' ? COLORS.bg : COLORS.teal }}><Compass size={22} /></button>
            <div className="w-10 h-0.5 rounded-full opacity-20" style={{ background: COLORS.border }} />
            {filteredGroups.map(g => {
              const isSelected = selectedGroup?.id === g.id;
              return (
                <button key={g.id} onClick={() => { setSelectedGroup(g); setSelectedChannel(g.channels?.[0]||null); setActiveTab('groups'); setMobileRailOpen(false); setMobileDrawerOpen(true); }} className={`w-14 h-14 rounded-[20px] font-bold text-[16px] relative flex items-center justify-center transition-all ${isSelected ? 'scale-105 ring-2' : ''}`} style={{ background: isSelected ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface2, color: isSelected ? COLORS.bg : COLORS.muted, ringColor: COLORS.gold }}>
                  {g.avatar_url ? <img src={g.avatar_url} className="w-full h-full rounded-[inherit] object-cover" alt="" /> : g.name[0]?.toUpperCase()}
                  {!g.is_public && <Lock size={10} className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5" />}
                </button>
              );
            })}
            <button onClick={() => { setMobileRailOpen(false); setShowCreateGroup(true); }} className="w-14 h-14 rounded-[20px] flex items-center justify-center border border-dashed" style={{ borderColor: COLORS.border, color: COLORS.teal }}><Plus size={22} /></button>
          </div>
        </div>
      )}

      {/* DESKTOP RAIL - hidden on mobile */}
      <div className="hidden md:flex w-[72px] flex-col items-center py-3 gap-2.5 border-r shrink-0 overflow-y-auto custom-scrollbar" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <button className="w-12 h-12 rounded-[16px] flex items-center justify-center mb-1 hover:rounded-[12px] transition-all" style={{ background: activeTab==='discover' ? COLORS.gold : COLORS.surface2, color: activeTab==='discover' ? COLORS.bg : COLORS.teal }} onClick={()=>setActiveTab('discover')} title="Découvrir"><Compass size={22} /></button>
        <div className="w-8 h-0.5 rounded-full opacity-20" style={{ background: COLORS.border }} />
        {filteredGroups.map(g => {
          const isSelected = selectedGroup?.id === g.id;
          return (
            <div key={g.id} className="relative group">
              {isSelected && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full" style={{ background: COLORS.gold }} />}
              <button onClick={() => { setSelectedGroup(g); setSelectedChannel(g.channels?.[0] || null); setActiveTab('groups'); }} className={`w-12 h-12 rounded-[18px] font-bold text-[16px] transition-all duration-200 hover:rounded-[14px] relative flex items-center justify-center ${isSelected ? 'rounded-[14px] scale-105' : ''}`} style={{ background: isSelected ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface2, color: isSelected ? COLORS.bg : COLORS.muted }} title={g.name}>
                {g.avatar_url ? <img src={g.avatar_url} className="w-full h-full rounded-[inherit] object-cover" alt="" /> : g.name[0]?.toUpperCase()}
                {!g.is_public && <Lock size={10} className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5" />}
              </button>
              {g.is_boosted && <Sparkles size={10} className="absolute -top-1 -right-1 text-amber-400" />}
            </div>
          );
        })}
        <button onClick={() => setShowCreateGroup(true)} className="w-12 h-12 rounded-[18px] flex items-center justify-center transition-all hover:rounded-[14px] hover:scale-105 group mt-1" style={{ background: `linear-gradient(135deg, ${COLORS.surface2}, ${COLORS.surface})`, color: COLORS.teal, border: `1px dashed ${COLORS.border}` }}><Plus size={22} className="group-hover:rotate-90 transition-transform duration-300" /></button>
      </div>

      {/* SIDEBAR - Drawer on mobile, fixed on desktop/tablet */}
      {/* Overlay for mobile */}
      {mobileDrawerOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileDrawerOpen(false)} />}

      <div className={`
        fixed md:static inset-y-0 left-0 z-50 md:z-auto
        w-[85vw] max-w-[320px] md:w-[280px] lg:w-[300px]
        flex flex-col border-r shrink-0
        transform transition-transform duration-300 ease-out
        ${mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        {/* Sidebar Header */}
        <div className="h-[52px] px-4 flex items-center justify-between border-b shadow-sm shrink-0" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMobileDrawerOpen(false)} className="md:hidden p-1.5 -ml-1 rounded-lg" style={{ color: COLORS.muted }}><ArrowLeft size={18} /></button>
            <h2 className="font-bold text-[15px] truncate" style={{ color: COLORS.ivory }}>{selectedGroup?.name || 'Communauté'}</h2>
            {selectedGroup && (selectedGroup.is_public ? <Globe size={12} style={{ color: COLORS.muted }} /> : <Lock size={12} style={{ color: COLORS.muted }} />)}
            {selectedGroup?.is_boosted && <Sparkles size={12} style={{ color: COLORS.gold }} />}
          </div>
          <button className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10" style={{ color: COLORS.muted }}><Settings size={16} /></button>
          <button onClick={() => setMobileDrawerOpen(false)} className="md:hidden p-1.5 rounded-lg hover:bg-white/10" style={{ color: COLORS.muted }}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b shrink-0" style={{ borderColor: COLORS.border }}>
          {[{id:'groups', label:'Canaux', icon: Hash},{id:'friends', label:'Amis', icon: Users},{id:'discover', label:'Découvrir', icon: Compass}].map(tab => {
            const Icon = tab.icon; const active = activeTab===tab.id;
            return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex-1 flex items-center justify-center gap-1 py-2.5 md:py-2 rounded-[10px] text-[12px] md:text-[11px] font-bold uppercase tracking-wider transition-all" style={{ background: active ? 'rgba(255,255,255,0.08)' : 'transparent', color: active ? COLORS.gold : COLORS.muted }}><Icon size={14} /> {tab.label}</button>;
          })}
        </div>

        {activeTab==='groups' && (
          <div className="px-3 py-2 shrink-0">
            <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} /><input value={groupSearch} onChange={e=>setGroupSearch(e.target.value)} placeholder="Filtrer groupes..." className="w-full pl-9 pr-3 py-2.5 md:py-2 rounded-xl text-[13px] md:text-xs outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} /></div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
          {activeTab === 'groups' && selectedGroup && (
            <>
              <div className="mb-5">
                <div className="flex items-center justify-between px-2 mb-2"><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.muted }}>Canaux Texte — {textChannels.length}</p>{isAdmin && <button onClick={()=>setShowCreateChannel(true)} className="p-1 rounded hover:bg-white/10" style={{ color: COLORS.muted }}><Plus size={12} /></button>}</div>
                <div className="space-y-0.5">{textChannels.map(ch => { const isActive = selectedChannel?.id === ch.id; return <button key={ch.id} onClick={() => setSelectedChannel(ch)} className="w-full flex items-center gap-2.5 px-2.5 py-3 md:py-2 rounded-[10px] text-[14px] md:text-[13px] transition-all text-left group" style={{ background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent', color: isActive ? COLORS.ivory : COLORS.muted }}><Hash size={16} className={isActive ? '' : 'opacity-60'} /><span className="flex-1 truncate">{ch.name}</span></button>; })}{textChannels.length===0 && <p className="text-[11px] px-2.5 py-2 italic" style={{ color: COLORS.muted }}>Aucun canal</p>}</div>
              </div>
              <div className="mb-6"><p className="text-[10px] font-bold uppercase tracking-widest px-2 mb-2" style={{ color: COLORS.muted }}>Vocaux — {voiceChannels.length}</p><div className="space-y-0.5">{voiceChannels.map(ch => { const isActive = selectedChannel?.id===ch.id; const hasUsers = (ch.participants_count || 0) > 0; return <button key={ch.id} onClick={() => setSelectedChannel(ch)} className={`w-full flex items-center gap-2.5 px-2.5 py-3 md:py-2 rounded-[10px] text-[14px] md:text-[13px] transition-all text-left ${isActive ? 'bg-white/5' : 'hover:bg-white/5'}`} style={{ color: isActive ? COLORS.ivory : COLORS.muted }}><Volume2 size={16} className={hasUsers ? 'text-emerald-400' : ''} /><span className="flex-1 truncate">{ch.name}</span>{hasUsers && <span className="text-[10px] flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />{ch.participants_count}</span>}</button>; })}</div></div>
              <div>
                <div className="flex items-center justify-between px-2 mb-2"><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.muted }}>Membres — {selectedGroup.members?.length||0}</p><button onClick={() => setShowMembers(!showMembers)} className="p-1 rounded hover:bg-white/10" style={{ color: COLORS.muted }}><MoreVertical size={12} /></button></div>
                {showMembers && <div className="space-y-1">{(selectedGroup.members||[]).map(m => { const prof = m.profiles || m; const uid = m.user_id || m.id; return <div key={uid} className="flex items-center gap-2.5 px-2 py-2 md:py-1.5 rounded-[10px] hover:bg-white/5 group"><img src={prof?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${prof?.display_name}`} className="w-9 h-9 md:w-8 md:h-8 rounded-full border" style={{ borderColor: COLORS.border }} alt="" /><div className="flex-1 min-w-0 cursor-pointer" onClick={()=>onOpenProfile?.(uid)}><p className="text-[14px] md:text-[13px] font-medium truncate" style={{ color: COLORS.ivory }}>{prof?.display_name || 'Membre'}</p><p className="text-[12px] md:text-[11px] truncate flex items-center gap-1" style={{ color: uid===id ? COLORS.teal : COLORS.muted }}>{m.role==='owner' && <Crown size={10} className="text-amber-400" />} {uid===id ? 'Vous' : m.role}</p></div>{isAdmin && uid!==id && <button onClick={()=>handleBanMember(selectedGroup.id, uid)} className="md:opacity-0 md:group-hover:opacity-100 p-2 md:p-1.5 rounded-lg hover:bg-red-500/20" style={{ color: '#ef4444' }}><ShieldAlert size={14} /></button>}</div>; })}</div>}
              </div>
            </>
          )}
          {activeTab === 'friends' && <div className="flex flex-col h-full"><FriendRequests onOpenProfile={onOpenProfile} /><div className="border-t my-3 mx-2" style={{ borderColor: COLORS.border }} /><FriendsTab onOpenProfile={onOpenProfile} /></div>}
          {activeTab === 'discover' && (
            <div className="space-y-4">
              <div className="px-1"><div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">{CATEGORIES.map(cat => { const Icon = cat.icon; const active = selectedCategory===cat.id; return <button key={cat.id} onClick={()=>setSelectedCategory(cat.id)} className={`flex items-center gap-1.5 px-3 py-2 md:py-1.5 rounded-full text-[12px] md:text-[11px] font-bold whitespace-nowrap transition-all ${active?'scale-105':''}`} style={{ background: active?COLORS.gold:COLORS.surface2, color: active?COLORS.bg:COLORS.muted }}><Icon size={12} /> {cat.label}</button>; })}</div></div>
              <div className="relative px-1"><Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher groupes ou personnes..." className="w-full pl-9 pr-3 py-3 md:py-2.5 rounded-xl text-[13px] md:text-xs outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} /></div>
              <div className="space-y-2"><p className="text-[11px] font-bold uppercase tracking-widest px-2" style={{ color: COLORS.muted }}>Groupes populaires</p>{groups.filter(g=>!search || g.name.toLowerCase().includes(search.toLowerCase())).slice(0,8).map(g => <div key={g.id} className="p-3 rounded-[14px] border hover:border-amber-400/30 transition-all cursor-pointer group" style={{ background: COLORS.surface2, borderColor: COLORS.border }} onClick={()=>{setSelectedGroup(g); setSelectedChannel(g.channels?.[0]||null); setActiveTab('groups'); setMobileDrawerOpen(false);}}><div className="flex gap-3"><div className="w-11 h-11 rounded-[12px] flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`, color: COLORS.bg }}>{g.avatar_url ? <img src={g.avatar_url} className="w-full h-full object-cover" alt="" /> : g.name[0]}</div><div className="flex-1 min-w-0"><p className="text-[13px] font-bold truncate flex items-center gap-1" style={{ color: COLORS.ivory }}>{g.name}{g.is_boosted && <Sparkles size={12} className="text-amber-400" />}</p><p className="text-[11px] truncate" style={{ color: COLORS.muted }}>{g.description || 'Communauté Baaro'}</p><div className="flex items-center gap-3 mt-1.5"><span className="flex items-center gap-1 text-[10px]" style={{ color: COLORS.muted }}><Users size={10} /> {g.members_count || g.members?.length || 0}</span><span className="flex items-center gap-1 text-[10px]" style={{ color: COLORS.muted }}>{g.is_public ? <Globe size={10} /> : <Lock size={10} />} {g.is_public ? 'Public' : 'Privé'}</span></div></div></div></div>)}</div>
              <div className="space-y-1 pt-2 border-t" style={{ borderColor: COLORS.border }}><p className="text-[11px] font-bold uppercase tracking-widest px-2 mb-2" style={{ color: COLORS.muted }}>Personnes</p>{allUsers.filter(u=>u.display_name?.toLowerCase().includes(search.toLowerCase())).slice(0,10).map(u => <div key={u.id} className="flex items-center justify-between gap-2 py-2.5 md:py-2 px-2 rounded-xl hover:bg-white/5"><div className="flex items-center gap-2.5 min-w-0 cursor-pointer" onClick={()=>onOpenProfile?.(u.id)}><img src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.display_name}`} className="w-9 h-9 md:w-8 md:h-8 rounded-full" alt="" /><span className="text-[14px] md:text-[13px] font-medium truncate" style={{ color: COLORS.ivory }}>{u.display_name}</span></div>{u.id!==id && <FollowButton targetId={u.id} currentUserId={id} />}</div>)}</div>
            </div>
          )}
        </div>
      </div>

      {/* ZONE PRINCIPALE CHAT */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: COLORS.bg }}>
        {!selectedChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 text-center" style={{ color: COLORS.muted }}>
            <div className="w-20 h-20 rounded-[20px] flex items-center justify-center mb-5" style={{ background: COLORS.surface2 }}><MessageSquare size={32} className="opacity-30" /></div>
            <h3 className="text-[16px] font-bold mb-2" style={{ color: COLORS.ivory }}>Bienvenue sur Baaro Communauté</h3>
            <p className="text-[13px] max-w-[320px] leading-relaxed">Sélectionne un canal pour commencer à discuter, rejoins des groupes à Bamako, ou crée le tien.</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6 w-full sm:w-auto px-6 sm:px-0"><button onClick={()=>{setActiveTab('discover'); setMobileDrawerOpen(true);}} className="px-5 py-3 md:py-2 rounded-full text-[13px] md:text-xs font-bold" style={{ background: COLORS.gold, color: COLORS.bg }}>Découvrir des groupes</button><button onClick={()=>setShowCreateGroup(true)} className="px-5 py-3 md:py-2 rounded-full text-[13px] md:text-xs font-bold border" style={{ borderColor: COLORS.border, color: COLORS.ivory }}>Créer un groupe</button></div>
            <button onClick={() => setMobileDrawerOpen(true)} className="md:hidden mt-4 flex items-center gap-2 px-4 py-2 rounded-full border text-xs" style={{ borderColor: COLORS.border, color: COLORS.muted }}><Menu size={14} /> Ouvrir les canaux</button>
          </div>
        ) : selectedChannel.type === 'voice' ? (
          <div className="flex-1 flex flex-col">
            <div className="h-14 px-4 md:px-5 flex items-center justify-between border-b" style={{ borderColor: COLORS.border }}>
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileDrawerOpen(true)} className="md:hidden p-1.5 -ml-1 rounded-lg" style={{ color: COLORS.muted }}><ChevronLeft size={20} /></button>
                <Volume2 size={18} style={{ color: COLORS.teal }} />
                <h3 className="font-bold text-[14px]" style={{ color: COLORS.ivory }}>{selectedChannel.name}</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: COLORS.surface2, color: COLORS.muted }}>{voiceParticipants?.length||0} participants</span>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 md:p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{(voiceParticipants||[]).map(p => <div key={p.id} className="flex flex-col items-center gap-2"><div className="relative"><img src={p.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${p.display_name}`} className="w-16 h-16 md:w-16 md:h-16 rounded-full border-2" style={{ borderColor: isJoined ? COLORS.teal : COLORS.border }} alt="" /><span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 flex items-center justify-center" style={{ borderColor: COLORS.bg }}><Mic size={10} color="white" /></span></div><span className="text-xs font-medium" style={{ color: COLORS.ivory }}>{p.display_name?.split(' ')[0]}</span></div>)}</div>
              <div className="flex items-center gap-3 mt-4">{!isJoined ? <button onClick={joinVoice} className="flex items-center gap-2 px-7 py-3.5 md:py-3 rounded-full font-bold text-[14px] md:text-sm transition-all hover:scale-105 active:scale-95 shadow-lg" style={{ background: COLORS.teal, color: COLORS.bg }}><Mic size={18} /> Rejoindre le vocal</button> : <button onClick={leaveVoice} className="flex items-center gap-2 px-7 py-3.5 md:py-3 rounded-full font-bold text-[14px] md:text-sm bg-red-500 text-white"><MicOff size={18} /> Quitter</button>}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="h-14 px-4 md:px-5 flex items-center justify-between border-b shrink-0" style={{ borderColor: COLORS.border }}>
              <div className="flex items-center gap-2 md:gap-3 min-w-0">
                <button onClick={() => setMobileDrawerOpen(true)} className="md:hidden p-1.5 -ml-1 rounded-lg shrink-0" style={{ color: COLORS.muted }}><Menu size={20} /></button>
                <Hash size={18} style={{ color: COLORS.muted }} className="hidden sm:block" />
                <h3 className="font-bold text-[14px] truncate" style={{ color: COLORS.ivory }}>{selectedChannel.name}</h3>
                <span className="hidden lg:flex items-center gap-1.5 text-[11px] pl-3 ml-3 border-l truncate max-w-[300px]" style={{ borderColor: COLORS.border, color: COLORS.muted }}><Pin size={12} /> {selectedChannel.topic || selectedChannel.description || 'Discussions du groupe'}</span>
              </div>
              <button className="md:hidden p-2 rounded-xl" style={{ background: COLORS.surface2, color: COLORS.muted }} onClick={() => setShowMembers(s => !s)}><Users size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-1 custom-scrollbar">
              {messages.length === 0 ? <div className="text-center py-16" style={{ color: COLORS.muted }}><div className="w-16 h-16 rounded-[18px] flex items-center justify-center mx-auto mb-4" style={{ background: COLORS.surface2 }}><Hash size={28} className="opacity-30" /></div><p className="text-[15px] font-bold mb-1" style={{ color: COLORS.ivory }}>Bienvenue dans #{selectedChannel.name}</p><p className="text-xs max-w-[280px] mx-auto">C'est le début de l'histoire de ce canal.</p></div> : messages.map((m, idx) => { const prev = messages[idx-1]; const showAvatar = !prev || prev.sender_id !== m.sender_id || new Date(m.created_at) - new Date(prev.created_at) > 300000; return <div key={m.id} className={`flex gap-2.5 md:gap-3 group px-2 py-1.5 md:py-1 rounded-xl hover:bg-white/[0.04] ${showAvatar ? 'mt-4' : ''}`}><div className="w-9 shrink-0">{showAvatar && <img src={m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.profiles?.display_name}`} className="w-9 h-9 rounded-full border flex-shrink-0 mt-0.5 cursor-pointer" style={{ borderColor: COLORS.border }} onClick={()=>onOpenProfile?.(m.sender_id)} alt="" />}</div><div className="flex-1 min-w-0">{showAvatar && <div className="flex items-baseline gap-2 mb-0.5 flex-wrap"><span className="text-[13px] font-bold cursor-pointer hover:underline" style={{ color: COLORS.ivory }} onClick={()=>onOpenProfile?.(m.sender_id)}>{m.profiles?.display_name || 'Membre'}</span><span className="text-[10px] md:text-[11px]" style={{ color: COLORS.muted }}>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></div>}<p className="text-[14px] md:text-[14px] leading-[22px] break-words" style={{ color: COLORS.ivory }}>{m.text || m.content}</p></div></div>; })}<div ref={messagesEndRef} />
            </div>
            {/* Input - sticky bottom with safe area */}
            <div className="p-2.5 md:p-3 border-t shrink-0 pb-[calc(0.625rem+env(safe-area-inset-bottom))] md:pb-3" style={{ borderColor: COLORS.border, background: COLORS.bg }}>
              <div className="flex items-end gap-2 rounded-[20px] md:rounded-[16px] border px-3 py-2" style={{ background: COLORS.surface2, borderColor: COLORS.border }}>
                <button className="hidden md:flex p-2 rounded-xl hover:bg-white/10 shrink-0 mb-0.5" style={{ color: COLORS.muted }}><Plus size={18} /></button>
                <textarea ref={inputRef} value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} placeholder={`Message dans #${selectedChannel.name}`} rows={1} className="flex-1 bg-transparent py-2.5 md:py-2 text-[15px] md:text-[14px] outline-none placeholder:text-gray-500 resize-none max-h-[120px] min-h-[24px]" style={{ color: COLORS.ivory }} onInput={e => { e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }} />
                <div className="flex items-center gap-1 shrink-0 mb-0.5">
                  <button onClick={handleSendMessage} disabled={!msgText.trim() || isSending} className="p-3 md:p-2.5 rounded-full md:rounded-xl transition-all disabled:opacity-30 active:scale-95" style={{ background: msgText.trim() ? COLORS.gold : COLORS.surface, color: msgText.trim() ? COLORS.bg : COLORS.muted }}><Send size={18} className="md:hidden" /><Send size={16} className="hidden md:block" /></button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODALS - Responsive full screen on mobile */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-4" onClick={() => setShowCreateGroup(false)}>
          <div className="w-full md:max-w-[420px] rounded-t-[24px] md:rounded-[20px] border-t md:border shadow-2xl p-5 md:p-6 max-h-[90dvh] overflow-y-auto" style={{ background: COLORS.surface, borderColor: COLORS.borderGold }} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4 md:hidden" style={{ background: COLORS.border }} />
            <div className="flex items-center gap-3 mb-5"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: COLORS.gold }}><Users size={18} style={{ color: COLORS.bg }} /></div><div><h3 className="text-[16px] font-bold" style={{ color: COLORS.ivory }}>Créer un groupe</h3><p className="text-[11px]" style={{ color: COLORS.muted }}>Un espace pour ta communauté</p></div><button onClick={()=>setShowCreateGroup(false)} className="ml-auto md:hidden p-2 rounded-xl" style={{ background: COLORS.surface2 }}><X size={16} /></button></div>
            <input value={newGroup.name} onChange={e=>setNewGroup({...newGroup, name: e.target.value})} placeholder="Nom du groupe ex: Entrepreneurs Bamako" className="w-full p-3.5 md:p-3 rounded-xl mb-3 text-[15px] md:text-sm outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} autoFocus />
            <textarea value={newGroup.description} onChange={e=>setNewGroup({...newGroup, description: e.target.value})} placeholder="Description courte" rows={3} className="w-full p-3.5 md:p-3 rounded-xl mb-3 text-[15px] md:text-sm outline-none border resize-none" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
            <div className="flex gap-2 mb-4 flex-wrap">{CATEGORIES.slice(1).map(c=><button key={c.id} onClick={()=>setNewGroup({...newGroup, category: c.id})} className="px-3.5 py-2 md:px-3 md:py-1.5 rounded-full text-[13px] md:text-[11px] font-bold border" style={{ background: newGroup.category===c.id?COLORS.gold:COLORS.surface2, color: newGroup.category===c.id?COLORS.bg:COLORS.muted, borderColor: newGroup.category===c.id?COLORS.gold:COLORS.border }}>{c.label}</button>)}</div>
            <label className="flex items-center gap-2 mb-5 cursor-pointer p-2 rounded-xl" style={{ background: COLORS.surface2 }}><input type="checkbox" checked={newGroup.is_public} onChange={e=>setNewGroup({...newGroup, is_public: e.target.checked})} className="rounded w-5 h-5 md:w-4 md:h-4" /><span className="text-[14px] md:text-xs flex items-center gap-1.5" style={{ color: COLORS.muted }}><Globe size={14} /> Groupe public (visible par tous)</span></label>
            <div className="flex justify-end gap-2 pb-[env(safe-area-inset-bottom)]"><button onClick={()=>setShowCreateGroup(false)} className="flex-1 md:flex-none px-4 py-3.5 md:py-2.5 rounded-xl text-[14px] md:text-xs font-bold hover:bg-white/5" style={{ color: COLORS.muted }}>Annuler</button><button onClick={handleCreateGroup} disabled={!newGroup.name.trim()} className="flex-1 md:flex-none px-5 py-3.5 md:py-2.5 rounded-xl text-[14px] md:text-xs font-bold disabled:opacity-50" style={{ background: COLORS.gold, color: COLORS.bg }}>Créer le groupe</button></div>
          </div>
        </div>
      )}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-end md:items-center justify-center z-[70] p-0 md:p-4" onClick={()=>setShowCreateChannel(false)}>
          <div className="w-full md:max-w-[380px] rounded-t-[24px] md:rounded-[20px] border-t md:border shadow-2xl p-5 md:p-6" style={{ background: COLORS.surface, borderColor: COLORS.border }} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-4 md:hidden" style={{ background: COLORS.border }} />
            <h3 className="font-bold mb-4 text-[16px] md:text-[15px]" style={{ color: COLORS.ivory }}>Nouveau canal dans {selectedGroup?.name}</h3>
            <input value={newChannel.name} onChange={e=>setNewChannel({...newChannel, name: e.target.value})} placeholder="nom-du-canal" className="w-full p-3.5 md:p-3 rounded-xl mb-3 text-[15px] md:text-sm outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} autoFocus />
            <input value={newChannel.topic} onChange={e=>setNewChannel({...newChannel, topic: e.target.value})} placeholder="Topic / sujet (optionnel)" className="w-full p-3.5 md:p-3 rounded-xl mb-4 text-[15px] md:text-sm outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
            <div className="flex gap-2 mb-5"><button onClick={()=>setNewChannel({...newChannel, type:'text'})} className="flex-1 py-3 md:py-2 rounded-xl text-[14px] md:text-xs font-bold flex items-center justify-center gap-1" style={{ background: newChannel.type==='text'?COLORS.gold:COLORS.surface2, color: newChannel.type==='text'?COLORS.bg:COLORS.muted }}><Hash size={16} /> Texte</button><button onClick={()=>setNewChannel({...newChannel, type:'voice'})} className="flex-1 py-3 md:py-2 rounded-xl text-[14px] md:text-xs font-bold flex items-center justify-center gap-1" style={{ background: newChannel.type==='voice'?COLORS.teal:COLORS.surface2, color: newChannel.type==='voice'?COLORS.bg:COLORS.muted }}><Mic size={16} /> Vocal</button></div>
            <div className="flex gap-2"><button onClick={()=>setShowCreateChannel(false)} className="flex-1 px-4 py-3.5 md:py-2 rounded-xl text-[14px] md:text-xs font-bold" style={{ background: COLORS.surface2, color: COLORS.muted }}>Annuler</button><button onClick={handleCreateChannel} className="flex-1 px-5 py-3.5 md:py-2 rounded-xl text-[14px] md:text-xs font-bold" style={{ background: COLORS.gold, color: COLORS.bg }}>Créer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
