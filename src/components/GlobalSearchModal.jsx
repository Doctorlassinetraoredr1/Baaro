import { useState, useEffect, useRef } from "react";
import {
  Search,
  X,
  User,
  Hash,
  Swords,
  ArrowRight,
  BadgeCheck,
  Store,
  AlertCircle,
} from "lucide-react";
import { COLORS } from "../theme.js";
import {
  STABLE_USERS,
  getCachedUsers,
  setCachedUsers,
} from "../data/users.js";
import { supabase } from "../supabaseClient.js";

const POPULAR_HASHTAGS = [
  "#GreenTech",
  "#BaroCoin",
  "#AfricaTech",
  "#Web3",
  "#P2PMesh",
  "#Gouvernance",
];

function filterUsers(users, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return users;
  }

  return users.filter((user) => {
    const displayName =
      user.display_name?.toLowerCase() || "";

    const handle =
      user.handle?.toLowerCase() || "";

    const country =
      user.country?.toLowerCase() || "";

    const bio =
      user.bio?.toLowerCase() || "";

    return (
      displayName.includes(normalizedQuery) ||
      handle.includes(normalizedQuery) ||
      country.includes(normalizedQuery) ||
      bio.includes(normalizedQuery)
    );
  });
}

function mapCachedUser(user) {
  return {
    id: user.id,
    display_name: user.display_name || "Membre BAARO",
    handle: user.handle || "@utilisateur",
    flag: user.flag || "🌍",
    country: user.country || "🌍",
    avatar: user.avatar_url || "",
    bio: user.bio || "",
    points: user.points || 0,
    isVerified: Boolean(user.is_verified),
    isSupabase: false,
  };
}

