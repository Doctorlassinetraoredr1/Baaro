import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

export function useCurrentUser() {
  const [id, setId] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  useEffect(() => {
    const get = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.id) setId(user.id)
        else {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user?.id) setId(session.user.id)
        }
      } catch (e) { console.error('getUser', e) }
      setLoadingUser(false)
    }
    get()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setId(session?.user?.id || null)
    })
    return () => sub?.subscription?.unsubscribe()
  }, [])
  return { id, loadingUser }
}

export function useCommunity(externalId) {
  const { id: authId } = useCurrentUser()
  const [friends, setFriends] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const id = externalId || authId

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
      console.error('enrichGroups', e)
      return rawGroups.map(g => ({ ...g, channels: [], members: [] }))
    }
  }

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [{ data: friendsData }, { data: usersData }] = await Promise.all([
        supabase.rpc('get_user_friends', { user_id: id }).catch(()=>({ data: [] })),
        supabase.from('profiles').select('id, display_name, handle, avatar_url, country, language, flag, created_at').order('created_at', { ascending: false }).limit(50)
      ])

      if (friendsData?.length) {
        const ids = friendsData.map(f => f.friend_id || f.id).filter(Boolean)
        if (ids.length) {
          const { data } = await supabase.from('profiles').select('id, display_name, handle, avatar_url').in('id', ids)
          setFriends(data || [])
        } else setFriends([])
      } else setFriends([])
      setAllUsers(usersData || [])

      let rawGroups = []
      try {
        const { data: rpcData } = await supabase.rpc('get_my_community', { id_param: id })
        rawGroups = rpcData?.groups || rpcData || []
      } catch {}

      if (!rawGroups.length) {
        const { data: memberGroups } = await supabase.from('group_members').select('group_id').eq('user_id', id)
        const myGroupIds = [...new Set((memberGroups||[]).map(m => m.group_id))]
        let q = supabase.from('groups').select('*').order('created_at', { ascending: false }).limit(100)
        if (myGroupIds.length) q = q.or(`owner_id.eq.${id},id.in.(${myGroupIds.join(',')}),is_public.eq.true`)
        else q = q.or(`owner_id.eq.${id},is_public.eq.true`)
        const { data: allGroups, error } = await q
        if (error) {
          const { data: fallback } = await supabase.from('groups').select('*').order('created_at', { ascending: false }).limit(100)
          rawGroups = fallback || []
        } else rawGroups = allGroups || []
      }

      const enriched = await enrichGroups(rawGroups)
      setGroups(enriched)
    } catch (err) { console.error('loadAll', err) } finally { setLoading(false) }
  }, [id])

  useEffect(() => { if (id) loadAll() }, [loadAll, id])

  const createGroup = async ({ name, description, is_public, category, type }) => {
    if (!id) throw new Error('Non connecté')
    if (!name?.trim()) throw new Error('Nom requis')
    const { data: g, error } = await supabase.from('groups').insert({ name: name.trim(), description: description?.trim() || null, is_public: !!is_public, owner_id: id, category: category || 'community', type: type || 'community' }).select().single()
    if (error) throw error
    await supabase.from('group_members').insert({ group_id: g.id, user_id: id, role: 'owner' })
    await supabase.from('channels').insert([{ group_id: g.id, name: 'general', type: 'text', description: 'Discussions générales' }, { group_id: g.id, name: 'vocal', type: 'voice' }])
    await loadAll()
    return g
  }

  const createChannel = async (groupId, payload) => {
    if (!payload?.name?.trim()) throw new Error('Nom canal requis')
    const insert = { group_id: groupId, name: payload.name.trim().toLowerCase().replace(/\s+/g, '-'), type: payload.type || 'text', description: payload.description || payload.topic || null, topic: payload.topic || payload.description || null }
    const { data, error } = await supabase.from('channels').insert(insert).select().single()
    if (error) throw error
    await loadAll()
    return data
  }

  const banMember = async (groupId, targetId) => {
    await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', targetId)
    await loadAll()
  }

  const loadUsers = async (search = '') => {
    let q = supabase.from('profiles').select('id, display_name, handle, avatar_url, country, language, flag, created_at').order('created_at', { ascending: false }).limit(50)
    if (search) q = q.or(`display_name.ilike.%${search}%,handle.ilike.%${search}%`)
    const { data } = await q
    setAllUsers(data || [])
  }

  return { friends, allUsers, groups, loading, loadAll, createGroup, createChannel, banMember, loadUsers, id }
}

export function useChannelMessages(channelId) {
  const { id } = useCurrentUser()
  const [messages, setMessages] = useState([])
  useEffect(() => {
    if (!channelId) return
    let mounted = true
    const load = async () => {
      const { data, error } = await supabase.from('channel_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(100)
      if (error) { console.error(error); return }
      if (!mounted) return
      if (!data?.length) { setMessages([]); return }
      const sIds = [...new Set(data.map(m=> m.sender_id).filter(Boolean))]
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
  const sendMessage = async (text) => {
    if (!text?.trim()) return
    if (!id) throw new Error('Non connecté')
    const { error } = await supabase.from('channel_messages').insert({ channel_id: channelId, sender_id: id, text: text.trim() })
    if (error) console.error('send error', error)
  }
  return { messages, sendMessage }
}

export function useVoiceChannel(channelId) {
  const { id } = useCurrentUser()
  const [participants, setParticipants] = useState([])
  const [isJoined, setIsJoined] = useState(false)
  useEffect(() => {
    if (!channelId) return
    supabase.from('voice_participants').select('*').eq('channel_id', channelId).then(({ data })=>{ if(data) setParticipants(data) }).catch(()=>{})
  }, [channelId])
  const joinVoice = async () => { try { if (id) await supabase.from('voice_participants').upsert({ channel_id: channelId, user_id: id }, { onConflict: 'channel_id,user_id' }); } catch {} setIsJoined(true) }
  const leaveVoice = async () => { try { if (id) await supabase.from('voice_participants').delete().eq('channel_id', channelId).eq('user_id', id); } catch {} setIsJoined(false) }
  return { participants, isJoined, joinVoice, leaveVoice }
}
