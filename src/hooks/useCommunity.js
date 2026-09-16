import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export function useCommunity(id) {
  const [friends, setFriends] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    
    const [{ data: friendsData }, { data: usersData }, { data: commData }] = await Promise.all([
      supabase.rpc('get_user_friends', { id_param: id }),
      supabase.from('profiles').select('id, display_name, handle, avatar_url, country').limit(30),
      supabase.rpc('get_my_community', { id_param: id })
    ])

    if (friendsData?.length) {
      // ✅ Utilise 'id' si ton RPC retourne l'ID directement, ou 'friend_id' si c'est le nom de la colonne du RPC
      const ids = friendsData.map(f => f.id || f.friend_id) 
      const { data } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').in('id', ids)
      setFriends(data || [])
    } else {
      setFriends([])
    }

    setAllUsers(usersData || [])
    setGroups(commData?.groups || [])
    setLoading(false)
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const createGroup = async ({ name, description, is_private }) => {
    // ✅ owner_id est un rôle spécifique, c'est OK.
    const { data: g } = await supabase.from('groups').insert({ name, description, is_private, owner_id: id }).select().single()
    
    // ✅ CORRECTION : 'user_id' remplacé par 'id' pour la référence utilisateur
    await supabase.from('group_members').insert({ group_id: g.id, id: id, role: 'owner' })
    
    await supabase.from('channels').insert([
      { group_id: g.id, name: 'général', type: 'text' },
      { group_id: g.id, name: 'Vocal Général', type: 'voice' }
    ])
    await loadAll()
    return g
  }

  const createChannel = async (groupId, payload) => { 
    await supabase.from('channels').insert({ group_id: groupId, ...payload })
    await loadAll() 
  }

  const deleteChannel = async (channelId) => { 
    await supabase.from('channels').delete().eq('id', channelId)
    await loadAll() 
  }

  // ✅ CORRECTION : 'user_id' remplacé par 'id'
  const banMember = async (groupId, targetId) => { 
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('id', targetId)
    await loadAll() 
  }

  // ✅ CORRECTION : 'user_id' remplacé par 'id'
  const updateMemberRole = async (groupId, targetId, role) => { 
    await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('id', targetId)
    await loadAll() 
  }

  const loadUsers = async (search = '') => {
    let q = supabase.from('profiles').select('id, display_name, handle, avatar_url, country').limit(30)
    if (search) q = q.or(`display_name.ilike.%${search}%,handle.ilike.%${search}%`)
    const { data } = await q
    setAllUsers(data || [])
  }

  return { friends, allUsers, groups, loading, loadAll, createGroup, createChannel, deleteChannel, banMember, updateMemberRole, loadUsers }
}

export function useChannelMessages(channelId) {
  const [messages, setMessages] = useState([])
  
  useEffect(() => {
    if (!channelId) return
    
    // Charge seulement quand tu cliques sur le canal -> 0 API au démarrage
    supabase.from('channel_messages')
      .select('*, profiles(display_name, handle, avatar_url)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => setMessages(data || []))
      
    const ch = supabase.channel(`ch-${channelId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'channel_messages', 
        filter: `channel_id=eq.${channelId}` 
      }, p => setMessages(prev => [...prev, p.new]))
      .subscribe()
      
    return () => supabase.removeChannel(ch)
  }, [channelId])

  // ✅ sender_id est un nom de colonne spécifique (comme author_id), c'est OK.
  const sendMessage = async (text, senderId) => { 
    await supabase.from('channel_messages').insert({ channel_id: channelId, sender_id: senderId, text }) 
  }
  
  return { messages, sendMessage }
}

export function useVoiceChannel(channelId, id) {
  const [participants, setParticipants] = useState([])
  const [isJoined, setIsJoined] = useState(false)

  useEffect(() => { 
    if (!channelId) return
    supabase.from('voice_participants')
      .select('*, profiles(display_name, handle, avatar_url)')
      .eq('channel_id', channelId)
      .then(({ data }) => setParticipants(data || [])) 
  }, [channelId])

  // ✅ CORRECTION : 'user_id' remplacé par 'id'
  const joinVoice = async () => { 
    await supabase.from('voice_participants').upsert({ channel_id: channelId, id: id })
    setIsJoined(true) 
  }

  // ✅ CORRECTION : 'user_id' remplacé par 'id'
  const leaveVoice = async () => { 
    await supabase.from('voice_participants').delete().eq('channel_id', channelId).eq('id', id)
    setIsJoined(false) 
  }

  return { participants, isJoined, joinVoice, leaveVoice }
}
