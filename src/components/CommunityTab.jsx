import { useState } from 'react'
import { useCommunity, useChannelMessages, useVoiceChannel } from '../hooks/useCommunity'
import FollowButton from '../features/friends/FollowButton.jsx'

export default function CommunityTab({ id }) { // <- plus userId, juste id
  const { friends, allUsers, groups, createGroup, createChannel, deleteChannel, banMember, updateMemberRole, loadUsers } = useCommunity(id)
  const [activeTab, setActiveTab] = useState('groups')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroup, setNewGroup] = useState({ name: '', description: '', is_private: false })
  const [newChannelName, setNewChannelName] = useState('')
  const [search, setSearch] = useState('')
  const [showMembers, setShowMembers] = useState(true)

  const { messages, sendMessage } = useChannelMessages(selectedChannel?.id)
  const { participants: voiceParticipants, isJoined, joinVoice, leaveVoice } = useVoiceChannel(selectedChannel?.id, id)
  const [msgText, setMsgText] = useState('')

  const myRole = selectedGroup?.members?.find(m => m.user_id === id)?.role || selectedGroup?.myRole
  const isAdmin = ['owner','admin'].includes(myRole)

  const handleCreateGroup = async () => {
    if(!newGroup.name) return
    const g = await createGroup(newGroup)
    setShowCreateGroup(false); setNewGroup({ name:'', description:'', is_private:false }); setSelectedGroup(g)
  }

  return (
    <div className="flex h-[calc(100vh-70px)] bg-[#0A0A0A] text-white">
      <div className="w-[72px] bg-[#0F0F0F] border-r border-white/5 flex flex-col items-center py-3 gap-3">
        {groups.map(g => (
          <button key={g.id} onClick={()=>{setSelectedGroup(g); setSelectedChannel(g.channels?.[0]||null)}} className={`w-12 h-12 rounded-[18px] font-bold ${selectedGroup?.id===g.id? 'bg-[#FF6B00]' : 'bg-[#1A1A1A]'}`}>{g.name[0]?.toUpperCase()}</button>
        ))}
        <button onClick={()=>setShowCreateGroup(true)} className="w-12 h-12 rounded-[18px] bg-[#1A1A1A]">+</button>
      </div>

      <div className="w-64 bg-[#111] border-r border-white/10 flex flex-col">
        <div className="h-12 px-4 flex items-center font-bold border-b border-white/10">{selectedGroup?.name || 'Communauté'}</div>
        <div className="flex gap-1 p-2">
          <button onClick={()=>setActiveTab('groups')} className={`flex-1 py-1.5 rounded text-xs ${activeTab==='groups'?'bg-white/15':''}`}>Canaux</button>
          <button onClick={()=>setActiveTab('friends')} className={`flex-1 py-1.5 rounded text-xs ${activeTab==='friends'?'bg-white/15':''}`}>Amis</button>
          <button onClick={()=>setActiveTab('discover')} className={`flex-1 py-1.5 rounded text-xs ${activeTab==='discover'?'bg-white/15':''}`}>Découvrir</button>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {activeTab==='groups' && selectedGroup && (
            <>
              {selectedGroup.channels?.filter(c=>c.type!=='voice').map(ch => (
                <div key={ch.id} onClick={()=>setSelectedChannel(ch)} className={`px-2 py-1.5 rounded text-sm cursor-pointer ${selectedChannel?.id===ch.id?'bg-white/10':''}`}># {ch.name}</div>
              ))}
              {selectedGroup.channels?.filter(c=>c.type==='voice').map(ch => (
                <div key={ch.id} onClick={()=>setSelectedChannel(ch)} className="px-2 py-1.5 text-sm cursor-pointer">🔊 {ch.name}</div>
              ))}
              {showMembers && selectedGroup.members?.map(m => (
                <div key={m.user_id} className="flex items-center gap-2 px-2 py-1 text-xs">
                  <img src={m.profiles?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.profiles?.display_name}`} className="w-6 h-6 rounded-full" />
                  <span className="flex-1 truncate">{m.profiles?.display_name}</span>
                  {isAdmin && m.user_id!==id && <button onClick={()=>banMember(selectedGroup.id, m.user_id)} className="text-red-400">🚫</button>}
                </div>
              ))}
            </>
          )}
          {activeTab==='discover' && allUsers.map(u => (
            <div key={u.id} className="flex items-center gap-2 py-1.5 text-sm">
              <img src={u.avatar_url} className="w-7 h-7 rounded-full" /><span>{u.display_name}</span>
              {u.id!==id && <FollowButton targetId={u.id} />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[#151515]">
        {!selectedChannel? <div className="m-auto text-white/30">Choisis un canal</div> : selectedChannel.type==='voice'? (
          <div className="m-auto text-center">{!isJoined? <button onClick={joinVoice} className="bg-green-600 px-6 py-2 rounded-full">Rejoindre vocal</button> : <button onClick={leaveVoice} className="bg-red-600 px-6 py-2 rounded-full">Quitter</button>}</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">{messages.map(m=><div key={m.id} className="flex gap-2"><img src={m.profiles?.avatar_url} className="w-7 h-7 rounded-full"/><div><div className="text-xs font-bold">{m.profiles?.display_name}</div><div className="text-sm">{m.text}</div></div></div>)}</div>
            <div className="p-3"><div className="bg-black rounded-full flex"><input value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){sendMessage(msgText, id); setMsgText('')}}} placeholder="Message" className="flex-1 bg-transparent px-4 py-3 text-sm outline-none"/><button onClick={()=>{sendMessage(msgText, id); setMsgText('')}} className="bg-[#FF6B00] w-8 h-8 rounded-full mr-1 self-center">↑</button></div></div>
          </>
        )}
      </div>

      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"><div className="bg-[#1A1A1A] p-6 rounded-2xl w-full max-w-sm"><input value={newGroup.name} onChange={e=>setNewGroup({...newGroup, name:e.target.value})} placeholder="Nom groupe" className="w-full bg-black/50 p-3 rounded-xl mb-3 text-sm"/><div className="flex justify-end gap-2"><button onClick={()=>setShowCreateGroup(false)}>Annuler</button><button onClick={handleCreateGroup} className="bg-[#FF6B00] px-5 py-2 rounded-full">Créer</button></div></div></div>
      )}
    </div>
  )
}
