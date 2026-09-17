import { useState, useRef, useEffect } from "react";
import { X, Camera, Loader2, Save, User, MapPin, Globe, AtSign } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { useToast } from "../../components/ToastContext.jsx"; // Ajuste le chemin si nécessaire
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
  const fileInputRef = useRef(null);

  // Initialiser le formulaire quand le profil est chargé
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Gestion de l'upload d'avatar
  const handleAvatarUpload = async (e) => {
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

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload vers le bucket 'avatars'
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Mettre à jour l'état local et sauvegarder
      setFormData((prev) => ({ ...prev, avatar_url: publicUrl }));
      
      // Sauvegarde immédiate de l'avatar
      await updateProfile({ avatar_url: publicUrl });
      showToast("Photo de profil mise à jour", "success");
    } catch (error) {
      console.error("Erreur upload avatar:", error);
      showToast("Erreur lors du téléchargement de l'image", "error");
    } finally {
      setUploadingAvatar(false);
      // Reset input pour permettre de réuploader le même fichier si besoin
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Sauvegarder les modifications du formulaire
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
    if (result.ok) {
      onClose?.();
    }
  };

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ background: COLORS.surface || "#0B1220", borderColor: COLORS.border }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4" style={{ background: COLORS.surface || "#0B1220", borderColor: COLORS.border }}>
          <h2 className="text-lg font-bold" style={{ color: COLORS.ivory }}>Modifier le profil</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/10"
            style={{ color: COLORS.muted }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {/* Section Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div 
                className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 shadow-xl"
                style={{ background: COLORS.surface2, borderColor: COLORS.border }}
              >
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User size={48} style={{ color: COLORS.gold }} />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition active:scale-95"
                style={{ background: COLORS.gold, borderColor: COLORS.border, color: COLORS.bg }}
              >
                {uploadingAvatar ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-center" style={{ color: COLORS.muted }}>
              JPG, PNG ou GIF. Max 5 Mo.
            </p>
          </div>

          {/* Champs du formulaire */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Nom d'affichage *</label>
              <input
                type="text"
                required
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                placeholder="Ex: Jean Dupont"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Pseudo (Handle)</label>
              <div className="relative">
                <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
                <input
                  type="text"
                  value={formData.handle}
                  onChange={(e) => setFormData({ ...formData, handle: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                  className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50"
                  style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                  placeholder="votre_pseudo"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Drapeau / Emoji</label>
              <input
                type="text"
                value={formData.flag}
                onChange={(e) => setFormData({ ...formData, flag: e.target.value.slice(0, 2) })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                placeholder="🌍"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Ville / Location</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50"
                  style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                  placeholder="Ex: Bamako"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Pays</label>
              <div className="relative">
                <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50"
                  style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                  placeholder="Ex: Mali"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Biographie</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                placeholder="Parlez-nous de vous..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t pt-4" style={{ borderColor: COLORS.border }}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-bold transition active:scale-95"
              style={{ color: COLORS.muted }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-bold transition active:scale-95 disabled:opacity-50"
              style={{ background: COLORS.gold, color: COLORS.bg }}
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
