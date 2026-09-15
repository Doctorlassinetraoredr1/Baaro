import { useEffect, useState } from "react";
import {
  Coins,
  Radio,
  Shield,
  Sparkles,
} from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { TurnstileWidget } from "../../Turnstile.jsx";
import { COLORS } from "../../theme.js";
import {
  captureRefFromUrl,
  getPendingRef,
} from "../../lib/referralApi.js";

export default function AuthScreen() {
  const [mode, setMode] = useState("anonymous");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] =
    useState(null);
  const [error, setError] = useState(null);
  const [captchaToken, setCaptchaToken] =
    useState(null);
  const [pendingRef, setPendingRef] =
    useState(null);

  useEffect(() => {
    captureRefFromUrl();
    setPendingRef(getPendingRef());
  }, []);

  const handleAnonymous = async (token) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const useCaptcha =
        token && token !== "dev-bypass";

      const {
        data,
        error: authError,
      } = await supabase.auth.signInAnonymously(
        useCaptcha
          ? {
              options: {
                captchaToken: token,
              },
            }
          : undefined
      );

      if (authError) {
        throw authError;
      }

      if (!data?.session) {
        throw new Error(
          "Session non créée"
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Impossible de se connecter. Vérifiez que l'authentification anonyme est activée dans Supabase."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const {
          error: authError,
        } = await supabase.auth.signInWithPassword(
          {
            email: email.trim(),
            password,
          }
        );

        if (authError) {
          throw authError;
        }
      } else {
        const username =
          email
            .trim()
            .split("@")[0]
            .slice(0, 20);

        const {
          data,
          error: authError,
        } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: username,
              handle: `@${username}`,
            },
          },
        });

        if (authError) {
          throw authError;
        }

        // Si Supabase demande une confirmation email,
        // la session peut être absente temporairement.
        if (!data?.session) {
          setError(
            "Compte créé. Vérifiez votre email pour confirmer votre inscription."
          );
        }
      }
    } catch (err) {
      setError(
        err.message ||
          "Erreur d'authentification"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    if (loading || oauthLoading) return;

    setOauthLoading(provider);
    setError(null);

    try {
      const {
        error: authError,
      } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            window.location.origin,
        },
      });

      if (authError) {
        throw authError;
      }
    } catch (err) {
      setError(
        err.message ||
          "Erreur de connexion"
      );

      setOauthLoading(null);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "#0B1220",
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 border shadow-2xl"
        style={{
          background:
            "rgba(15, 23, 42, 0.95)",
          borderColor:
            COLORS.borderGold ||
            "#D9AE52",
        }}
      >
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, #D9AE52 0%, #2DBFA6 100%)",
              color:
                COLORS.bg || "#0B1220",
            }}
          >
            B
          </div>

          <h1
            className="text-2xl font-bold"
            style={{
              color:
                COLORS.gold ||
                "#D9AE52",
            }}
          >
            BAARO
          </h1>

          <p
            className="text-base font-semibold mt-2"
            style={{
              color:
                COLORS.ivory ||
                "#f1f5f9",
            }}
          >
            Gagne. Échange. Convertis.
          </p>

          <p
            className="text-sm mt-2 leading-relaxed"
            style={{
              color:
                COLORS.muted ||
                "#94a3b8",
            }}
          >
            Découvre BAARO, participe,
            échange et gagne des points.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            {
              icon: Coins,
              label: "Points → valeur",
              color: COLORS.gold,
            },
            {
              icon: Radio,
              label: "Lives + IA",
              color: COLORS.purple,
            },
            {
              icon: Shield,
              label: "Chat sécurisé",
              color: COLORS.teal,
            },
          ].map(
            ({
              icon: Icon,
              label,
              color,
            }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center"
                style={{
                  background:
                    "rgba(255,255,255,0.03)",
                  borderColor:
                    "rgba(255,255,255,0.08)",
                }}
              >
                <Icon
                  size={18}
                  style={{ color }}
                />

                <span
                  className="text-[10px] font-medium"
                  style={{
                    color:
                      COLORS.muted,
                  }}
                >
                  {label}
                </span>
              </div>
            )
          )}
        </div>

        {pendingRef && (
          <div
            className="mb-5 p-3 rounded-xl text-xs text-center border"
            style={{
              background:
                "rgba(45,191,166,0.1)",
              borderColor:
                COLORS.borderTeal,
              color:
                COLORS.teal,
            }}
          >
            Code parrain détecté :
            <strong className="font-mono">
              {" "}
              {pendingRef}
            </strong>
          </div>
        )}

        {mode === "anonymous" && (
          <div className="flex flex-col gap-5">
            <p
              className="text-sm text-center font-medium"
              style={{
                color:
                  COLORS.ivory ||
                  "#f1f5f9",
              }}
            >
              Entre gratuitement
            </p>

            <div className="flex justify-center">
              <TurnstileWidget
                onVerify={(token) => {
                  setCaptchaToken(token);

                  if (token) {
                    handleAnonymous(token);
                  }
                }}
              />
            </div>

            {loading && (
              <div
                className="text-center text-sm flex items-center justify-center gap-2"
                style={{
                  color:
                    COLORS.muted,
                }}
              >
                <Sparkles
                  size={14}
                  style={{
                    color:
                      COLORS.gold,
                  }}
                />
                Connexion en cours...
              </div>
            )}

            {error && (
              <div className="text-center text-sm text-rose-400 bg-rose-500/10 rounded-xl p-3">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div
                className="flex-1 h-px"
                style={{
                  background:
                    COLORS.border ||
                    "#334155",
                }}
              />

              <span
                className="text-xs"
                style={{
                  color:
                    COLORS.muted,
                }}
              >
                ou
              </span>

              <div
                className="flex-1 h-px"
                style={{
                  background:
                    COLORS.border ||
                    "#334155",
                }}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                handleOAuth(
                  "facebook"
                )
              }
              disabled={
                !!oauthLoading
              }
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
              style={{
                background:
                  "#1877F2",
                color: "#fff",
              }}
            >
              {oauthLoading ===
              "facebook"
                ? "Connexion..."
                : "Continuer avec Facebook"}
            </button>

            <button
              type="button"
              onClick={() =>
                handleOAuth("twitter")
              }
              disabled={
                !!oauthLoading
              }
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
              style={{
                background:
                  "#000000",
                color: "#fff",
                border:
                  "1px solid #334155",
              }}
            >
              {oauthLoading ===
              "twitter"
                ? "Connexion..."
                : "Continuer avec X"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("email");
                setError(null);
              }}
              className="text-sm text-center underline"
              style={{
                color:
                  COLORS.teal ||
                  "#2DBFA6",
              }}
            >
              Se connecter ou créer
              un compte avec email
            </button>

            <p
              className="text-[10px] text-center"
              style={{
                color:
                  COLORS.muted,
              }}
            >
              Tu peux également
              découvrir BAARO en mode
              invité.
            </p>

            <button
              type="button"
              onClick={async () => {
                try {
                  localStorage.setItem(
                    "baaro_is_guest",
                    "true"
                  );
                } catch {}

                window.location.reload();
              }}
              className="text-xs underline"
              style={{
                color:
                  COLORS.muted,
              }}
            >
              Continuer en tant
              qu'invité
            </button>
          </div>
        )}

        {mode === "email" && (
          <form
            onSubmit={handleEmailSubmit}
            className="flex flex-col gap-4"
          >
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl border bg-transparent outline-none text-sm"
              style={{
                borderColor:
                  COLORS.border ||
                  "#334155",
                color:
                  COLORS.ivory ||
                  "#f1f5f9",
              }}
            />

            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
              required
              minLength={6}
              autoComplete={
                isLogin
                  ? "current-password"
                  : "new-password"
              }
              className="w-full px-4 py-3 rounded-xl border bg-transparent outline-none text-sm"
              style={{
                borderColor:
                  COLORS.border ||
                  "#334155",
                color:
                  COLORS.ivory ||
                  "#f1f5f9",
              }}
            />

            {error && (
              <div className="text-center text-sm text-rose-400 bg-rose-500/10 rounded-xl p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, #D9AE52 0%, #2DBFA6 100%)",
                color: "#0B1220",
              }}
            >
              {loading
                ? "Chargement..."
                : isLogin
                  ? "Se connecter"
                  : "Créer un compte"}
            </button>

            <div
              className="flex justify-between text-xs"
              style={{
                color:
                  COLORS.muted,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsLogin(
                    (value) => !value
                  );
                  setError(null);
                }}
                className="underline"
              >
                {isLogin
                  ? "Créer un compte"
                  : "Déjà un compte ?"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode(
                    "anonymous"
                  );
                  setError(null);
                }}
                className="underline"
              >
                Retour
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
