import { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Hash, Mic, MicOff, Send, Plus, Users, Search, MoreVertical, ShieldAlert,
  MessageSquare, Crown, Pin, Settings, Volume2, Compass, Sparkles, Lock, Globe, Flame, Smile, FileText, Menu, X, ChevronLeft, ArrowLeft, Home, MessageCircle, UserCheck
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
  const [showMembers, setShowMembers] = useState(false);
  const [mobileView, setMobileView] = useState('groups'); // groups | channels | chat | discover | friends

  const { messages, sendMessage } = useChannelMessages(selectedChannel?.id) || { messages: [], sendMessage: ()=>{} };
  const { participants: voiceParticipants, isJoined, joinVoice, leaveVoice } = useVoiceChannel(selectedChannel?.id, id);
  const [msgText, setMsgText] = useState('');
  const messagesEndRef = useRef(null);

  const myRole = useMemo(() => selectedGroup?.members?.find(m => m.user_id === id || m.id === id)?.role || 'member', [selectedGroup, id]);
  const isAdmin = ['owner', 'admin'].includes(myRole);

  useEffect(() => {
    if (!selectedGroup && groups.length > 0) {
      setSelectedGroup(groups[0]);
      setSelectedChannel(groups[0].channels?.[0] || null);
    }
  }, [groups, selectedGroup]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const matchSearch = !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase());
      const matchCat = selectedCategory === 'all' || (g.category || 'bamako') === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [groups, groupSearch, selectedCategory]);

  const textChannels = useMemo(() => selectedGroup?.channels?.filter(c => c.type !== 'voice') || [], [selectedGroup]);
  const voiceChannels = useMemo(() => selectedGroup?.channels?.filter(c => c.type === 'voice') || [], [selectedGroup]);

  const handleSelectGroup = (g) => {
    setSelectedGroup(g);
    setSelectedChannel(g.channels?.[0] || null);
    setActiveTab('groups');
    setMobileView('channels');
  };

  const handleSelectChannel = (ch) => {
    setSelectedChannel(ch);
    setMobileView('chat');
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) return;
    try {
      // Compat: is_private -> is_public
      const payload = { ...newGroup, is_public: newGroup.is_public ?? !newGroup.is_private, is_private: undefined };
      const g = await createGroup(payload);
      setShowCreateGroup(false);
      setNewGroup({ name: '', description: '', is_public: true, category: 'bamako', type: 'community' });
      if (g) { setSelectedGroup(g); setSelectedChannel(g.channels?.[0] || null); setMobileView('channels'); }
    } catch (e) { console.error(e); }
  };

  const handleCreateChannel = async () => {
    if (!newChannel.name.trim() || !selectedGroup) return;
    try {
      const ch = await createChannel(selectedGroup.id, { name: newChannel.name, type: newChannel.type, description: newChannel.topic });
      setShowCreateChannel(false);
      setNewChannel({ name: '', type: 'text', topic: '' });
      if (ch) { setSelectedChannel(ch); setMobileView('chat'); }
    } catch (e) { console.error(e); }
  };

  const handleSendMessage = () => {
    if (!msgText.trim() || !id) return;
    sendMessage(msgText, id);
    setMsgText('');
  };

  if (loading) {
    return <div className="flex h-[100dvh] md:h-[calc(100vh-70px)] items-center justify-center" style={{ background: COLORS.bg, color: COLORS.muted }}><div className="animate-pulse flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-2xl" style={{ background: COLORS.surface2 }} /><p className="text-xs">Chargement communautés...</p></div></div>;
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] md:h-[calc(100vh-70px)] w-full overflow-hidden" style={{ background: COLORS.bg, color: COLORS.ivory }}>
      
      {/* ===== DESKTOP RAIL ===== */}
      <div className="hidden md:flex w-[72px] flex-col items-center py-3 gap-2.5 border-r shrink-0 overflow-y-auto" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <button onClick={()=>setActiveTab('discover')} className="w-12 h-12 rounded-[16px] flex items-center justify-center transition-all" style={{ background: activeTab==='discover' ? COLORS.gold : COLORS.surface2, color: activeTab==='discover' ? COLORS.bg : COLORS.teal }}><Compass size={22} /></button>
        <div className="w-8 h-0.5 rounded-full opacity-20" style={{ background: COLORS.border }} />
        {groups.map(g => {
          const sel = selectedGroup?.id === g.id;
          return <div key={g.id} className="relative"><button onClick={()=>handleSelectGroup(g)} className={`w-12 h-12 rounded-[18px] font-bold flex items-center justify-center relative ${sel ? 'ring-2 scale-105' : ''}`} style={{ background: sel ? `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` : COLORS.surface2, color: sel ? COLORS.bg : COLORS.muted, ringColor: COLORS.gold }}>{g.avatar_url ? <img src={g.avatar_url} className="w-full h-full rounded-[inherit] object-cover" alt="" /> : g.name[0]?.toUpperCase()}{!g.is_public && g.is_public!==undefined ? null : g.is_private ? <Lock size={10} className="absolute -bottom-1 -right-1 bg-black rounded-full p-0.5" /> : null}</button>{g.is_boosted && <Sparkles size={10} className="absolute -top-1 -right-1 text-amber-400" />}</div>;
        })}
        <button onClick={()=>setShowCreateGroup(true)} className="w-12 h-12 rounded-[18px] flex items-center justify-center border border-dashed mt-1" style={{ borderColor: COLORS.border, color: COLORS.teal }}><Plus size={20} /></button>
      </div>

      {/* ===== SIDEBAR - Desktop/Tablet always visible, Mobile conditional ===== */}
      <div className={`
        ${mobileView === 'groups' || mobileView === 'channels' || mobileView === 'discover' || mobileView === 'friends' ? 'flex' : 'hidden'} md:flex
        w-full md:w-[320px] lg:w-[340px] flex-col border-r shrink-0
        ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}
      `} style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        
        {/* Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b shrink-0" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 min-w-0">
            {mobileView !== 'groups' && <button onClick={()=>setMobileView('groups')} className="md:hidden p-1.5 -ml-1 rounded-lg" style={{ color: COLORS.muted }}><ArrowLeft size={18} /></button>}
            <h2 className="font-bold text-[15px] truncate" style={{ color: COLORS.ivory }}>{activeTab==='discover' ? 'Découvrir' : activeTab==='friends' ? 'Amis' : selectedGroup?.name || 'Groupes'}</h2>
            {selectedGroup?.is_boosted && <Sparkles size={12} style={{ color: COLORS.gold }} />}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>setShowCreateGroup(true)} className="p-2 rounded-xl md:hidden" style={{ background: COLORS.gold, color: COLORS.bg }}><Plus size={16} /></button>
            <button className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10" style={{ color: COLORS.muted }}><Settings size={16} /></button>
          </div>
        </div>

        {/* Tabs desktop */}
        <div className="hidden md:flex gap-1 p-2 border-b shrink-0" style={{ borderColor: COLORS.border }}>
          {[{id:'groups', label:'Canaux', icon: Hash},{id:'friends', label:'Amis', icon: Users},{id:'discover', label:'Découvrir', icon: Compass}].map(tab => {
            const Icon = tab.icon; const active = activeTab===tab.id;
            return <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-[10px] text-[11px] font-bold uppercase" style={{ background: active ? 'rgba(255,255,255,0.08)' : 'transparent', color: active ? COLORS.gold : COLORS.muted }}><Icon size={13} /> {tab.label}</button>;
          })}
        </div>

        {/* Mobile Tabs - top filter */}
        <div className="flex md:hidden gap-1 p-2 border-b shrink-0 overflow-x-auto scrollbar-none" style={{ borderColor: COLORS.border }}>
          {[{id:'groups', label:'Mes groupes', icon: Home},{id:'discover', label:'Découvrir', icon: Compass},{id:'friends', label:'Amis', icon: UserCheck}].map(tab => {
            const Icon = tab.icon; const active = (mobileView===tab.id) || (mobileView==='channels' && tab.id==='groups');
            return <button key={tab.id} onClick={()=>{setMobileView(tab.id); setActiveTab(tab.id);}} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap ${active ? 'shadow' : ''}`} style={{ background: active ? COLORS.gold : COLORS.surface2, color: active ? COLORS.bg : COLORS.muted }}><Icon size={14} /> {tab.label}</button>;
          })}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* GROUPS VIEW */}
          {(mobileView==='groups' || mobileView==='channels' || activeTab==='groups') && activeTab!=='discover' && activeTab!=='friends' && (
            <div className="p-2">
              {/* Mobile: if no group selected or in groups view, show group list */}
              <div className={`${mobileView==='channels' ? 'hidden md:block' : 'block'} space-y-3`}>
                <div className="px-2 py-2"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} /><input value={groupSearch} onChange={e=>setGroupSearch(e.target.value)} placeholder="Rechercher groupe..." className="w-full pl-9 pr-3 py-3 md:py-2.5 rounded-xl text-[14px] md:text-xs outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} /></div></div>
                <div className="flex gap-1.5 px-2 overflow-x-auto scrollbar-none pb-1">{CATEGORIES.map(cat => { const Icon = cat.icon; const active = selectedCategory===cat.id; return <button key={cat.id} onClick={()=>setSelectedCategory(cat.id)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap ${active?'scale-105':''}`} style={{ background: active?COLORS.gold:COLORS.surface2, color: active?COLORS.bg:COLORS.muted }}><Icon size={11} /> {cat.label}</button>; })}</div>
                <div className="space-y-1">
                  {filteredGroups.map(g => {
                    const sel = selectedGroup?.id===g.id;
                    return <button key={g.id} onClick={()=>handleSelectGroup(g)} className={`w-full flex items-center gap-3 p-3 rounded-[14px] text-left border transition-all ${sel ? 'border-amber-400/40' : 'border-transparent'}`} style={{ background: sel ? COLORS.surface2 : 'transparent' }}><div className="w-11 h-11 rounded-[12px] flex items-center justify-center font-bold shrink-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`, color: COLORS.bg }}>{g.avatar_url ? <img src={g.avatar_url} className="w-full h-full object-cover" alt="" /> : g.name[0]?.toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-[14px] font-bold truncate flex items-center gap-1" style={{ color: COLORS.ivory }}>{g.name}{g.is_boosted && <Sparkles size={12} className="text-amber-400" />}</p><p className="text-[11px] truncate" style={{ color: COLORS.muted }}>{g.members?.length||0} membres • {g.is_public!==false ? 'Public' : 'Privé'}</p></div>{sel && <ChevronLeft className="rotate-180 opacity-40" size={16} />}</button>;
                  })}
                </div>
              </div>

              {/* Channels list - visible on desktop always, on mobile only when in channels view */}
              <div className={`${mobileView==='groups' ? 'hidden md:block' : 'block'} mt-2 md:mt-6 space-y-5 px-2`}>
                {selectedGroup ? (
                  <>
                    <div className="md:hidden flex items-center gap-2 px-1 mb-3 p-3 rounded-[14px]" style={{ background: COLORS.surface2 }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` }}>{selectedGroup.avatar_url ? <img src={selectedGroup.avatar_url} className="w-full h-full rounded-xl object-cover" alt="" /> : selectedGroup.name[0]}</div>
                      <div className="flex-1 min-w-0"><p className="font-bold text-[14px] truncate" style={{ color: COLORS.ivory }}>{selectedGroup.name}</p><p className="text-[11px] truncate" style={{ color: COLORS.muted }}>{selectedGroup.description || 'Communauté'}</p></div>
                      <button onClick={()=>setMobileView('groups')} className="p-2 rounded-full" style={{ background: COLORS.surface }}><X size={14} /></button>
                    </div>
                    <div>
                      <div className="flex items-center justify-between px-1 mb-2"><p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COLORS.muted }}>Texte — {textChannels.length}</p>{isAdmin && <button onClick={()=>setShowCreateChannel(true)} className="p-1 rounded hover:bg-white/10"><Plus size={12} /></button>}</div>
                      {textChannels.map(ch => { const active = selectedChannel?.id===ch.id; return <button key={ch.id} onClick={()=>handleSelectChannel(ch)} className={`w-full flex items-center gap-2.5 px-3 py-3 md:py-2 rounded-xl text-[14px] md:text-[13px] text-left ${active ? 'font-bold' : ''}`} style={{ background: active ? 'rgba(255,255,255,0.08)' : 'transparent', color: active ? COLORS.ivory : COLORS.muted }}><Hash size={16} /> {ch.name}</button>; })}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest px-1 mb-2" style={{ color: COLORS.muted }}>Vocaux — {voiceChannels.length}</p>
                      {voiceChannels.map(ch => <button key={ch.id} onClick={()=>handleSelectChannel(ch)} className="w-full flex items-center gap-2.5 px-3 py-3 md:py-2 rounded-xl text-[14px] md:text-[13px] text-left hover:bg-white/5" style={{ color: COLORS.muted }}><Volume2 size={16} /> {ch.name}</button>)}
                    </div>
                  </>
                ) : <p className="text-xs p-4 text-center" style={{ color: COLORS.muted }}>Sélectionne un groupe</p>}
              </div>
            </div>
          )}

          { (mobileView==='discover' || activeTab==='discover') && (
            <div className="p-3 space-y-4">
              <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher groupes, personnes..." className="w-full pl-10 pr-3 py-3 md:py-2.5 rounded-xl text-[14px] outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} /></div>
              <div className="grid grid-cols-1 gap-2">
                {groups.filter(g=>!search || g.name.toLowerCase().includes(search.toLowerCase())).slice(0,10).map(g => <div key={g.id} onClick={()=>handleSelectGroup(g)} className="p-3 rounded-[16px] border flex gap-3 cursor-pointer hover:scale-[1.01] transition-transform" style={{ background: COLORS.surface2, borderColor: COLORS.border }}><div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)` }}>{g.avatar_url ? <img src={g.avatar_url} className="w-full h-full object-cover" alt="" /> : g.name[0]}</div><div className="flex-1 min-w-0"><p className="font-bold text-[14px] truncate" style={{ color: COLORS.ivory }}>{g.name}</p><p className="text-[12px] line-clamp-1" style={{ color: COLORS.muted }}>{g.description||'Communauté Baaro'}</p><div className="flex gap-2 mt-1"><span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: COLORS.surface, color: COLORS.muted }}>{g.category||'bamako'}</span><span className="text-[10px] flex items-center gap-1" style={{ color: COLORS.muted }}><Users size={10} />{g.members?.length||0}</span></div></div></div>)}
              </div>
            </div>
          )}

          { (mobileView==='friends' || activeTab==='friends') && (
            <div className="p-2"><FriendRequests onOpenProfile={onOpenProfile} /><div className="border-t my-3" style={{ borderColor: COLORS.border }} /><FriendsTab onOpenProfile={onOpenProfile} /></div>
          )}
        </div>

        {/* Mobile bottom action for channels view */}
        {mobileView==='channels' && selectedGroup && (
          <div className="md:hidden p-3 border-t flex gap-2" style={{ borderColor: COLORS.border }}>
            <button onClick={()=>setShowCreateChannel(true)} className="flex-1 py-3 rounded-xl font-bold text-[13px] flex items-center justify-center gap-2" style={{ background: COLORS.surface2, color: COLORS.ivory }}><Plus size={16} /> Nouveau canal</button>
            <button onClick={()=>{if(selectedGroup.channels?.[0]) handleSelectChannel(selectedGroup.channels[0]);}} className="flex-1 py-3 rounded-xl font-bold text-[13px]" style={{ background: COLORS.gold, color: COLORS.bg }}>Ouvrir chat</button>
          </div>
        )}
      </div>

      {/* ===== CHAT ZONE ===== */}
      <div className={`${mobileView==='chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`} style={{ background: COLORS.bg }}>
        {!selectedChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center" style={{ color: COLORS.muted }}>
            <div className="w-20 h-20 rounded-[24px] flex items-center justify-center mb-4" style={{ background: COLORS.surface2 }}><MessageCircle size={32} className="opacity-30" /></div>
            <h3 className="font-bold text-[16px] mb-1" style={{ color: COLORS.ivory }}>Aucun canal sélectionné</h3>
            <p className="text-[13px] max-w-[280px]">Choisis un groupe puis un canal pour discuter</p>
            <button onClick={()=>setMobileView('groups')} className="md:hidden mt-6 px-6 py-3 rounded-full font-bold text-[13px]" style={{ background: COLORS.gold, color: COLORS.bg }}>Voir les groupes</button>
          </div>
        ) : selectedChannel.type==='voice' ? (
          <div className="flex-1 flex flex-col">
            <div className="h-14 px-4 flex items-center gap-2 border-b" style={{ borderColor: COLORS.border }}>
              <button onClick={()=>setMobileView('channels')} className="md:hidden p-2 -ml-1 rounded-xl" style={{ color: COLORS.ivory }}><ArrowLeft size={20} /></button>
              <Volume2 size={18} style={{ color: COLORS.teal }} /><h3 className="font-bold text-[14px]" style={{ color: COLORS.ivory }}>{selectedChannel.name}</h3>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
              <div className="grid grid-cols-3 gap-4">{(voiceParticipants||[]).map(p => <div key={p.id} className="flex flex-col items-center gap-2"><img src={p.avatar_url} className="w-16 h-16 rounded-full" alt="" /><span className="text-xs" style={{ color: COLORS.ivory }}>{p.display_name?.split(' ')[0]}</span></div>)}</div>
              <div className="flex gap-3">{!isJoined ? <button onClick={joinVoice} className="px-8 py-3 rounded-full font-bold flex items-center gap-2" style={{ background: COLORS.teal, color: COLORS.bg }}><Mic size={18} /> Rejoindre</button> : <button onClick={leaveVoice} className="px-8 py-3 rounded-full font-bold bg-red-500 text-white flex items-center gap-2"><MicOff size={18} /> Quitter</button>}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="h-14 px-4 flex items-center justify-between border-b shrink-0" style={{ borderColor: COLORS.border }}>
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={()=>setMobileView('channels')} className="md:hidden p-1.5 -ml-1 rounded-lg" style={{ color: COLORS.ivory }}><ArrowLeft size={20} /></button>
                <Hash size={16} style={{ color: COLORS.muted }} className="hidden md:block" />
                <h3 className="font-bold text-[15px] truncate" style={{ color: COLORS.ivory }}>{selectedChannel.name}</h3>
                <span className="hidden md:block text-[11px] truncate max-w-[200px] pl-2 ml-2 border-l" style={{ borderColor: COLORS.border, color: COLORS.muted }}>{selectedChannel.topic || selectedChannel.description || ''}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={()=>setShowMembers(!showMembers)} className="p-2 rounded-xl" style={{ background: COLORS.surface2, color: COLORS.muted }}><Users size={16} /></button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-1">
                  {messages.length===0 ? <div className="text-center py-20" style={{ color: COLORS.muted }}><Hash size={28} className="mx-auto mb-3 opacity-20" /><p className="font-bold text-[14px]" style={{ color: COLORS.ivory }}>Bienvenue dans #{selectedChannel.name}</p><p className="text-xs mt-1">Début de l'historique</p></div> : messages.map((m, idx) => {
                    const prev = messages[idx-1];
                    const showAvatar = !prev || prev.sender_id !== m.sender_id || (new Date(m.created_at) - new Date(prev.created_at) > 300000);
                    return <div key={m.id} className={`flex gap-2.5 px-2 py-1 rounded-xl hover:bg-white/[0.03] ${showAvatar ? 'mt-3' : ''}`}><div className="w-8 shrink-0">{showAvatar && <img src={m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.profiles?.display_name}`} className="w-8 h-8 rounded-full" alt="" />}</div><div className="flex-1 min-w-0">{showAvatar && <div className="flex items-baseline gap-2 flex-wrap"><span className="text-[13px] font-bold" style={{ color: COLORS.ivory }}>{m.profiles?.display_name || 'Membre'}</span><span className="text-[10px]" style={{ color: COLORS.muted }}>{new Date(m.created_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</span></div>}<p className="text-[14px] leading-6 break-words" style={{ color: COLORS.ivory }}>{m.text || m.content}</p></div></div>;
                  })}<div ref={messagesEndRef} />
                </div>
                <div className="p-2.5 border-t" style={{ borderColor: COLORS.border }}>
                  <div className="flex items-end gap-2 rounded-[24px] border px-3 py-1.5" style={{ background: COLORS.surface2, borderColor: COLORS.border }}>
                    <textarea value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter' && !e.shiftKey){e.preventDefault(); handleSendMessage();}}} placeholder={`Message #${selectedChannel.name}`} rows={1} className="flex-1 bg-transparent py-2.5 text-[15px] outline-none resize-none max-h-[100px]" style={{ color: COLORS.ivory }} />
                    <button onClick={handleSendMessage} disabled={!msgText.trim()} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40" style={{ background: msgText.trim() ? COLORS.gold : COLORS.surface, color: msgText.trim() ? COLORS.bg : COLORS.muted }}><Send size={16} /></button>
                  </div>
                </div>
              </div>

              {/* Members panel - slide on mobile */}
              {showMembers && (
                <div className="w-[260px] hidden lg:flex flex-col border-l p-3 gap-3 overflow-y-auto" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
                  <h4 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: COLORS.muted }}>Membres — {selectedGroup?.members?.length||0}</h4>
                  {(selectedGroup?.members||[]).map(m => { const prof = m.profiles || m; const uid = m.user_id || m.id; return <div key={uid} className="flex items-center gap-2"><img src={prof?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${prof?.display_name}`} className="w-7 h-7 rounded-full" alt="" /><span className="text-[13px] truncate" style={{ color: COLORS.ivory }}>{prof?.display_name}</span></div>; })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile bottom nav */}
      <div className="flex md:hidden h-[64px] border-t items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] shrink-0" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        {[
          {id:'groups', icon: Home, label: 'Groupes'},
          {id:'channels', icon: Hash, label: 'Canaux'},
          {id:'chat', icon: MessageCircle, label: 'Chat', badge: messages.length},
          {id:'discover', icon: Compass, label: 'Découvrir'},
          {id:'friends', icon: Users, label: 'Amis'},
        ].map(tab => {
          const Icon = tab.icon; const active = mobileView===tab.id;
          return <button key={tab.id} onClick={()=>setMobileView(tab.id)} className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl relative"><div className={`p-1.5 rounded-xl ${active ? '' : ''}`} style={{ background: active ? COLORS.gold : 'transparent', color: active ? COLORS.bg : COLORS.muted }}><Icon size={20} />{tab.badge && mobileView!=='chat' && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white">{tab.badge>9?'9+':tab.badge}</span>}</div><span className="text-[10px] font-medium" style={{ color: active ? COLORS.gold : COLORS.muted }}>{tab.label}</span></button>;
        })}
      </div>

      {/* Modals */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[100] p-0 md:p-4" onClick={()=>setShowCreateGroup(false)}>
          <div className="w-full md:max-w-[440px] rounded-t-[28px] md:rounded-[20px] border shadow-2xl p-6 max-h-[92dvh] overflow-y-auto" style={{ background: COLORS.surface, borderColor: COLORS.border }} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5 md:hidden" style={{ background: COLORS.border }} />
            <h3 className="font-bold text-[18px] mb-1" style={{ color: COLORS.ivory }}>Créer un groupe</h3><p className="text-[13px] mb-5" style={{ color: COLORS.muted }}>Rassemble ta communauté à Bamako</p>
            <input value={newGroup.name} onChange={e=>setNewGroup({...newGroup, name: e.target.value})} placeholder="Nom du groupe" className="w-full p-4 rounded-xl mb-3 text-[15px] outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} autoFocus />
            <textarea value={newGroup.description} onChange={e=>setNewGroup({...newGroup, description: e.target.value})} placeholder="Description courte..." rows={2} className="w-full p-4 rounded-xl mb-3 text-[15px] outline-none border resize-none" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
            <div className="flex gap-2 flex-wrap mb-5">{CATEGORIES.slice(1).map(c=><button key={c.id} onClick={()=>setNewGroup({...newGroup, category: c.id})} className="px-4 py-2 rounded-full text-[13px] font-bold border" style={{ background: newGroup.category===c.id?COLORS.gold:COLORS.surface2, color: newGroup.category===c.id?COLORS.bg:COLORS.muted, borderColor: newGroup.category===c.id?COLORS.gold:COLORS.border }}>{c.label}</button>)}</div>
            <div className="flex gap-2"><button onClick={()=>setShowCreateGroup(false)} className="flex-1 py-4 rounded-xl font-bold" style={{ background: COLORS.surface2, color: COLORS.muted }}>Annuler</button><button onClick={handleCreateGroup} disabled={!newGroup.name.trim()} className="flex-1 py-4 rounded-xl font-bold disabled:opacity-50" style={{ background: COLORS.gold, color: COLORS.bg }}>Créer</button></div>
          </div>
        </div>
      )}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end md:items-center justify-center z-[100] p-0 md:p-4" onClick={()=>setShowCreateChannel(false)}>
          <div className="w-full md:max-w-[380px] rounded-t-[28px] md:rounded-[20px] border shadow-2xl p-6" style={{ background: COLORS.surface, borderColor: COLORS.border }} onClick={e=>e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full mx-auto mb-5 md:hidden" style={{ background: COLORS.border }} />
            <h3 className="font-bold mb-4" style={{ color: COLORS.ivory }}>Nouveau canal dans {selectedGroup?.name}</h3>
            <input value={newChannel.name} onChange={e=>setNewChannel({...newChannel, name: e.target.value})} placeholder="nom-du-canal" className="w-full p-4 rounded-xl mb-3 text-[15px] outline-none border" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} autoFocus />
            <div className="flex gap-2 mb-6"><button onClick={()=>setNewChannel({...newChannel, type:'text'})} className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2" style={{ background: newChannel.type==='text'?COLORS.gold:COLORS.surface2, color: newChannel.type==='text'?COLORS.bg:COLORS.muted }}><Hash size={16} /> Texte</button><button onClick={()=>setNewChannel({...newChannel, type:'voice'})} className="flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2" style={{ background: newChannel.type==='voice'?COLORS.teal:COLORS.surface2, color: newChannel.type==='voice'?COLORS.bg:COLORS.muted }}><Volume2 size={16} /> Vocal</button></div>
            <div className="flex gap-2"><button onClick={()=>setShowCreateChannel(false)} className="flex-1 py-4 rounded-xl font-bold" style={{ background: COLORS.surface2, color: COLORS.muted }}>Annuler</button><button onClick={handleCreateChannel} className="flex-1 py-4 rounded-xl font-bold" style={{ background: COLORS.gold, color: COLORS.bg }}>Créer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
