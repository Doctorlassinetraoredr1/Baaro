import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    "Variables Supabase manquantes : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Mode démonstration actif."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "baaro-auth",
  },
});

// ========== IDENTITÉ UNIQUE + SOCIAL ==========
const currentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("Non connecté");
  return data.user.id;
};

export const followUser = async (targetUserId) => {
  const me = await currentUserId();
  if (!targetUserId || targetUserId === me) throw new Error("Utilisateur cible invalide");
  const { data, error } = await supabase.rpc("toggle_follow", { p_target: targetUserId });
  return { data, error };
};
export const unfollowUser = async (targetUserId) => {
  const me = await currentUserId();
  const { error } = await supabase.from("follows").delete().eq("follower_id",me).eq("followed_id",targetUserId);
  return { error };
};
export const isFollowing = async (targetUserId) => {
  const me = await currentUserId();
  const { data } = await supabase.from("follows").select("follower_id").eq("follower_id",me).eq("followed_id",targetUserId).eq("status","accepted").maybeSingle();
  return Boolean(data);
};
export const sendFriendRequest = async (targetUserId) => {
  const me = await currentUserId();
  if (!targetUserId || targetUserId === me) throw new Error("Utilisateur cible invalide");
  const { data: existing } = await supabase.from("follows").select("follower_id,followed_id,status,is_friend").eq("follower_id",me).eq("followed_id",targetUserId).maybeSingle();
  if (existing?.status === "accepted" && existing?.is_friend) return {data:existing,error:null};
  const { data, error } = await supabase.from("follows").upsert({follower_id:me,followed_id:targetUserId,status:"pending",is_friend:true},{onConflict:"follower_id,followed_id"}).select().single();
  return {data,error};
};
export const acceptFriendRequest = async (requesterId) => {
  const me = await currentUserId();
  const { data,error } = await supabase.from("follows").update({status:"accepted",is_friend:true}).eq("follower_id",requesterId).eq("followed_id",me).eq("status","pending").eq("is_friend",true).select().single();
  return {data,error};
};
export const rejectFriendRequest = async (requesterId) => {
  const me = await currentUserId();
  const { data,error } = await supabase.from("follows").update({status:"rejected",is_friend:false}).eq("follower_id",requesterId).eq("followed_id",me).eq("status","pending").eq("is_friend",true).select().single();
  return {data,error};
};
export const getFollowing = async () => { const me=await currentUserId(); const {data,error}=await supabase.from("follows").select("followed_id").eq("follower_id",me).eq("status","accepted"); return {data:(data||[]).map(x=>x.followed_id),error}; };
export const getFollowers = async () => { const me=await currentUserId(); const {data,error}=await supabase.from("follows").select("follower_id").eq("followed_id",me).eq("status","accepted"); return {data:(data||[]).map(x=>x.follower_id),error}; };
export const getFriends = async () => { const me=await currentUserId(); const {data,error}=await supabase.from("follows").select("follower_id,followed_id").eq("status","accepted").eq("is_friend",true).or(`follower_id.eq.${me},followed_id.eq.${me}`); const ids=(data||[]).map(x=>x.follower_id===me?x.followed_id:x.follower_id); return {data:[...new Set(ids)],error}; };
export const getPendingRequests = async () => { const me=await currentUserId(); const {data,error}=await supabase.from("follows").select("follower_id,followed_id,status,is_friend,created_at").eq("followed_id",me).eq("status","pending").eq("is_friend",true).order("created_at",{ascending:false}); return {data:data||[],error}; };
export const getAllUsers = async () => supabase.from("profiles").select("*").order("created_at",{ascending:false});
export const getUserById = async (userId) => { if(!userId)return {data:null,error:new Error("user_id requis")}; return supabase.from("profiles").select("*").eq("user_id",userId).maybeSingle(); };
