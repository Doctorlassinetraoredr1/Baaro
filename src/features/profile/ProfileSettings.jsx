import { useState, useRef, useEffect } from "react";
import { X, Camera, Loader2, Save, User, MapPin, Globe, AtSign, Image as ImageIcon } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { useToast } from "../../components/ToastContext.jsx";
import { COLORS } from "../../theme.js";
import { useProfile } from "../../hooks/useProfile.js";

export default function ProfileSettings({ userId, onClose }) {
  const { showToast } = useToast();
  const { profile, updateProfile, saving } = useProfile(userId, showToast);
  
  const [formData, setFormData] = useState({
    display_name: "",
    handle: "",
    bio: "",
    location: "",
    country: "",
    flag: "🌍",
    avatar_url: "",
    cover_url: "",
  });

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        handle: profile.handle ? profile.handle.replace(/^@/, "") : "",
        bio: profile.bio || "",
        location: profile.location || "",
        country: profile.country || "",
        flag: profile.flag || "🌍",
        avatar_url: profile.avatar_url || "",
        cover_url: profile.cover_url || "",
      });
    }
  }, [profile]);

  const handleImageUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Veuillez sélectionner une image valide", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("L'image ne doit pas dépasser 5 Mo", "error");
      return;
    }

    const isAvatar = type === "avatar";
    isAvatar ? setUploadingAvatar(true) : setUploadingCover(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${type}-${Date.now()}.${fileExt}`;
      const bucket = isAvatar ? "avatars" : "covers";

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
      setFormData((prev) => ({ ...prev, [`${type}_url`]: publicUrl }));
      
      await updateProfile({ [`${type}_url`]: publicUrl });
      showToast(`${isAvatar ? "Photo de profil" : "Photo de couverture"} mise à jour`, "success");
    } catch (error) {
      console.error(`Erreur upload ${type}:`, error);
      showToast(`Erreur lors du téléchargement de l'image`, "error");
    } finally {
      isAvatar ? setUploadingAvatar(false) : setUploadingCover(false);
      if (isAvatar && avatarInputRef.current) avatarInputRef.current.value = "";
      if (!isAvatar && coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      display_name: formData.display_name.trim() || "Nouveau membre",
      handle: formData.handle.trim(),
      bio: formData.bio.trim(),
      location: formData.location.trim(),
      country: formData.country.trim(),
      flag: formData.flag,
      avatar_url: formData.avatar_url,
      cover_url: formData.cover_url,
    };
    const result = await updateProfile(payload);
    if (result.ok) onClose?.();
  };

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl" style={{ background: COLORS.surface || "#0B1220", borderColor: COLORS.border }}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4" style={{ background: COLORS.surface || "#0B1220", borderColor: COLORS.border }}>
          <h2 className="text-lg font-bold" style={{ color: COLORS.ivory }}>Modifier le profil</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10" style={{ color: COLORS.muted }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Section Couverture */}
          <div className="relative group">
            <div className="h-32 w-full rounded-xl overflow-hidden border" style={{ borderColor: COLORS.border, background: COLORS.surface2 }}>
              {formData.cover_url ? (
                <img src={formData.cover_url} alt="Couverture" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center" style={{ color: COLORS.muted }}>
                  <ImageIcon size={32} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border shadow-lg transition active:scale-95 bg-black/60 backdrop-blur-sm"
              style={{ borderColor: COLORS.border, color: COLORS.ivory }}
            >
              {uploadingCover ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
            </button>
            <input ref={coverInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "cover")} className="hidden" />
          </div>

          {/* Section Avatar */}
          <div className="flex flex-col items-center gap-4 -mt-16 relative z-10">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 shadow-xl" style={{ background: COLORS.surface, borderColor: COLORS.surface || "#0B1220" }}>
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={40} style={{ color: COLORS.gold }} />
                )}
              </div>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition active:scale-95"
                style={{ background: COLORS.gold, borderColor: COLORS.border, color: COLORS.bg }}
              >
                {uploadingAvatar ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "avatar")} className="hidden" />
            </div>
          </div>

          {/* Champs du formulaire */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Nom d'affichage *</label>
              <input type="text" required value={formData.display_name} onChange={(e) => setFormData({ ...formData, display_name: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} placeholder="Ex: Jean Dupont" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Pseudo (Handle)</label>
              <div className="relative">
                <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
                <input type="text" value={formData.handle} onChange={(e) => setFormData({ ...formData, handle: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })} className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} placeholder="votre_pseudo" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Drapeau / Emoji</label>
              <input type="text" value={formData.flag} onChange={(e) => setFormData({ ...formData, flag: e.target.value.slice(0, 2) })} className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} placeholder="🌍" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Ville / Location</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
                <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} placeholder="Ex: Bamako" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Pays</label>
              <div className="relative">
                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
                <input type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} placeholder="Ex: Mali" />
                </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Biographie</label>
              <textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} rows={3} className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none transition-colors focus:border-amber-400/50" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} placeholder="Parlez-nous de vous..." />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: COLORS.border }}>
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold transition active:scale-95" style={{ color: COLORS.muted }}>Annuler</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50" style={{ background: COLORS.gold, color: COLORS.bg }}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
