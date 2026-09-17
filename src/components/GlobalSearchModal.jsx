import { useState, useEffect, useRef } from "react";
import { Search, X, User, Hash, Swords, ArrowRight, BadgeCheck, Store, AlertCircle } from "lucide-react";
import { COLORS } from "../theme.js";
import { STABLE_USERS } from "../data/users.js";
import { supabase } from "../supabaseClient.js";

const POPULAR_HASHTAGS = ["#GreenTech", "#BaroCoin", "#AfricaTech", "#Web3", "#P2PMesh", "#Gouvernance"];

export function GlobalSearchModal({ isOpen, onClose, onSelectUser, onSelectDebate, onSelectShop }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ users: [], debates: [], shops: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Réinitialiser à la fermeture
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults({ users: [], debates: [], shops: [] });
      setError(null);
    }
  }, [isOpen]);

  // Focus automatique + fermeture Echap + focus trap
  useEffect(() => {
    if (!isOpen) return;

    setTimeout(() => inputRef.current?.focus(), 100);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      
      // Focus trap basique : Tab ne sort pas de la modale
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  // Recherche avec debounce
  useEffect(() => {
    const trimmedQuery = query.trim();
    
    // Filtre local sur STABLE_USERS si requête trop courte
    if (trimmedQuery.length < 2) {
      const filteredStable = STABLE_USERS.filter((u) =>
        u.display_name?.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
        u.handle?.toLowerCase().includes(trimmedQuery.toLowerCase())
      );
      setResults({ users: filteredStable, debates: [], shops: [] });
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const searchQuery = `%${trimmedQuery}%`;

      try {
        // 1. Recherche dans profiles (avec recherche par pays/drapeau)
        let profileUsers = [];
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, display_name, handle, flag, country, avatar_url, bio, points, is_verified')
            .or(`display_name.ilike.${searchQuery},handle.ilike.${searchQuery},country.ilike.${searchQuery},bio.ilike.${searchQuery}`)
            .limit(10);
          if (!error) profileUsers = data || [];
        } catch (e) {
          console.warn("Table 'profiles' indisponible:", e.message);
        }

        // 2. Recherche des débats actifs
        let dbDebates = [];
        try {
          const { data, error } = await supabase
            .from('debate_rooms')
            .select('id, title, topic, invite_code, status')
            .eq('status', 'active')
            .or(`title.ilike.${searchQuery},topic.ilike.${searchQuery}`)
            .limit(5);
          if (!error) dbDebates = data || [];
        } catch (e) {
          console.warn("Table 'debate_rooms' indisponible:", e.message);
        }

        // 🆕 3. Recherche de boutiques actives
        let dbShops = [];
        try {
          const { data, error } = await supabase
            .from('shops')
            .select('id, name, city, country, logo_url, category')
            .eq('is_active', true)
            .or(`name.ilike.${searchQuery},city.ilike.${searchQuery},category.ilike.${searchQuery}`)
            .limit(5);
          if (!error) dbShops = data || [];
        } catch (e) {
          console.warn("Table 'shops' indisponible:", e.message);
        }

        // 4. Fusion intelligente avec dédoublonnage et tri par pertinence
        const filteredStable = STABLE_USERS.filter((u) =>
          u.display_name?.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
          u.handle?.toLowerCase().includes(trimmedQuery.toLowerCase())
        );

        const seenIds = new Set();
        const finalUsers = [...filteredStable];
        filteredStable.forEach(u => seenIds.add(u.id));

        // Fonction de score de pertinence (plus le score est bas, plus c'est pertinent)
        const getRelevanceScore = (item, field) => {
          const value = String(item[field] || "").toLowerCase();
          const q = trimmedQuery.toLowerCase();
          if (value === q) return 0;           // Match exact
          if (value.startsWith(q)) return 1;   // Commence par
          if (value.includes(q)) return 2;     // Contient
          return 3;                            // Autre (ilike)
        };

        const addUserSafely = (u) => {
          const uid = u.id;
          if (uid && !seenIds.has(uid)) {
            seenIds.add(uid);
            finalUsers.push({
              id: uid,
              display_name: u.display_name || "Membre BAARO",
              handle: u.handle || "@utilisateur",
              flag: u.flag || "🌍",
              country: u.country || "🌍",
              avatar: u.avatar_url || "",
              bio: u.bio || "",
              points: u.points || 0,
              isVerified: u.is_verified || false,
              isSupabase: true,
              relevance: Math.min(
                getRelevanceScore(u, 'display_name'),
                getRelevanceScore(u, 'handle'),
                getRelevanceScore(u, 'country')
              )
            });
          }
        };

        profileUsers.forEach(addUserSafely);

        // Tri par pertinence (les STABLE_USERS gardent leur ordre relatif)
        finalUsers.sort((a, b) => {
          if (a.isSupabase && b.isSupabase) return a.relevance - b.relevance;
          if (a.isSupabase) return 1;  // STABLE_USERS en premier si même pertinence
          if (b.isSupabase) return -1;
          return 0;
        });

        setResults({ users: finalUsers, debates: dbDebates, shops: dbShops });

      } catch (error) {
        console.error("Erreur critique recherche:", error);
        setError("Impossible de contacter le serveur. Vérifie ta connexion.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const hasAnyResults = results.users.length > 0 || results.debates.length > 0 || results.shops.length > 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/75 backdrop-blur-md" 
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-3xl p-5 border shadow-2xl flex flex-col gap-4"
        style={{ background: COLORS.surface, borderColor: COLORS.borderGold }}
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm" style={{ background: COLORS.surface2, borderColor: COLORS.borderGold }}>
          <Search size={18} style={{ color: COLORS.gold }} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un membre, hashtag (#Web3), pays (🇸🇳), boutique ou débat..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: COLORS.ivory }}
            aria-label="Champ de recherche"
          />
          {query && (
            <button 
              onClick={() => setQuery("")} 
              style={{ color: COLORS.muted }} 
              className="hover:text-white transition-colors p-1"
              aria-label="Effacer la recherche"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Hashtags */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
          <span className="text-[10px] uppercase font-bold flex-shrink-0" style={{ color: COLORS.muted }}>Populaires :</span>
          {POPULAR_HASHTAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setQuery(tag)}
              className="px-2.5 py-1 rounded-xl text-xs border hover:border-amber-400/50 transition flex-shrink-0"
              style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.teal }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl border text-xs" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "#ef4444", color: "#ef4444" }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Résultats */}
        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          
          {/* État vide */}
          {!loading && !error && query.length >= 2 && !hasAnyResults && (
            <div className="text-xs text-center py-8 italic" style={{ color: COLORS.muted }}>
              Aucun résultat pour "{query}"
            </div>
          )}

          {/* Section Utilisateurs */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2" style={{ color: COLORS.muted }}>
              <User size={14} />
              {loading && query.length >= 2 ? "Recherche en cours..." : `Membres (${results.users.length})`}
            </span>

            {results.users.length > 0 && (
              <div className="flex flex-col gap-2">
                {results.users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => {
                      onClose();
                      onSelectUser?.(u.id);
                    }}
                    className="p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:border-amber-400/50 transition group"
                    style={{ background: COLORS.surface2, borderColor: COLORS.border }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") { onClose(); onSelectUser?.(u.id); } }}
                    aria-label={`Voir le profil de ${u.display_name}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center font-bold text-xs shrink-0" style={{ borderColor: COLORS.borderGold, background: COLORS.surface }}>
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg">{u.flag || ""}</span>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: COLORS.ivory }}>
                          {u.display_name} {u.flag}
                          {u.isVerified && <BadgeCheck size={14} style={{ color: COLORS.teal }} />}
                          {u.isSupabase && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-normal border border-blue-500/30">
                              LIVE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px]" style={{ color: COLORS.muted }}>{u.handle} • {u.country || "🌍"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                      <span className="text-xs font-mono font-bold" style={{ color: COLORS.gold }}>{u.points || 0} pts</span>
                      <ArrowRight size={14} style={{ color: COLORS.muted }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/*  Section Boutiques */}
          {results.shops.length > 0 && (
            <div className="border-t pt-4" style={{ borderColor: COLORS.border }}>
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2" style={{ color: COLORS.muted }}>
                <Store size={14} />
                Boutiques ({results.shops.length})
              </span>
              
              <div className="flex flex-col gap-2">
                {results.shops.map((shop) => (
                  <div
                    key={shop.id}
                    onClick={() => {
                      onClose();
                      onSelectShop?.(shop.id);
                    }}
                    className="p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:border-amber-400/50 transition group"
                    style={{ background: COLORS.surface2, borderColor: COLORS.border }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") { onClose(); onSelectShop?.(shop.id); } }}
                    aria-label={`Voir la boutique ${shop.name}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: `${COLORS.gold}20`, color: COLORS.gold }}>
                        {shop.logo_url ? (
                          <img src={shop.logo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Store size={18} />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold" style={{ color: COLORS.ivory }}>
                          {shop.name}
                        </div>
                        <div className="text-[11px]" style={{ color: COLORS.muted }}>
                          {shop.category || "Boutique"} • {[shop.city, shop.country].filter(Boolean).join(", ")}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" style={{ color: COLORS.muted }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section Débats */}
          {results.debates.length > 0 && (
            <div className="border-t pt-4" style={{ borderColor: COLORS.border }}>
              <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2" style={{ color: COLORS.muted }}>
                <Swords size={14} />
                Débats Actifs ({results.debates.length})
              </span>
              
              <div className="flex flex-col gap-2">
                {results.debates.map((debate) => (
                  <div
                    key={debate.id}
                    onClick={() => {
                      onClose();
                      onSelectDebate?.(debate.invite_code);
                    }}
                    className="p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:border-green-400/50 transition group"
                    style={{ background: COLORS.surface2, borderColor: COLORS.border }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") { onClose(); onSelectDebate?.(debate.invite_code); } }}
                    aria-label={`Rejoindre le débat ${debate.title}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${COLORS.teal}20`, color: COLORS.teal }}>
                        <Hash size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold" style={{ color: COLORS.ivory }}>
                          {debate.title}
                        </div>
                        <div className="text-[11px]" style={{ color: COLORS.muted }}>
                          {debate.topic}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-green-500/20 text-green-400">
                      REJOINDRE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
