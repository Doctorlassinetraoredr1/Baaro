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
    try {
      const [{ data: membersRaw }, { data: channels }] = await Promise.all([
        supabase.from('group_members').select('*').in('group_id', groupIds),
        supabase.from('channels').select('*').in('group_id', groupIds).order('created_at', { ascending: true })
      ])
      let membersData = membersRaw || []
      if (membersData.length) {
        const userIds = [...new Set(membersData.map(m => m.user_id).filter(Boolean))]
        if (userIds.length) {
          const { data: profs } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').in('id', userIds)
          const profMap = Object.fromEntries((profs||[]).map(p => [p.id, p]))
          membersData = membersData.map(m => ({ ...m, profiles: profMap[m.user_id] || { display_name: 'Membre', avatar_url: null } }))
        }
      }
      return rawGroups.map(g => ({
        ...g,
        channels: (channels||[]).filter(c => c.group_id === g.id),
        members: membersData.filter(m => m.group_id === g.id)
      }))
    } catch (e) {
      console.error('enrichGroups error', e)
      return rawGroups.map(g => ({ ...g, channels: [], members: [] }))
    }
  }

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [{ data: friendsData }, { data: usersData }] = await Promise.all([
        supabase.rpc('get_user_friends', { user_id: id }).catch(()=>({ data: [] })),
        supabase.from('profiles').select('id, display_name, handle, avatar_url, country, created_at').order('created_at', { ascending: false }).limit(50)
      ])

      if (friendsData?.length) {
        const ids = friendsData.map(f => f.friend_id || f.id).filter(Boolean)
        if (ids.length) {
          const { data } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').in('id', ids)
          setFriends(data || [])
        } else setFriends([])
      } else setFriends([])

      setAllUsers(usersData || [])

      // FIX: récupérer TOUS les groupes publics + mes groupes, pas seulement owner
      let rawGroups = []
      try {
        const { data: rpcData } = await supabase.rpc('get_my_community', { id_param: id })
        rawGroups = rpcData?.groups || rpcData || []
      } catch {}

      if (!rawGroups.length) {
        // 1) Mes groupes (owner ou member)
        const { data: memberGroups } = await supabase.from('group_members').select('group_id').eq('user_id', id)
        const myGroupIds = [...new Set((memberGroups||[]).map(m => m.group_id))]
        // 2) Tous les groupes publics + mes groupes privés
        let q = supabase.from('groups').select('*').order('created_at', { ascending: false }).limit(100)
        if (myGroupIds.length) {
          // owner_id = moi OU id in myGroupIds OU is_public = true
          q = q.or(`owner_id.eq.${id},id.in.(${myGroupIds.join(',')}),is_public.eq.true`)
        } else {
          q = q.or(`owner_id.eq.${id},is_public.eq.true`)
        }
        const { data: allGroups, error } = await q
        if (error) {
          // Fallback ultime sans or si erreur syntaxe
          const { data: fallback } = await supabase.from('groups').select('*').order('created_at', { ascending: false }).limit(100)
          rawGroups = fallback || []
        } else {
          rawGroups = allGroups || []
        }
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
    if (!name?.trim()) throw new Error('Nom requis')
    let finalIsPublic = true
    if (typeof is_public === 'boolean') finalIsPublic = is_public
    else if (typeof is_private === 'boolean') finalIsPublic = !is_private

    // Payload STRICT avec seulement colonnes existantes
    const payload = {
      name: name.trim(),
      description: description?.trim() || null,
      is_public: finalIsPublic,
      owner_id: id,
      category: category || 'bamako',
      type: type || 'community'
    }

    const { data: g, error } = await supabase.from('groups').insert(payload).select().single()
    if (error) { console.error('createGroup error:', error); throw error; }

    // Ajout owner comme membre - colonne user_id
    const { error: memErr } = await supabase.from('group_members').insert({ group_id: g.id, user_id: id, role: 'owner' })
    if (memErr) console.error('member insert error:', memErr)

    // Canaux par défaut
    await supabase.from('channels').insert([
      { group_id: g.id, name: 'general', type: 'text', description: 'Discussions générales' },
      { group_id: g.id, name: 'vocal', type: 'voice' }
    ])

    await loadAll()
    return g
  }

  const createChannel = async (groupId, payload) => {
    if (!payload?.name?.trim()) throw new Error('Nom canal requis')
    const insert = {
      group_id: groupId,
      name: payload.name.trim().toLowerCase().replace(/\s+/g, '-'),
      type: payload.type || 'text',
      description: payload.description || payload.topic || null,
      topic: payload.topic || payload.description || null
    }
    const { data, error } = await supabase.from('channels').insert(insert).select().single()
    if (error) { console.error('createChannel error:', error); throw error; }
    await loadAll()
    return data
  }

  const deleteChannel = async (channelId) => {
    await supabase.from('channels').delete().eq('id', channelId)
    await loadAll()
  }

  const banMember = async (groupId, targetId) => {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', targetId)
    await loadAll()
  }

  const updateMemberRole = async (groupId, targetId, role) => {
    await supabase.from('group_members').update({ role }).eq('group_id', groupId).eq('user_id', targetId)
    await loadAll()
  }

  const loadUsers = async (search = '') => {
    let q = supabase.from('profiles').select('id, display_name, handle, avatar_url, country, created_at').order('created_at', { ascending: false }).limit(50)
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
    let mounted = true
    const load = async () => {
      const { data, error } = await supabase.from('channel_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(100)
      if (error) { console.error(error); return }
      if (!mounted) return
      if (!data?.length) { setMessages([]); return }
      const sIds = [...new Set(data.map(m=>m.sender_id).filter(Boolean))]
      let profMap = {}
      if (sIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').in('id', sIds)
        profMap = Object.fromEntries((profs||[]).map(p=>[p.id,p]))
      }
      setMessages(data.map(m=>({ ...m, profiles: profMap[m.sender_id] || { display_name: 'Membre' } })))
    }
    load()
    const ch = supabase.channel(`ch-${channelId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `channel_id=eq.${channelId}` }, async (pl) => {
      const nm = pl.new
      const { data: prof } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').eq('id', nm.sender_id).single()
      setMessages(prev=>[...prev, { ...nm, profiles: prof || { display_name: 'Membre' } }])
    }).subscribe()
    return () => { mounted=false; supabase.removeChannel(ch) }
  }, [channelId])
  const sendMessage = async (text, senderId) => {
    if (!text?.trim()) return
    const { error } = await supabase.from('channel_messages').insert({ channel_id: channelId, sender_id: senderId, text: text.trim() })
    if (error) console.error('send error', error)
  }
  return { messages, sendMessage }
}

export function useVoiceChannel(channelId, userId) {
  const [participants, setParticipants] = useState([])
  const [isJoined, setIsJoined] = useState(false)
  useEffect(() => {
    if (!channelId) return
    supabase.from('voice_participants').select('*').eq('channel_id', channelId).then(({ data })=>{ if(data) setParticipants(data) }).catch(()=>{})
  }, [channelId])
  const joinVoice = async () => { try { await supabase.from('voice_participants').upsert({ channel_id: channelId, id: userId }); } catch {} setIsJoined(true) }
  const leaveVoice = async () => { try { await supabase.from('voice_participants').delete().eq('channel_id', channelId).eq('id', userId); } catch {} setIsJoined(false) }
  return { participants, isJoined, joinVoice, leaveVoice }
}
