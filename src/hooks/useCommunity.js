import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../supabaseClient'

/**
 * Identifiant utilisateur canonique :
 * profiles.id === auth.users.id === auth.uid()
 *
 * Les colonnes user_id / sender_id / owner_id restent des références
 * vers cet UUID canonique.
 */

export function useCurrentUser() {
  const [id, setId] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    let mounted = true

    const getUser = async () => {
      try {
        const {
          data: { user },
          error
        } = await supabase.auth.getUser()

        if (error) throw error

        if (mounted) {
          setId(user?.id || null)
        }
      } catch (error) {
        console.error('useCurrentUser:', error)

        if (mounted) {
          setId(null)
        }
      } finally {
        if (mounted) {
          setLoadingUser(false)
        }
      }
    }

    getUser()

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setId(session?.user?.id || null)
        setLoadingUser(false)
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  return {
    id,
    loadingUser
  }
}

/* -------------------------------------------------------------------------- */
/* COMMUNITY                                                                  */
/* -------------------------------------------------------------------------- */

export function useCommunity(externalId) {
  const { id: authId } = useCurrentUser()

  const [friends, setFriends] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  const id = externalId || authId

  /**
   * Enrichit les groupes avec :
   * - membres
   * - profils des membres
   * - channels
   */
  const enrichGroups = useCallback(async (rawGroups) => {
    if (!rawGroups?.length) {
      return []
    }

    const groupIds = [
      ...new Set(
        rawGroups
          .map(group => group?.id)
          .filter(Boolean)
      )
    ]

    if (!groupIds.length) {
      return []
    }

    try {
      const [
        { data: membersRaw, error: membersError },
        { data: channels, error: channelsError }
      ] = await Promise.all([
        supabase
          .from('group_members')
          .select('group_id, user_id, role, joined_at')
          .in('group_id', groupIds),

        supabase
          .from('channels')
          .select(
            'id, group_id, name, type, description, topic, participants_count, created_at'
          )
          .in('group_id', groupIds)
          .order('created_at', { ascending: true })
      ])

      if (membersError) {
        console.error('enrichGroups members:', membersError)
      }

      if (channelsError) {
        console.error('enrichGroups channels:', channelsError)
      }

      let membersData = membersRaw || []
      const channelsData = channels || []

      /* Charger les profils des membres */
      if (membersData.length) {
        const userIds = [
          ...new Set(
            membersData
              .map(member => member.user_id)
              .filter(Boolean)
          )
        ]

        if (userIds.length) {
          const {
            data: profiles,
            error: profilesError
          } = await supabase
            .from('profiles')
            .select(
              'id, display_name, handle, avatar_url'
            )
            .in('id', userIds)

          if (profilesError) {
            console.error(
              'enrichGroups profiles:',
              profilesError
            )
          }

          const profileMap = Object.fromEntries(
            (profiles || []).map(profile => [
              profile.id,
              profile
            ])
          )

          membersData = membersData.map(member => ({
            ...member,
            profiles:
              profileMap[member.user_id] || {
                id: member.user_id,
                display_name: 'Membre',
                handle: null,
                avatar_url: null
              }
          }))
        }
      }

      return rawGroups.map(group => ({
        ...group,

        channels: channelsData.filter(
          channel => channel.group_id === group.id
        ),

        members: membersData.filter(
          member => member.group_id === group.id
        )
      }))
    } catch (error) {
      console.error('enrichGroups:', error)

      return rawGroups.map(group => ({
        ...group,
        channels: [],
        members: []
      }))
    }
  }, [])

  /**
   * Charge les données principales de Community.
   */
  const loadAll = useCallback(async () => {
    if (!id) {
      setFriends([])
      setAllUsers([])
      setGroups([])
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      /* ------------------------------------------------------------------ */
      /* Amis + utilisateurs                                                */
      /* ------------------------------------------------------------------ */

      const [
        friendsResult,
        usersResult
      ] = await Promise.all([
        supabase.rpc(
          'get_user_friends',
          {
            user_id: id
          }
        ),

        supabase
          .from('profiles')
          .select(
            'id, display_name, handle, avatar_url, country, language, flag, created_at'
          )
          .order('created_at', {
            ascending: false
          })
          .limit(50)
      ])

      /* Amis */
      if (friendsResult.error) {
        console.error(
          'get_user_friends:',
          friendsResult.error
        )

        setFriends([])
      } else {
        const friendRows = friendsResult.data || []

        const friendIds = [
          ...new Set(
            friendRows
              .map(friend =>
                friend.friend_id ||
                friend.id
              )
              .filter(Boolean)
          )
        ]

        if (friendIds.length) {
          const {
            data: friendProfiles,
            error: friendProfilesError
          } = await supabase
            .from('profiles')
            .select(
              'id, display_name, handle, avatar_url'
            )
            .in('id', friendIds)

          if (friendProfilesError) {
            console.error(
              'friend profiles:',
              friendProfilesError
            )

            setFriends([])
          } else {
            setFriends(friendProfiles || [])
          }
        } else {
          setFriends([])
        }
      }

      /* Utilisateurs */
      if (usersResult.error) {
        console.error(
          'profiles:',
          usersResult.error
        )

        setAllUsers([])
      } else {
        setAllUsers(usersResult.data || [])
      }

      /* ------------------------------------------------------------------ */
      /* GROUPES                                                            */
      /* ------------------------------------------------------------------ */

      let rawGroups = []

      /* Première tentative : RPC existante */
      try {
        const {
          data: rpcData,
          error: rpcError
        } = await supabase.rpc(
          'get_my_community',
          {
            id_param: id
          }
        )

        if (!rpcError && rpcData) {
          rawGroups =
            rpcData?.groups ||
            rpcData ||
            []
        }
      } catch (error) {
        console.warn(
          'get_my_community indisponible:',
          error
        )
      }

      /* Fallback RLS direct */
      if (!Array.isArray(rawGroups) || !rawGroups.length) {
        const {
          data: memberGroups,
          error: memberGroupsError
        } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', id)

        if (memberGroupsError) {
          console.error(
            'memberGroups:',
            memberGroupsError
          )
        }

        const myGroupIds = [
          ...new Set(
            (memberGroups || [])
              .map(member => member.group_id)
              .filter(Boolean)
          )
        ]

        let query = supabase
          .from('groups')
          .select('*')
          .order('created_at', {
            ascending: false
          })
          .limit(100)

        /*
         * La RLS filtre déjà :
         * - groupes publics
         * - groupes dont je suis owner
         * - groupes dont je suis membre
         */
        if (myGroupIds.length) {
          query = query.or(
            `owner_id.eq.${id},id.in.(${myGroupIds.join(',')}),is_public.eq.true`
          )
        } else {
          query = query.or(
            `owner_id.eq.${id},is_public.eq.true`
          )
        }

        const {
          data: directGroups,
          error: groupsError
        } = await query

        if (groupsError) {
          console.error(
            'groups fallback:',
            groupsError
          )

          rawGroups = []
        } else {
          rawGroups = directGroups || []
        }
      }

      /* Sécurité : supprimer les doublons de groupes */
      const uniqueGroups = [
        ...new Map(
          (rawGroups || [])
            .filter(group => group?.id)
            .map(group => [
              group.id,
              group
            ])
        ).values()
      ]

      const enrichedGroups =
        await enrichGroups(uniqueGroups)

      setGroups(enrichedGroups)
    } catch (error) {
      console.error(
        'useCommunity.loadAll:',
        error
      )
    } finally {
      setLoading(false)
    }
  }, [id, enrichGroups])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  /* ---------------------------------------------------------------------- */
  /* CREATE GROUP                                                           */
  /* ---------------------------------------------------------------------- */

  const createGroup = useCallback(
    async ({
      name,
      description,
      is_public,
      category,
      type
    } = {}) => {
      if (!id) {
        throw new Error(
          'Vous devez être connecté.'
        )
      }

      const cleanName = name?.trim()

      if (!cleanName) {
        throw new Error(
          'Le nom du groupe est obligatoire.'
        )
      }

      const cleanDescription =
        description?.trim() || null

      /* 1. Création du groupe */
      const {
        data: group,
        error: groupError
      } = await supabase
        .from('groups')
        .insert({
          name: cleanName,
          description: cleanDescription,
          is_public: !!is_public,
          owner_id: id,
          category:
            category || 'community',
          type:
            type || 'community'
        })
        .select()
        .single()

      if (groupError) {
        throw groupError
      }

      try {
        /* 2. Le créateur devient owner */
        const {
          error: memberError
        } = await supabase
          .from('group_members')
          .insert({
            group_id: group.id,
            user_id: id,
            role: 'owner'
          })

        if (memberError) {
          throw memberError
        }

        /* 3. Channels par défaut */
        const {
          error: channelsError
        } = await supabase
          .from('channels')
          .insert([
            {
              group_id: group.id,
              name: 'general',
              type: 'text',
              description:
                'Discussions générales'
            },
            {
              group_id: group.id,
              name: 'vocal',
              type: 'voice',
              description:
                'Salon vocal'
            }
          ])

        if (channelsError) {
          throw channelsError
        }
      } catch (error) {
        /*
         * Les opérations SQL ne sont pas transactionnelles ici.
         * Si une étape secondaire échoue, on tente de supprimer
         * le groupe créé afin d'éviter un groupe incomplet.
         */
        console.error(
          'createGroup setup:',
          error
        )

        try {
          await supabase
            .from('groups')
            .delete()
            .eq('id', group.id)
            .eq('owner_id', id)
        } catch (cleanupError) {
          console.error(
            'createGroup cleanup:',
            cleanupError
          )
        }

        throw error
      }

      await loadAll()

      return group
    },
    [id, loadAll]
  )

  /* ---------------------------------------------------------------------- */
  /* CREATE CHANNEL                                                         */
  /* ---------------------------------------------------------------------- */

  const createChannel = useCallback(
    async (groupId, payload = {}) => {
      if (!id) {
        throw new Error(
          'Vous devez être connecté.'
        )
      }

      if (!groupId) {
        throw new Error(
          'Groupe invalide.'
        )
      }

      const cleanName =
        payload.name?.trim()

      if (!cleanName) {
        throw new Error(
          'Le nom du canal est obligatoire.'
        )
      }

      const type =
        payload.type === 'voice'
          ? 'voice'
          : 'text'

      const normalizedName =
        cleanName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(
            /[^a-z0-9-_]/g,
            ''
          )
          .replace(
            /-+/g,
            '-'
          )
          .replace(
            /^-|-$/g,
            ''
          )

      if (!normalizedName) {
        throw new Error(
          'Nom de canal invalide.'
        )
      }

      const description =
        payload.description?.trim() ||
        payload.topic?.trim() ||
        null

      const topic =
        payload.topic?.trim() ||
        payload.description?.trim() ||
        null

      const {
        data,
        error
      } = await supabase
        .from('channels')
        .insert({
          group_id: groupId,
          name: normalizedName,
          type,
          description,
          topic
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      await loadAll()

      return data
    },
    [id, loadAll]
  )

  /* ---------------------------------------------------------------------- */
  /* REMOVE MEMBER / BAN TEMPORAIREMENT                                     */
  /* ---------------------------------------------------------------------- */

  const banMember = useCallback(
    async (groupId, targetId) => {
      if (!id) {
        throw new Error(
          'Vous devez être connecté.'
        )
      }

      if (!groupId || !targetId) {
        throw new Error(
          'Groupe ou utilisateur invalide.'
        )
      }

      if (targetId === id) {
        throw new Error(
          'Vous ne pouvez pas vous bannir vous-même.'
        )
      }

      /*
       * IMPORTANT :
       * Pour l'instant, cette fonction retire le membre.
       * Le véritable système de bannissement permanent
       * devra utiliser une table dédiée group_bans.
       */

      const {
        error
      } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', targetId)

      if (error) {
        throw error
      }

      await loadAll()
    },
    [id, loadAll]
  )

  /* ---------------------------------------------------------------------- */
  /* SEARCH USERS                                                           */
  /* ---------------------------------------------------------------------- */

  const loadUsers = useCallback(
    async (search = '') => {
      const cleanSearch =
        search.trim()

      let query = supabase
        .from('profiles')
        .select(
          'id, display_name, handle, avatar_url, country, language, flag, created_at'
        )
        .order('created_at', {
          ascending: false
        })
        .limit(50)

      if (cleanSearch) {
        /*
         * PostgREST échappe correctement les valeurs via les paramètres
         * du builder ; on limite également la longueur de recherche.
         */
        const safeSearch =
          cleanSearch.slice(0, 80)

        query = query.or(
          `display_name.ilike.%${safeSearch}%,handle.ilike.%${safeSearch}%`
        )
      }

      const {
        data,
        error
      } = await query

      if (error) {
        console.error(
          'loadUsers:',
          error
        )
        throw error
      }

      setAllUsers(data || [])

      return data || []
    },
    []
  )

  return {
    friends,
    allUsers,
    groups,
    loading,
    loadAll,
    createGroup,
    createChannel,
    banMember,
    loadUsers,
    id
  }
}

/* -------------------------------------------------------------------------- */
/* CHANNEL MESSAGES                                                           */
/* -------------------------------------------------------------------------- */

export function useChannelMessages(channelId) {
  const { id } = useCurrentUser()

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const channelRef = useRef(channelId)

  useEffect(() => {
    channelRef.current = channelId
  }, [channelId])

  useEffect(() => {
    let mounted = true

    if (!channelId) {
      setMessages([])
      setLoading(false)
      setError(null)
      return undefined
    }

    setMessages([])
    setError(null)
    setLoading(true)

    const loadMessages = async () => {
      try {
        const {
          data,
          error: messagesError
        } = await supabase
          .from('channel_messages')
          .select(
            'id, channel_id, sender_id, text, created_at'
          )
          .eq('channel_id', channelId)
          .order('created_at', {
            ascending: true
          })
          .limit(100)

        if (messagesError) {
          throw messagesError
        }

        if (!mounted) return

        if (!data?.length) {
          setMessages([])
          return
        }

        const senderIds = [
          ...new Set(
            data
              .map(message =>
                message.sender_id
              )
              .filter(Boolean)
          )
        ]

        let profileMap = {}

        if (senderIds.length) {
          const {
            data: profiles,
            error: profilesError
          } = await supabase
            .from('profiles')
            .select(
              'id, display_name, handle, avatar_url'
            )
            .in('id', senderIds)

          if (profilesError) {
            console.error(
              'message profiles:',
              profilesError
            )
          }

          profileMap =
            Object.fromEntries(
              (profiles || []).map(
                profile => [
                  profile.id,
                  profile
                ]
              )
            )
        }

        setMessages(
          data.map(message => ({
            ...message,
            profiles:
              profileMap[
                message.sender_id
              ] || {
                id: message.sender_id,
                display_name: 'Membre',
                handle: null,
                avatar_url: null
              }
          }))
        )
      } catch (loadError) {
        console.error(
          'loadMessages:',
          loadError
        )

        if (mounted) {
          setError(loadError)
          setMessages([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadMessages()

    /* -------------------------------------------------------------------- */
    /* REALTIME                                                             */
    /* -------------------------------------------------------------------- */

    const realtimeChannel =
      supabase
        .channel(
          `community-messages-${channelId}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'channel_messages',
            filter:
              `channel_id=eq.${channelId}`
          },
          async payload => {
            if (!mounted) return

            const message =
              payload.new

            /* Éviter les doublons */
            setMessages(previous => {
              if (
                previous.some(
                  item =>
                    item.id ===
                    message.id
                )
              ) {
                return previous
              }

              return previous
            })

            let profile = null

            if (message.sender_id) {
              const {
                data
              } = await supabase
                .from('profiles')
                .select(
                  'id, display_name, handle, avatar_url'
                )
                .eq(
                  'id',
                  message.sender_id
                )
                .maybeSingle()

              profile = data
            }

            if (!mounted) return

            /*
             * Vérifie encore une fois que le channel actif
             * est bien celui qui vient de recevoir l'événement.
             */
            if (
              channelRef.current !==
              channelId
            ) {
              return
            }

            setMessages(previous => {
              if (
                previous.some(
                  item =>
                    item.id ===
                    message.id
                )
              ) {
                return previous
              }

              return [
                ...previous,
                {
                  ...message,
                  profiles:
                    profile || {
                      id:
                        message.sender_id,
                      display_name:
                        'Membre',
                      handle: null,
                      avatar_url:
                        null
                    }
                }
              ]
            })
          }
        )
        .subscribe(status => {
          if (
            status === 'CHANNEL_ERROR'
          ) {
            console.error(
              'Realtime channel_messages: CHANNEL_ERROR'
            )
          }
        })

    return () => {
      mounted = false
      supabase.removeChannel(
        realtimeChannel
      )
    }
  }, [channelId])

  /* ---------------------------------------------------------------------- */
  /* SEND MESSAGE                                                           */
  /* ---------------------------------------------------------------------- */

  const sendMessage = useCallback(
    async text => {
      const cleanText =
        text?.trim()

      if (!cleanText) {
        return null
      }

      if (!id) {
        throw new Error(
          'Vous devez être connecté.'
        )
      }

      if (!channelId) {
        throw new Error(
          'Canal invalide.'
        )
      }

      if (sending) {
        return null
      }

      setSending(true)
      setError(null)

      try {
        const {
          data,
          error: sendError
        } = await supabase
          .from('channel_messages')
          .insert({
            channel_id: channelId,
            sender_id: id,
            text: cleanText
          })
          .select(
            'id, channel_id, sender_id, text, created_at'
          )
          .single()

        if (sendError) {
          throw sendError
        }

        /*
         * Le realtime ajoutera normalement le message.
         * On ne l'ajoute pas ici pour éviter un doublon.
         */
        return data
      } catch (sendError) {
        console.error(
          'sendMessage:',
          sendError
        )

        setError(sendError)

        throw sendError
      } finally {
        setSending(false)
      }
    },
    [id, channelId, sending]
  )

  return {
    messages,
    loading,
    sending,
    error,
    sendMessage
  }
}

/* -------------------------------------------------------------------------- */
/* VOICE CHANNEL                                                              */
/* -------------------------------------------------------------------------- */

export function useVoiceChannel(channelId) {
  const { id } = useCurrentUser()

  const [participants, setParticipants] =
    useState([])

  const [isJoined, setIsJoined] =
    useState(false)

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState(null)

  useEffect(() => {
    let mounted = true

    if (!channelId) {
      setParticipants([])
      setIsJoined(false)
      setLoading(false)
      setError(null)

      return undefined
    }

    setParticipants([])
    setIsJoined(false)
    setError(null)
    setLoading(true)

    const loadParticipants =
      async () => {
        try {
          const {
            data,
            error: participantsError
          } = await supabase
            .from('voice_participants')
            .select(
              'channel_id, user_id, joined_at'
            )
            .eq(
              'channel_id',
              channelId
            )
            .order(
              'joined_at',
              {
                ascending: true
              }
            )

          if (participantsError) {
            throw participantsError
          }

          if (!mounted) return

          setParticipants(
            data || []
          )

          setIsJoined(
            (data || []).some(
              participant =>
                participant.user_id ===
                id
            )
          )
        } catch (loadError) {
          console.error(
            'loadVoiceParticipants:',
            loadError
          )

          if (mounted) {
            setError(loadError)
          }
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      }

    loadParticipants()

    /* -------------------------------------------------------------------- */
    /* REALTIME                                                             */
    /* -------------------------------------------------------------------- */

    const realtimeChannel =
      supabase
        .channel(
          `community-voice-${channelId}`
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'voice_participants',
            filter:
              `channel_id=eq.${channelId}`
          },
          payload => {
            if (!mounted) return

            setParticipants(
              previous => {
                if (
                  previous.some(
                    participant =>
                      participant.user_id ===
                      payload.new.user_id
                  )
                ) {
                  return previous
                }

                return [
                  ...previous,
                  payload.new
                ]
              }
            )

            if (
              payload.new.user_id ===
              id
            ) {
              setIsJoined(true)
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'voice_participants',
            filter:
              `channel_id=eq.${channelId}`
          },
          payload => {
            if (!mounted) return

            setParticipants(
              previous =>
                previous.filter(
                  participant =>
                    participant.user_id !==
                    payload.old.user_id
                )
            )

            if (
              payload.old.user_id ===
              id
            ) {
              setIsJoined(false)
            }
          }
        )
        .subscribe()

    return () => {
      mounted = false

      supabase.removeChannel(
        realtimeChannel
      )
    }
  }, [channelId, id])

  /* ---------------------------------------------------------------------- */
  /* JOIN                                                                   */
  /* ---------------------------------------------------------------------- */

  const joinVoice = useCallback(
    async () => {
      if (!id) {
        throw new Error(
          'Vous devez être connecté.'
        )
      }

      if (!channelId) {
        throw new Error(
          'Canal vocal invalide.'
        )
      }

      setError(null)
      setLoading(true)

      try {
        const {
          error: joinError
        } = await supabase
          .from('voice_participants')
          .upsert(
            {
              channel_id: channelId,
              user_id: id
            },
            {
              onConflict:
                'channel_id,user_id'
            }
          )

        if (joinError) {
          throw joinError
        }

        setIsJoined(true)
      } catch (joinError) {
        console.error(
          'joinVoice:',
          joinError
        )

        setError(joinError)
        setIsJoined(false)

        throw joinError
      } finally {
        setLoading(false)
      }
    },
    [id, channelId]
  )

  /* ---------------------------------------------------------------------- */
  /* LEAVE                                                                  */
  /* ---------------------------------------------------------------------- */

  const leaveVoice = useCallback(
    async () => {
      if (!id) {
        throw new Error(
          'Vous devez être connecté.'
        )
      }

      if (!channelId) {
        throw new Error(
          'Canal vocal invalide.'
        )
      }

      setError(null)
      setLoading(true)

      try {
        const {
          error: leaveError
        } = await supabase
          .from('voice_participants')
          .delete()
          .eq(
            'channel_id',
            channelId
          )
          .eq(
            'user_id',
            id
          )

        if (leaveError) {
          throw leaveError
        }

        setIsJoined(false)
      } catch (leaveError) {
        console.error(
          'leaveVoice:',
          leaveError
        )

        setError(leaveError)

        throw leaveError
      } finally {
        setLoading(false)
      }
    },
    [id, channelId]
  )

  return {
    participants,
    isJoined,
    loading,
    error,
    joinVoice,
    leaveVoice
  }
}