export function GlobalSearchModal({
  isOpen,
  onClose,
  onSelectUser,
  onSelectDebate,
  onSelectShop,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({
    users: [],
    debates: [],
    shops: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Réinitialiser à la fermeture.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults({
        users: [],
        debates: [],
        shops: [],
      });
      setError(null);
    }
  }, [isOpen]);

  // Focus automatique + Escape + focus trap.
  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (
        event.key === "Tab" &&
        modalRef.current
      ) {
        const focusable =
          modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );

        if (!focusable.length) return;

        const first = focusable[0];
        const last =
          focusable[focusable.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isOpen, onClose]);

  // Recherche avec debounce.
  useEffect(() => {
    const trimmedQuery = query.trim();

    // Recherche locale pour les requêtes courtes.
    if (trimmedQuery.length < 2) {
      const cachedUsers = getCachedUsers();

      const localUsers = filterUsers(
        cachedUsers,
        trimmedQuery
      ).map(mapCachedUser);

      const stableUsers = filterUsers(
        STABLE_USERS,
        trimmedQuery
      ).map((user) => ({
        ...user,
        id: user.id,
        isSupabase: false,
      }));

      const seenIds = new Set();

      const mergedUsers = [
        ...localUsers,
        ...stableUsers,
      ].filter((user) => {
        if (!user?.id || seenIds.has(user.id)) {
          return false;
        }

        seenIds.add(user.id);
        return true;
      });

      setResults({
        users: mergedUsers,
        debates: [],
        shops: [],
      });

      setError(null);
      setLoading(false);

      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      const searchQuery = `%${trimmedQuery}%`;

      try {
        // -------------------------------------------
        // 1. Utilisateurs / profiles
        // -------------------------------------------
        let profileUsers = [];
        let profileSearchFailed = false;

        try {
          const {
            data,
            error: profileError,
          } = await supabase
            .from("profiles")
            .select(
              "id, display_name, handle, flag, country, avatar_url, bio, points, is_verified"
            )
            .or(
              `display_name.ilike.${searchQuery},handle.ilike.${searchQuery},country.ilike.${searchQuery},bio.ilike.${searchQuery}`
            )
            .limit(10);

          if (profileError) {
            profileSearchFailed = true;
          } else {
            profileUsers = data || [];

            // Mise à jour du cache uniquement avec
            // les profils publics nécessaires.
            setCachedUsers(profileUsers);
          }
        } catch (profileError) {
          profileSearchFailed = true;

          console.warn(
            "Table 'profiles' indisponible:",
            profileError?.message
          );
        }

        // -------------------------------------------
        // 2. Débats actifs
        // -------------------------------------------
        let dbDebates = [];

        try {
          const {
            data,
            error: debateError,
          } = await supabase
            .from("debate_rooms")
            .select(
              "id, title, topic, invite_code, status"
            )
            .eq("status", "active")
            .or(
              `title.ilike.${searchQuery},topic.ilike.${searchQuery}`
            )
            .limit(5);

          if (!debateError) {
            dbDebates = data || [];
          }
        } catch (debateError) {
          console.warn(
            "Table 'debate_rooms' indisponible:",
            debateError?.message
          );
        }

        // -------------------------------------------
        // 3. Boutiques actives
        // -------------------------------------------
        let dbShops = [];

        try {
          const {
            data,
            error: shopError,
          } = await supabase
            .from("shops")
            .select(
              "id, name, city, country, logo_url, category"
            )
            .eq("is_active", true)
            .or(
              `name.ilike.${searchQuery},city.ilike.${searchQuery},category.ilike.${searchQuery}`
            )
            .limit(5);

          if (!shopError) {
            dbShops = data || [];
          }
        } catch (shopError) {
          console.warn(
            "Table 'shops' indisponible:",
            shopError?.message
          );
        }

        // -------------------------------------------
        // 4. Utilisateurs en fallback cache
        // -------------------------------------------
        let finalUsers = [];

        if (
          profileSearchFailed ||
          profileUsers.length === 0
        ) {
          finalUsers = filterUsers(
            getCachedUsers(),
            trimmedQuery
          ).map(mapCachedUser);
        }

        // Compatibilité avec l'ancien fallback.
        const stableUsers = filterUsers(
          STABLE_USERS,
          trimmedQuery
        ).map((user) => ({
          ...user,
          id: user.id,
          isSupabase: false,
        }));

        finalUsers = [
          ...finalUsers,
          ...stableUsers,
        ];

        // -------------------------------------------
        // 5. Pertinence
        // -------------------------------------------
        const getRelevanceScore = (
          item,
          field
        ) => {
          const value = String(
            item?.[field] || ""
          ).toLowerCase();

          const q = trimmedQuery.toLowerCase();

          if (value === q) return 0;
          if (value.startsWith(q)) return 1;
          if (value.includes(q)) return 2;

          return 3;
        };

        const seenIds = new Set();

        const uniqueUsers = [];

        const addUser = (user) => {
          if (!user?.id) return;
          if (seenIds.has(user.id)) return;

          seenIds.add(user.id);

          uniqueUsers.push(user);
        };

        finalUsers.forEach(addUser);

        // Les profils live Supabase restent prioritaires
        // lorsqu'ils existent.
        for (const user of profileUsers) {
          if (!user?.id) continue;

          if (seenIds.has(user.id)) {
            const existingIndex =
              uniqueUsers.findIndex(
                (item) => item.id === user.id
              );

            if (existingIndex >= 0) {
              uniqueUsers[existingIndex] = {
                id: user.id,
                display_name:
                  user.display_name ||
                  "Membre BAARO",
                handle:
                  user.handle ||
                  "@utilisateur",
                flag:
                  user.flag || "🌍",
                country:
                  user.country || "🌍",
                avatar:
                  user.avatar_url || "",
                bio: user.bio || "",
                points: user.points || 0,
                isVerified:
                  Boolean(user.is_verified),
                isSupabase: true,
                relevance: Math.min(
                  getRelevanceScore(
                    user,
                    "display_name"
                  ),
                  getRelevanceScore(
                    user,
                    "handle"
                  ),
                  getRelevanceScore(
                    user,
                    "country"
                  )
                ),
              };
            }

            continue;
          }

          addUser({
            id: user.id,
            display_name:
              user.display_name ||
              "Membre BAARO",
            handle:
              user.handle ||
              "@utilisateur",
            flag:
              user.flag || "🌍",
            country:
              user.country || "🌍",
            avatar:
              user.avatar_url || "",
            bio: user.bio || "",
            points: user.points || 0,
            isVerified:
              Boolean(user.is_verified),
            isSupabase: true,
            relevance: Math.min(
              getRelevanceScore(
                user,
                "display_name"
              ),
              getRelevanceScore(
                user,
                "handle"
              ),
              getRelevanceScore(
                user,
                "country"
              )
            ),
          });
        }

        uniqueUsers.sort((a, b) => {
          const aScore =
            Number.isFinite(a.relevance)
              ? a.relevance
              : 3;

          const bScore =
            Number.isFinite(b.relevance)
              ? b.relevance
              : 3;

          if (aScore !== bScore) {
            return aScore - bScore;
          }

          if (
            a.isSupabase &&
            !b.isSupabase
          ) {
            return -1;
          }

          if (
            !a.isSupabase &&
            b.isSupabase
          ) {
            return 1;
          }

          return String(
            a.display_name || ""
          ).localeCompare(
            String(b.display_name || "")
          );
        });

        setResults({
          users: uniqueUsers,
          debates: dbDebates,
          shops: dbShops,
        });
      } catch (searchError) {
        console.error(
          "Erreur critique recherche:",
          searchError
        );

        setError(
          "Impossible de contacter le serveur. Vérifie ta connexion."
        );
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  if (!isOpen) {
    return null;
  }

  const hasAnyResults =
    results.users.length > 0 ||
    results.debates.length > 0 ||
    results.shops.length > 0;

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
        onClick={(event) =>
          event.stopPropagation()
        }
        className="w-full max-w-xl rounded-3xl p-5 border shadow-2xl flex flex-col gap-4"
        style={{
          background: COLORS.surface,
          borderColor: COLORS.borderGold,
        }}
      >
        {/* Barre de recherche */}
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm"
          style={{
            background: COLORS.surface2,
            borderColor: COLORS.borderGold,
          }}
        >
          <Search
            size={18}
            style={{ color: COLORS.gold }}
            aria-hidden="true"
          />

          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un membre, hashtag (#Web3), pays (🇸🇳), boutique ou débat..."
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
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

        {/* Hashtags populaires */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
          <span
            className="text-[10px] uppercase font-bold flex-shrink-0"
            style={{ color: COLORS.muted }}
          >
            Populaires :
          </span>

          {POPULAR_HASHTAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setQuery(tag)}
              className="px-2.5 py-1 rounded-xl text-xs border hover:border-amber-400/50 transition flex-shrink-0"
              style={{
                background: COLORS.surface2,
                borderColor: COLORS.border,
                color: COLORS.teal,
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl border text-xs"
            style={{
              background:
                "rgba(239, 68, 68, 0.1)",
              borderColor: "#ef4444",
              color: "#ef4444",
            }}
          >
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Résultats */}
        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          {!loading &&
            !error &&
            query.trim().length >= 2 &&
            !hasAnyResults && (
              <div
                className="text-xs text-center py-8 italic"
                style={{
                  color: COLORS.muted,
                }}
              >
                Aucun résultat pour "{query}"
              </div>
            )}

          {/* Utilisateurs */}
          <div>
            <span
              className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2"
              style={{ color: COLORS.muted }}
            >
              <User size={14} />

              {loading &&
              query.trim().length >= 2
                ? "Recherche en cours..."
                : `Membres (${results.users.length})`}
            </span>

            {results.users.length > 0 && (
              <div className="flex flex-col gap-2">
                {results.users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => {
                      onClose();
                      onSelectUser?.(
                        user.id
                      );
                    }}
                    className="p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:border-amber-400/50 transition group"
                    style={{
                      background:
                        COLORS.surface2,
                      borderColor:
                        COLORS.border,
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        onClose();
                        onSelectUser?.(
                          user.id
                        );
                      }
                    }}
                    aria-label={`Voir le profil de ${user.display_name}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full overflow-hidden border flex items-center justify-center font-bold text-xs shrink-0"
                        style={{
                          borderColor:
                            COLORS.borderGold,
                          background:
                            COLORS.surface,
                        }}
                      >
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg">
                            {user.flag || "🌍"}
                          </span>
                        )}
                      </div>

                      <div>
                        <div
                          className="text-xs font-bold flex items-center gap-1.5"
                          style={{
                            color:
                              COLORS.ivory,
                          }}
                        >
                          {user.display_name}{" "}
                          {user.flag}

                          {user.isVerified && (
                            <BadgeCheck
                              size={14}
                              style={{
                                color:
                                  COLORS.teal,
                              }}
                            />
                          )}

                          {user.isSupabase && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-normal border border-blue-500/30">
                              LIVE
                            </span>
                          )}
                        </div>

                        <div
                          className="text-[11px]"
                          style={{
                            color:
                              COLORS.muted,
                          }}
                        >
                          {user.handle} •{" "}
                          {user.country ||
                            "🌍"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 group-hover:translate-x-1 transition-transform">
                      <span
                        className="text-xs font-mono font-bold"
                        style={{
                          color:
                            COLORS.gold,
                        }}
                      >
                        {user.points || 0} pts
                      </span>

                      <ArrowRight
                        size={14}
                        style={{
                          color:
                            COLORS.muted,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Boutiques */}
          {results.shops.length > 0 && (
            <div
              className="border-t pt-4"
              style={{
                borderColor: COLORS.border,
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2"
                style={{
                  color: COLORS.muted,
                }}
              >
                <Store size={14} />
                Boutiques (
                {results.shops.length})
              </span>

              <div className="flex flex-col gap-2">
                {results.shops.map((shop) => (
                  <div
                    key={shop.id}
                    onClick={() => {
                      onClose();
                      onSelectShop?.(
                        shop.id
                      );
                    }}
                    className="p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:border-amber-400/50 transition group"
                    style={{
                      background:
                        COLORS.surface2,
                      borderColor:
                        COLORS.border,
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        onClose();
                        onSelectShop?.(
                          shop.id
                        );
                      }
                    }}
                    aria-label={`Voir la boutique ${shop.name}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                        style={{
                          background: `${COLORS.gold}20`,
                          color: COLORS.gold,
                        }}
                      >
                        {shop.logo_url ? (
                          <img
                            src={shop.logo_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Store size={18} />
                        )}
                      </div>

                      <div>
                        <div
                          className="text-xs font-bold"
                          style={{
                            color:
                              COLORS.ivory,
                          }}
                        >
                          {shop.name}
                        </div>

                        <div
                          className="text-[11px]"
                          style={{
                            color:
                              COLORS.muted,
                          }}
                        >
                          {shop.category ||
                            "Boutique"}{" "}
                          •{" "}
                          {[
                            shop.city,
                            shop.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </div>
                    </div>

                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                      style={{
                        color:
                          COLORS.muted,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Débats */}
          {results.debates.length > 0 && (
            <div
              className="border-t pt-4"
              style={{
                borderColor: COLORS.border,
              }}
            >
              <span
                className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 mb-2"
                style={{
                  color: COLORS.muted,
                }}
              >
                <Swords size={14} />
                Débats Actifs (
                {results.debates.length})
              </span>

              <div className="flex flex-col gap-2">
                {results.debates.map(
                  (debate) => (
                    <div
                      key={debate.id}
                      onClick={() => {
                        onClose();
                        onSelectDebate?.(
                          debate.invite_code
                        );
                      }}
                      className="p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:border-green-400/50 transition group"
                      style={{
                        background:
                          COLORS.surface2,
                        borderColor:
                          COLORS.border,
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(
                        event
                      ) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          onClose();
                          onSelectDebate?.(
                            debate.invite_code
                          );
                        }
                      }}
                      aria-label={`Rejoindre le débat ${debate.title}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: `${COLORS.teal}20`,
                            color:
                              COLORS.teal,
                          }}
                        >
                          <Hash size={18} />
                        </div>

                        <div>
                          <div
                            className="text-xs font-bold"
                            style={{
                              color:
                                COLORS.ivory,
                            }}
                          >
                            {debate.title}
                          </div>

                          <div
                            className="text-[11px]"
                            style={{
                              color:
                                COLORS.muted,
                            }}
                          >
                            {debate.topic}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-1 rounded-full font-bold bg-green-500/20 text-green-400">
                        REJOINDRE
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
                      }
