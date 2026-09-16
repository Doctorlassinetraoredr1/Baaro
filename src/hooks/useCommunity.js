import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'

function genCode(len=6) {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c=''; for(let i=0;i<len;i++) c+=chars[Math.floor(Math.random()*chars.length)]
  return c
}

// id = ton profil id (user?.id)
export function useCommunity(id) {
  const [friends, setFriends] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFriends = useCallback(async () => {
    if (!id) return
    // utilise la RPC qu'on vient de créer (plus rapide)
    const { data } = await supabase.rpc('get_user_friends', { id_param: id })
    if (!data || data.length===0) { setFriends([]); return }
    const friendIds = data.map(f=>f.friend_id)
    const { data: profiles } = await supabase.from('profiles').select('id, display_name, handle, avatar_url, is_verified').in('id', friendIds)
    if (profiles) setFriends(profiles)
  }, [id])

  const loadUsers = useCallback(async (search = '') => {
    let q = supabase.from('profiles').select('id, display_name, handle, avatar_url, bio, country, is_verified').limit(50)
    if (search) q = q.or(`display_name.ilike.%${search}%,handle.ilike.%${search}%`)
    const { data } = await q
    if (data) setAllUsers(data)
  }, [])

  const loadGroups = useCallback(async () => {
    if (!id) return
    const { data } = await supabase.from('group_members').select('group_id, groups(id, name, description, avatar_url, is_private, owner_id), role').eq('user_id', id)
    if (data) {
      const enriched = []
      for (let m of data) {
        if (!m.groups) continue
        const [{ data: channels }, { data: members }, { data: roles }] = await Promise.all([
          supabase.from('channels').select('*').eq('group_id', m.groups.id).order('created_at'),
          supabase.from('group_members').select('user_id, role, profiles(display_name, handle, avatar_url)').eq('group_id', m.groups.id),
          supabase.from('group_roles').select('*').eq('group_id', m.groups.id)
        ])
        enriched.push({...m.groups, myRole: m.role, channels: channels||[], members: members||[], customRoles: roles||[], isOwner: m.groups.owner_id === id })
      }
      setGroups(enriched)
    }
  }, [id])

  useEffect(() => {
    Promise.all([loadFriends(), loadUsers(), loadGroups()]).finally(()=>setLoading(false))
    const ch = supabase.channel('community-v2').on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, loadGroups).on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, loadGroups).subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadFriends, loadUsers, loadGroups])

  const createGroup = async ({ name, description, is_private, avatar_url }) => {
    const { data: group, error } = await supabase.from('groups').insert({ name, description, is_private, avatar_url, owner_id: id }).select().single()
    if (error) throw error
    await supabase.from('group_members').insert({ group_id: group.id, user_id: id, role: 'owner' })
    await supabase.from('channels').insert([
      { group_id: group.id, name: 'général', type: 'text', description: 'Discussion générale' },
      { group_id: group.id, name: 'annonces', type: 'announcement' },
      { group_id: group.id, name: 'Vocal Général', type: 'voice' },
      { group_id: group.id, name: 'Trading BARO', type: 'text' }
    ])
    await supabase.from('group_roles').insert([
      { group_id: group.id, name: 'Admin', color: '#FF0000', permissions: { manage_channels: true, manage_members: true, ban_members: true } },
      { group_id: group.id, name: 'Modérateur', color: '#00FF00', permissions: { mute_members: true } },
      { group_id: group.id, name: 'Membre', color: '#888888', permissions: {} }
    ])
    await loadGroups()
    return group
  }

  const createChannel = async (groupId, payload) => {
    const { data } = await supabase.from('channels').insert({ group_id: groupId,...payload }).select().single()
    await loadGroups(); return data
  }
  const deleteChannel = async (channelId) => { await supabase.from('channels').delete().eq('id', channelId); await loadGroups() }
  const banMember = async (groupId, targetId) => { await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', targetId); await loadGroups() }
  const updateMemberRole = async (groupId, targetId, newRole) => { await supabase.from('group_members').update({ role: newRole }).eq('group_id', groupId).eq('user_id', targetId); await loadGroups() }
  const joinGroup = async (groupId) => { await supabase.from('group_members').insert({ group_id: groupId, user_id: id, role: 'member' }); await loadGroups() }

  // BONUS INVITES de ton autre fichier
  const createInviteLink = async (groupId, { maxUses=0, expiresInHours=24 } = {}) => {
    const code = genCode()
    const expires_at = new Date(Date.now() + expiresInHours*3600*1000).toISOString()
    const { data } = await supabase.from('group_invites').insert({ group_id: groupId, code, created_by: id, max_uses: maxUses, expires_at }).select().single()
    return data
  }

  const joinViaCode = async (code) => {
    const { data: invite } = await supabase.from('group_invites').select('*, groups(name)').eq('code', code.toUpperCase()).single()
    if(!invite) throw new Error('Code invalide')
    await supabase.from('group_members').insert({ group_id: invite.group_id, user_id: id, role: 'member' })
    await supabase.from('group_invites').update({ uses: invite.uses+1 }).eq('id', invite.id)
    await loadGroups()
    return invite.group_id
  }

  return { friends, allUsers, groups, loading, loadUsers, createGroup, createChannel, deleteChannel, banMember, updateMemberRole, joinGroup, createInviteLink, joinViaCode }
}

export function useChannelMessages(channelId) {
  const [messages, setMessages] = useState([])
  useEffect(() => {
    if (!channelId) return
    supabase.from('channel_messages').select('*, profiles(display_name, handle, avatar_url)').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(100).then(({ data }) => setMessages(data||[]))
    const ch = supabase.channel(`channel-${channelId}`).on('postgres_changes', { event:'INSERT', schema:'public', table:'channel_messages', filter:`channel_id=eq.${channelId}` }, p => setMessages(prev => [...prev, p.new])).subscribe()
    return () => supabase.removeChannel(ch)
  }, [channelId])
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
    supabase.from('voice_participants').select('*, profiles(display_name, handle, avatar_url)').eq('channel_id', channelId).then(({ data }) => setParticipants(data||[]))
    const ch = supabase.channel(`voice-${channelId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'voice_participants', filter: `channel_id=eq.${channelId}` }, async () => {
      const { data } = await supabase.from('voice_participants').select('*, profiles(display_name, handle, avatar_url)').eq('channel_id', channelId)
      setParticipants(data||[])
    }).subscribe()
    return () => supabase.removeChannel(ch)
  }, [channelId])
  const joinVoice = async () => { await supabase.from('voice_participants').upsert({ channel_id: channelId, user_id: id }); setIsJoined(true) }
  const leaveVoice = async () => { await supabase.from('voice_participants').delete().eq('channel_id', channelId).eq('user_id', id); setIsJoined(false) }
  return { participants, isJoined, joinVoice, leaveVoice }
}
