import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

export function useCommunity(userId) {
  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const getProfiles = useCallback(async (ids) => {
    const unique = [...new Set((ids || []).filter(Boolean))];
    if (!unique.length) return [];
    const { data, error } = await supabase.from("profiles")
      .select("user_id, display_name, handle, avatar_url, flag, bio, country")
      .in("user_id", unique);
    if (error) throw error;
    return data || [];
  }, []);

  const loadFriends = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from("follows")
      .select("follower_id, followed_id")
      .eq("status", "accepted").eq("is_friend", true)
      .or(`follower_id.eq.${userId},followed_id.eq.${userId}`);
    if (error) throw error;
    const ids = (data || []).map(r => r.follower_id === userId ? r.followed_id : r.follower_id);
    setFriends(await getProfiles(ids));
  }, [userId, getProfiles]);

  const loadRequests = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from("follows")
      .select("follower_id, followed_id, status, is_friend, created_at")
      .eq("followed_id", userId).eq("status", "pending").eq("is_friend", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const profiles = await getProfiles((data || []).map(r => r.follower_id));
    const map = new Map(profiles.map(p => [p.user_id, p]));
    setPendingRequests((data || []).map(r => ({ ...map.get(r.follower_id), requester_id:r.follower_id })).filter(x => x.user_id));
  }, [userId, getProfiles]);

  const loadUsers = useCallback(async (search = "") => {
    let q = supabase.from("profiles")
      .select("user_id, display_name, handle, avatar_url, flag, bio, country")
      .neq("user_id", userId || "00000000-0000-0000-0000-000000000000")
      .order("created_at", { ascending:false }).limit(50);
    if (search.trim()) q = q.or(`display_name.ilike.%${search.trim()}%,handle.ilike.%${search.trim()}%`);
    const { data, error } = await q;
    if (error) throw error;
    setAllUsers(data || []);
  }, [userId]);

  const sendFriendRequest = useCallback(async (targetUserId) => {
    if (!userId || !targetUserId || userId === targetUserId) throw new Error("Utilisateur cible invalide");
    const { data: existing } = await supabase.from("follows").select("follower_id, followed_id, status, is_friend")
      .eq("follower_id", userId).eq("followed_id", targetUserId).maybeSingle();
    if (existing?.status === "pending" && existing?.is_friend) return existing;
    const { data, error } = await supabase.from("follows")
      .upsert({ follower_id:userId, followed_id:targetUserId, status:"pending", is_friend:true }, { onConflict:"follower_id,followed_id" })
      .select("follower_id, followed_id, status, is_friend, created_at").single();
    if (error) throw error;
    return data;
  }, [userId]);

  const acceptFriendRequest = useCallback(async (requesterId) => {
    const { data, error } = await supabase.from("follows").update({ status:"accepted", is_friend:true })
      .eq("follower_id", requesterId).eq("followed_id", userId).eq("status","pending").eq("is_friend",true)
      .select().single();
    if (error) throw error;
    return data;
  }, [userId]);

  const rejectFriendRequest = useCallback(async (requesterId) => {
    const { error } = await supabase.from("follows").update({ status:"rejected", is_friend:false })
      .eq("follower_id", requesterId).eq("followed_id", userId).eq("status","pending").eq("is_friend",true);
    if (error) throw error;
  }, [userId]);

  const followUser = useCallback(async (targetUserId) => {
    const { data, error } = await supabase.rpc("toggle_follow", { p_target:targetUserId });
    if (error) throw error;
    return data;
  }, []);

  const loadGroups = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("group_members").select("group_id, groups(id, name, description, avatar_url, is_private, owner_id), role").eq("user_id", userId);
    if (data) {
      const enriched = [];
      for (const m of data) {
        if (!m.groups) continue;
        const { data: channels } = await supabase.from("channels").select("*").eq("group_id", m.groups.id).order("created_at");
        const { data: members } = await supabase.from("group_members").select("user_id, role").eq("group_id", m.groups.id);
        const memberProfiles = await getProfiles((members || []).map(x=>x.user_id));
        const pm = new Map(memberProfiles.map(p=>[p.user_id,p]));
        enriched.push({ ...m.groups, myRole:m.role, channels:channels||[], members:(members||[]).map(x=>({...x,profiles:pm.get(x.user_id)})), isOwner:m.groups.owner_id===userId });
      }
      setGroups(enriched);
    }
  }, [userId, getProfiles]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    Promise.all([loadFriends(), loadRequests(), loadUsers(), loadGroups()]).catch(e=>console.error("[community]",e)).finally(()=>setLoading(false));
  }, [userId, loadFriends, loadRequests, loadUsers, loadGroups]);

  const createGroup = async ({name, description, is_private, avatar_url}) => {
    const { data: group, error } = await supabase.from("groups").insert({name,description,is_private,avatar_url,owner_id:userId}).select().single();
    if (error) throw error;
    await supabase.from("group_members").insert({group_id:group.id,user_id:userId,role:"owner"});
    await supabase.from("channels").insert([{group_id:group.id,name:"général",type:"text",description:"Discussion générale"},{group_id:group.id,name:"annonces",type:"announcement"},{group_id:group.id,name:"Vocal Général",type:"voice"}]);
    await loadGroups(); return group;
  };
  const createChannel = async (groupId,payload) => { const {data,error}=await supabase.from("channels").insert({group_id:groupId,...payload}).select().single(); if(error)throw error; await loadGroups(); return data; };
  const deleteChannel = async (channelId) => { const {error}=await supabase.from("channels").delete().eq("id",channelId); if(error)throw error; await loadGroups(); };
  const banMember = async (groupId,targetUserId) => { const {error}=await supabase.from("group_members").delete().eq("group_id",groupId).eq("user_id",targetUserId); if(error)throw error; await loadGroups(); };
  const updateMemberRole = async (groupId,targetUserId,newRole) => { const {error}=await supabase.from("group_members").update({role:newRole}).eq("group_id",groupId).eq("user_id",targetUserId); if(error)throw error; await loadGroups(); };

  return { friends, allUsers, pendingRequests, groups, loading, loadUsers, loadFriends, loadRequests, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, followUser, createGroup, createChannel, deleteChannel, banMember, updateMemberRole };
}

export function useChannelMessages(channelId) {
  const [messages,setMessages]=useState([]);
  useEffect(()=>{ if(!channelId)return; supabase.from("channel_messages").select("*").eq("channel_id",channelId).order("created_at",{ascending:true}).limit(100).then(({data})=>setMessages(data||[])); },[channelId]);
  const sendMessage=async(text)=>{const {data:{session}}=await supabase.auth.getSession(); if(!session?.user)return; await supabase.from("channel_messages").insert({channel_id:channelId,sender_id:session.user.id,text});};
  return {messages,sendMessage};
}
export function useVoiceChannel(channelId,userId){ const [participants,setParticipants]=useState([]); const [isJoined,setIsJoined]=useState(false); useEffect(()=>{if(!channelId)return; supabase.from("voice_participants").select("*").eq("channel_id",channelId).then(({data})=>setParticipants(data||[]));},[channelId]); const joinVoice=async()=>{await supabase.from("voice_participants").upsert({channel_id:channelId,user_id:userId});setIsJoined(true)}; const leaveVoice=async()=>{await supabase.from("voice_participants").delete().eq("channel_id",channelId).eq("user_id",userId);setIsJoined(false)}; return {participants,isJoined,joinVoice,leaveVoice}; }
