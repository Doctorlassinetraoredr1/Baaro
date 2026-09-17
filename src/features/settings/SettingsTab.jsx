import { useState, useEffect } from "react";
import { Save, Loader2, User, Shield, Bell, Palette } from "lucide-react";
import { COLORS } from "../../theme.js";
import { supabase } from "../../supabaseClient.js";
import { useToast } from "../../components/ToastContext.jsx";
import { useProfile } from "../../hooks/useProfile.js";
import { useSettings } from "../../hooks/useSettings.js";

// Import de tes composants existants
import ProfilePhotosEditor from "../../components/ProfilePhotosEditor.jsx";
import ProfileContactsLinks from "../../components/ProfileContactsLinks.jsx";

export default function SettingsTab({ userId }) {
  const { showToast } = useToast();
  const { profile, updateProfile, saving: profileSaving } = useProfile(userId, showToast);
  const { settings, loading: settingsLoading, update: updateSettings } = useSettings();
  
  const [formData, setFormData] = useState({
    display_name: "",
    handle: "",
    bio: "",
    location: "",
    country: "",
    flag: "🌍",
  });

  // Initialiser le formulaire avec les données du profil
  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        handle: profile.handle ? profile.handle.replace(/^@/, "") : "",
        bio: profile.bio || "",
        location: profile.location || "",
        country: profile.country || "",
        flag: profile.flag || "🌍",
      });
    }
  }, [profile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const payload = {
      display_name: formData.display_name.trim() || "Nouveau membre",
      handle: formData.handle.trim() ? (formData.handle.trim().startsWith("@") ? formData.handle.trim() : `@${formData.handle.trim()}`) : null,
      bio: formData.bio.trim(),
      location: formData.location.trim(),
      country: formData.country.trim(),
      flag: formData.flag,
    };
    
    const result = await updateProfile(payload);
    if (result.ok) showToast("Profil mis à jour", "success");
  };

  if (settingsLoading || !profile) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin" size={32} style={{ color: COLORS.gold }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto pb-12">
      
      {/* ==========================================
          SECTION 1 : PHOTOS (Composant existant)
      ========================================== */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4" style={{ color: COLORS.ivory }}>
          <User size={20} style={{ color: COLORS.gold }} /> Photos du profil
        </h2>
        <ProfilePhotosEditor 
          userId={userId} 
          profile={profile} 
          onUpdated={(patch) => { /* Le composant gère déjà la sauvegarde, on peut juste rafraîchir si besoin */ }} 
        />
      </section>

      <div className="border-t" style={{ borderColor: COLORS.border }} />

      {/* ==========================================
          SECTION 2 : INFORMATIONS GÉNÉRALES
      ========================================== */}
      <section>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-lg font-bold mb-2" style={{ color: COLORS.ivory }}>
            Informations générales
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Nom d'affichage *</label>
              <input 
                type="text" required value={formData.display_name} 
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ivory }} 
              />
            </div>
            
            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Pseudo (Handle)</label>
              <input 
                type="text" value={formData.handle} 
                onChange={(e) => setFormData({ ...formData, handle: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ivory }} 
                placeholder="votre_pseudo"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Drapeau</label>
              <input 
                type="text" value={formData.flag} 
                onChange={(e) => setFormData({ ...formData, flag: e.target.value.slice(0, 2) })}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ivory }} 
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Ville</label>
              <input 
                type="text" value={formData.location} 
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ivory }} 
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Pays</label>
              <input 
                type="text" value={formData.country} 
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ivory }} 
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold" style={{ color: COLORS.muted }}>Biographie</label>
              <textarea 
                value={formData.bio} 
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })} 
                rows={3}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none resize-none transition-colors focus:border-amber-400/50"
                style={{ background: COLORS.surface, borderColor: COLORS.border, color: COLORS.ivory }} 
                placeholder="Parlez-nous de vous..."
              />
            </div>
          </div>

          <button 
            type="submit" disabled={profileSaving}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold mt-2 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: COLORS.gold, color: COLORS.bg }}
          >
            {profileSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} 
            {profileSaving ? "Enregistrement..." : "Enregistrer les informations"}
          </button>
        </form>
      </section>

      <div className="border-t" style={{ borderColor: COLORS.border }} />

      {/* ==========================================
          SECTION 3 : CONTACTS & RÉSEAUX (Composant existant)
      ========================================== */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4" style={{ color: COLORS.ivory }}>
          Coordonnées et Réseaux
        </h2>
        <ProfileContactsLinks userId={userId} />
      </section>

      <div className="border-t" style={{ borderColor: COLORS.border }} />

      {/* ==========================================
          SECTION 4 : PRÉFÉRENCES (via useSettings)
      ========================================== */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold mb-4" style={{ color: COLORS.ivory }}>
          <Palette size={20} style={{ color: COLORS.gold }} /> Préférences de l'application
        </h2>
        
        <div className="flex flex-col gap-4">
          {/* Exemple : Thème */}
          <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
            <span className="text-sm font-semibold" style={{ color: COLORS.ivory }}>Thème sombre (Midnight)</span>
            <button
              onClick={() => updateSettings({ theme: settings.theme === "midnight" ? "oled" : "midnight" })}
              className="relative w-12 h-6 rounded-full transition-colors"
              style={{ background: settings.theme === "midnight" ? COLORS.gold : COLORS.muted }}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.theme === "midnight" ? "left-7" : "left-1"}`} />
            </button>
          </div>

          {/* Exemple : Profil privé */}
          <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
            <div>
              <span className="text-sm font-semibold block" style={{ color: COLORS.ivory }}>Profil privé</span>
              <span className="text-xs" style={{ color: COLORS.muted }}>Seuls tes abonnés peuvent voir ton contenu</span>
            </div>
            <button
              onClick={() => updateSettings({ private_profile: !settings.private_profile })}
              className="relative w-12 h-6 rounded-full transition-colors"
              style={{ background: settings.private_profile ? COLORS.gold : COLORS.muted }}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.private_profile ? "left-7" : "left-1"}`} />
            </button>
          </div>
          
          {/* Tu peux ajouter ici les autres toggles de useSettings (notif_push, data_saver, etc.) */}
        </div>
      </section>

    </div>
  );
}
