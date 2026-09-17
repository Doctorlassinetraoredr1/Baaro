import { useState, useRef, useEffect } from 'react';
import { 
  Hash, 
  Mic, 
  MicOff, 
  Send, 
  Plus, 
  Users, 
  Search, 
  MoreVertical, 
  ShieldAlert,
  MessageSquare
} from 'lucide-react';
import { useCommunity, useChannelMessages, useVoiceChannel } from '../hooks/useCommunity';
import { FollowButton, FriendsTab, FriendRequests } from '../features/friends/index.js';
import { COLORS } from '../theme.js';

export default function CommunityTab({ id, onOpenProfile }) {
  const { friends, allUsers, groups, createGroup, createChannel, deleteChannel, banMember, updateMemberRole, loadUsers, loading } = useCommunity(id);
  
  const [activeTab, setActiveTab] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', is_private: false });
  const [search, setSearch] = useState('');
  const [showMembers, setShowMembers] = useState(true);

  const { messages, sendMessage } = useChannelMessages(selectedChannel?.id);
  const { participants: voiceParticipants, isJoined, joinVoice, leaveVoice } = useVoiceChannel(selectedChannel?.id, id);
  const [msgText, setMsgText] = useState('');
  const messagesEndRef = useRef(null);

  const myRole = selectedGroup?.members?.find(m => m.id === id)?.role || selectedGroup?.myRole;
  const isAdmin = ['owner', 'admin'].includes(myRole);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) return;
    try {
      const g = await createGroup(newGroup);
      setShowCreateGroup(false);
      setNewGroup({ name: '', description: '', is_private: false });
      setSelectedGroup(g);
    } catch (error) {
      console.error("Erreur création groupe:", error);
    }
  };

  const handleSendMessage = () => {
    if (!msgText.trim() || !id) return;
    sendMessage(msgText, id);
    setMsgText('');
  };

  const handleBanMember = async (groupId, memberId) => {
    if (!window.confirm("Bannir ce membre du groupe ?")) return;
    try {
      await banMember(groupId, memberId);
    } catch (error) {
      console.error("Erreur banissement:", error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-70px)] w-full" style={{ background: COLORS.bg, color: COLORS.ivory }}>
      
      {/* 1. Sidebar Gauche : Liste des Groupes */}
      <div className="w-[72px] flex flex-col items-center py-4 gap-3 border-r" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        {groups.map(g => (
          <button 
            key={g.id} 
            onClick={() => { setSelectedGroup(g); setSelectedChannel(g.channels?.[0] || null); }} 
            className={`w-12 h-12 rounded-[18px] font-bold text-lg transition-all duration-200 hover:rounded-xl ${selectedGroup?.id === g.id ? 'scale-110' : 'grayscale hover:grayscale-0'}`}
            style={{ 
              background: selectedGroup?.id === g.id ? COLORS.gold : COLORS.surface2,
              color: selectedGroup?.id === g.id ? COLORS.bg : COLORS.muted
            }}
          >
            {g.name[0]?.toUpperCase()}
          </button>
        ))}
        <button 
          onClick={() => setShowCreateGroup(true)} 
          className="w-12 h-12 rounded-[18px] flex items-center justify-center transition-all hover:rounded-xl hover:bg-white/10"
          style={{ background: COLORS.surface2, color: COLORS.teal }}
        >
          <Plus size={24} />
        </button>
      </div>

      {/* 2. Sidebar Milieu : Canaux, Membres, Amis */}
      <div className="w-64 flex flex-col border-r" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <div className="h-14 px-4 flex items-center font-bold border-b shadow-sm" style={{ borderColor: COLORS.border }}>
          {selectedGroup?.name || 'Communauté'}
        </div>
        
        <div className="flex gap-1 p-2 border-b" style={{ borderColor: COLORS.border }}>
          {['groups', 'friends', 'discover'].map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)} 
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${activeTab === tab ? 'bg-white/10' : 'hover:bg-white/5'}`}
              style={{ color: activeTab === tab ? COLORS.gold : COLORS.muted }}
            >
              {tab === 'groups' ? 'Canaux' : tab === 'friends' ? 'Amis' : 'Découvrir'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
          {/* ONGLET GROUPES */}
          {activeTab === 'groups' && selectedGroup && (
            <>
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase px-2 mb-1" style={{ color: COLORS.muted }}>Canaux Texte</p>
                {selectedGroup.channels?.filter(c => c.type !== 'voice').map(ch => (
                  <button 
                    key={ch.id} 
                    onClick={() => setSelectedChannel(ch)} 
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${selectedChannel?.id === ch.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    style={{ color: selectedChannel?.id === ch.id ? COLORS.ivory : COLORS.muted }}
                  >
                    <Hash size={16} /> {ch.name}
                  </button>
                ))}
              </div>
              
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase px-2 mb-1" style={{ color: COLORS.muted }}>Canaux Vocaux</p>
                {selectedGroup.channels?.filter(c => c.type === 'voice').map(ch => (
                  <button 
                    key={ch.id} 
                    onClick={() => setSelectedChannel(ch)} 
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
                    style={{ color: COLORS.muted }}
                  >
                    <Mic size={16} /> {ch.name}
                  </button>
                ))}
              </div>

              {showMembers && selectedGroup.members && (
                <div>
                  <div className="flex items-center justify-between px-2 mb-1">
                    <p className="text-[10px] font-bold uppercase" style={{ color: COLORS.muted }}>Membres — {selectedGroup.members.length}</p>
                    <button onClick={() => setShowMembers(false)} style={{ color: COLORS.muted }}><MoreVertical size={14} /></button>
                  </div>
                  {selectedGroup.members.map(m => (
                    <div key={m.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 group">
                      <img 
                        src={m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.profiles?.display_name || 'U'}`} 
                        className="w-7 h-7 rounded-full border" 
                        style={{ borderColor: COLORS.border }}
                        alt=""
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: COLORS.ivory }}>{m.profiles?.display_name || 'Membre'}</p>
                        <p className="text-[10px] truncate" style={{ color: m.id === id ? COLORS.teal : COLORS.muted }}>
                          {m.id === id ? 'Vous' : (m.role === 'owner' ? 'Propriétaire' : m.role === 'admin' ? 'Admin' : 'Membre')}
                        </p>
                      </div>
                      {isAdmin && m.id !== id && (
                        <button 
                          onClick={() => handleBanMember(selectedGroup.id, m.id)} 
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 transition-all"
                          style={{ color: '#ef4444' }}
                          title="Bannir"
                        >
                          <ShieldAlert size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ✅ ONGLET AMIS */}
          {activeTab === 'friends' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <FriendRequests onOpenProfile={onOpenProfile} />
                <div className="border-t my-4 mx-2" style={{ borderColor: COLORS.border }} />
                <FriendsTab onOpenProfile={onOpenProfile} />
              </div>
            </div>
          )}

          {/* ONGLET DÉCOUVRIR */}
          {activeTab === 'discover' && (
            <div className="space-y-1">
              <div className="relative mb-2 px-2">
                <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..." 
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs outline-none border"
                  style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                />
              </div>
              {allUsers.filter(u => u.display_name?.toLowerCase().includes(search.toLowerCase())).map(u => (
                <div key={u.id} className="flex items-center justify-between gap-2 py-2 px-2 rounded-lg hover:bg-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.display_name}`} className="w-7 h-7 rounded-full" alt="" />
                    <span className="text-xs font-semibold truncate" style={{ color: COLORS.ivory }}>{u.display_name}</span>
                  </div>
                  {u.id !== id && <FollowButton targetId={u.id} currentUserId={id} />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Zone Principale : Chat ou Vocal */}
      <div className="flex-1 flex flex-col" style={{ background: COLORS.bg }}>
        {!selectedChannel ? (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ color: COLORS.muted }}>
            <MessageSquare size={48} className="mb-4 opacity-20" />
            <p className="text-sm">Sélectionne un canal pour commencer</p>
          </div>
        ) : selectedChannel.type === 'voice' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-2" style={{ background: COLORS.surface2 }}>
              <Mic size={40} style={{ color: isJoined ? COLORS.teal : COLORS.muted }} />
            </div>
            <h3 className="text-lg font-bold" style={{ color: COLORS.ivory }}>{selectedChannel.name}</h3>
            <p className="text-xs mb-4" style={{ color: COLORS.muted }}>{voiceParticipants?.length || 0} participant(s)</p>
            
            {!isJoined ? (
              <button onClick={joinVoice} className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-transform active:scale-95" style={{ background: COLORS.teal, color: COLORS.bg }}>
                <Mic size={18} /> Rejoindre le vocal
              </button>
            ) : (
              <button onClick={leaveVoice} className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-transform active:scale-95" style={{ background: '#ef4444', color: '#fff' }}>
                <MicOff size={18} /> Quitter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center py-10" style={{ color: COLORS.muted }}>
                  <p className="text-sm">Aucun message pour le moment.</p>
                  <p className="text-xs mt-1">Sois le premier à écrire dans #{selectedChannel.name} !</p>
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className="flex gap-3 group hover:bg-white/5 p-2 rounded-lg transition-colors">
                  <img 
                    src={m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.profiles?.display_name}`} 
                    className="w-9 h-9 rounded-full border flex-shrink-0" 
                    style={{ borderColor: COLORS.border }}
                    alt=""
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold" style={{ color: COLORS.ivory }}>{m.profiles?.display_name || 'Membre'}</span>
                      <span className="text-[10px]" style={{ color: COLORS.muted }}>
                        {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed mt-0.5" style={{ color: COLORS.ivory }}>{m.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 border-t" style={{ borderColor: COLORS.border }}>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-1 transition-colors focus-within:border-amber-400/50" style={{ background: COLORS.surface2, borderColor: COLORS.border }}>
                <input 
                  value={msgText} 
                  onChange={e => setMsgText(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                  placeholder={`Message dans #${selectedChannel.name}`} 
                  className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-gray-500"
                  style={{ color: COLORS.ivory }}
                />
                <button 
                  onClick={handleSendMessage} 
                  disabled={!msgText.trim()}
                  className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10"
                  style={{ color: COLORS.gold }}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Création de Groupe */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateGroup(false)}>
          <div 
            className="w-full max-w-sm rounded-2xl border shadow-2xl p-6" 
            style={{ background: COLORS.surface, borderColor: COLORS.borderGold }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold mb-4" style={{ color: COLORS.ivory }}>Créer un nouveau groupe</h3>
            <input 
              value={newGroup.name} 
              onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} 
              placeholder="Nom du groupe" 
              className="w-full p-3 rounded-xl mb-3 text-sm outline-none border focus:border-amber-400/50 transition-colors"
              style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
              autoFocus
            />
            <textarea 
              value={newGroup.description} 
              onChange={e => setNewGroup({ ...newGroup, description: e.target.value })} 
              placeholder="Description (optionnel)" 
              rows={3}
              className="w-full p-3 rounded-xl mb-4 text-sm outline-none border focus:border-amber-400/50 transition-colors resize-none"
              style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowCreateGroup(false)} 
                className="px-4 py-2 rounded-lg text-xs font-bold hover:bg-white/5 transition-colors"
                style={{ color: COLORS.muted }}
              >
                Annuler
              </button>
              <button 
                onClick={handleCreateGroup} 
                disabled={!newGroup.name.trim()}
                className="px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                style={{ background: COLORS.gold, color: COLORS.bg }}
              >
                Créer le groupe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
