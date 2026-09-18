import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export function useCommunity(id) {
  const [friends, setFriends] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  const enrichGroups = async (rawGroups) => {
    if (!rawGroups?.length) return []
    const groupIds = rawGroups.map(g => g.id)
    
    // Fetch members + profiles + channels en 2 requêtes parallèles
    const [{ data: members }, { data: channels }] = await Promise.all([
      supabase.from('group_members').select('group_id, user_id, role, joined_at, profiles:profiles!group_members_user_id_fkey(id, display_name, handle, avatar_url, is_online)').in('group_id', groupIds),
      supabase.from('channels').select('*').in('group_id', groupIds).order('created_at', { ascending: true })
    ])

    // Si FK profiles n'existe pas, fallback sans join
    let membersData = members || []
    if (!membersData.length) {
      const { data: rawMembers } = await supabase.from('group_members').select('*').in('group_id', groupIds)
      if (rawMembers?.length) {
        const userIds = [...new Set(rawMembers.map(m => m.user_id))]
        const { data: profs } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').in('id', userIds)
        const profMap = Object.fromEntries((profs||[]).map(p => [p.id, p]))
        membersData = rawMembers.map(m => ({ ...m, profiles: profMap[m.user_id] || { display_name: 'Membre' } }))
      }
    }

    return rawGroups.map(g => ({
      ...g,
      channels: (channels||[]).filter(c => c.group_id === g.id),
      members: membersData.filter(m => m.group_id === g.id)
    }))
  }

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [{ data: friendsData }, { data: usersData }, { data: commData }] = await Promise.all([
        supabase.rpc('get_user_friends', { user_id: id }).catch(()=>({ data: [] })),
        supabase.from('profiles').select('id, display_name, handle, avatar_url, country').limit(30),
        supabase.rpc('get_my_community', { id_param: id }).catch(()=>({ data: null }))
      ])

      // Friends
      if (friendsData?.length) {
        const ids = friendsData.map(f => f.friend_id || f.id).filter(Boolean)
        const { data } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').in('id', ids)
        setFriends(data || [])
      } else {
        setFriends([])
      }

      setAllUsers(usersData || [])

      // Groups - RPC ou fallback manuel
      let rawGroups = commData?.groups || commData || []
      if (!rawGroups.length) {
        // Fallback: groups où je suis owner ou membre
        const { data: memberGroups } = await supabase.from('group_members').select('group_id').eq('user_id', id)
        const ids = [...new Set([...(memberGroups||[]).map(m => m.group_id)])]
        let q = supabase.from('groups').select('*').order('created_at', { ascending: false })
        if (ids.length) {
          q = q.or(`owner_id.eq.${id},id.in.(${ids.join(',')})`)
        } else {
          q = q.eq('owner_id', id)
        }
        const { data: manualGroups } = await q
        rawGroups = manualGroups || []
      }

      const enriched = await enrichGroups(rawGroups)
      setGroups(enriched)
    } catch (err) {
      console.error('Erreur loadAll:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadAll() }, [loadAll])

  const createGroup = async ({ name, description, is_public, is_private, category, type }) => {
    // Compatibilité: si is_private fourni, on inverse en is_public
    let finalIsPublic = true
    if (typeof is_public === 'boolean') finalIsPublic = is_public
    else if (typeof is_private === 'boolean') finalIsPublic = !is_private

    const payload = {
      name: name.trim(),
      description: description?.trim() || null,
      is_public: finalIsPublic,
      owner_id: id,
      category: category || 'bamako',
      type: type || 'community'
    }

    // On n'envoie que les colonnes qui existent vraiment (safe)
    if (payload.category === undefined) delete payload.category

    const { data: g, error } = await supabase.from('groups').insert(payload).select().single()
    if (error) {
      console.error('Erreur creation groupe:', error)
      throw error
    }

    // IMPORTANT: user_id et pas id (ton bug)
    await supabase.from('group_members').insert({ group_id: g.id, user_id: id, role: 'owner' })

    // Canaux par défaut
    await supabase.from('channels').insert([
      { group_id: g.id, name: 'general', type: 'text', description: 'Discussions generales' },
      { group_id: g.id, name: 'Vocal General', type: 'voice' }
    ])

    await loadAll()
    return { ...g, channels: [], members: [] }
  }

  const createChannel = async (groupId, payload) => {
    const { data, error } = await supabase.from('channels').insert({ group_id: groupId, name: payload.name.trim(), type: payload.type || 'text', description: payload.topic || payload.description || null }).select().single()
    if (error) throw error
    await loadAll()
    return data
  }

  const deleteChannel = async (channelId) => {
    await supabase.from('channels').delete().eq('id', channelId)
    await loadAll()
  }

  const banMember = async (groupId, targetId) => {
    // FIX: user_id et pas id
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', targetId)
    await loadAll()
  }

  const updateMemberRole = async (groupId, targetId, role) => {
    await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', targetId)
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
    let isMounted = true

    const fetchMessages = async () => {
      const { data, error } = await supabase.from('channel_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(80)
      if (error) { console.error('Messages error:', error); return }
      if (!isMounted) return
      if (!data?.length) { setMessages([]); return }

      // Enrichir avec profiles
      const senderIds = [...new Set(data.map(m => m.sender_id).filter(Boolean))]
      const { data: profs } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').in('id', senderIds)
      const profMap = Object.fromEntries((profs||[]).map(p => [p.id, p]))
      setMessages(data.map(m => ({ ...m, profiles: profMap[m.sender_id] || { display_name: 'Membre' } })))
    }

    fetchMessages()

    const ch = supabase.channel(`ch-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` }, async (payload) => {
        const newMsg = payload.new
        const { data: prof } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').eq('id', newMsg.sender_id).single()
        setMessages(prev => [...prev, { ...newMsg, profiles: prof || { display_name: 'Membre' } }])
      })
      .subscribe()

    return () => { isMounted = false; supabase.removeChannel(ch) }
  }, [channelId])

  const sendMessage = async (text, senderId) => {
    if (!text?.trim()) return
    await supabase.from('channel_messages').insert({ channel_id: channelId, sender_id: senderId, text: text.trim() })
  }

  return { messages, sendMessage }
}

export function useVoiceChannel(channelId, userId) {
  const [participants, setParticipants] = useState([])
  const [isJoined, setIsJoined] = useState(false)

  useEffect(() => {
    if (!channelId) return
    // Table voice_participants peut ne pas exister -> on ignore silencieusement
    supabase.from('voice_participants').select('*, profiles:profiles!voice_participants_id_fkey(id, display_name, handle, avatar_url)').eq('channel_id', channelId).then(({ data, error }) => {
      if (!error) setParticipants(data || [])
    }).catch(()=>{})
  }, [channelId])

  const joinVoice = async () => {
    try {
      await supabase.from('voice_participants').upsert({ channel_id: channelId, id: userId }, { onConflict: 'channel_id,id' })
      setIsJoined(true)
    } catch (e) { console.log('voice join fallback, pas de table'); setIsJoined(true) }
  }

  const leaveVoice = async () => {
    try {
      await supabase.from('voice_participants').delete().eq('channel_id', channelId).eq('id', userId)
    } catch {}
    setIsJoined(false)
  }

  return { participants, isJoined, joinVoice, leaveVoice }
}
