import { getAdminClient, requireUser } from "./_shared.js";

const MAX_ACCOUNTS_PER_DEVICE = 3;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée" });
    return;
  }

  let admin;

  try {
    admin = getAdminClient();
  } catch (error) {
    console.error("Erreur client Supabase :", error);

    res.status(500).json({
      error: "Configuration serveur indisponible",
    });
    return;
  }

  let user;

  try {
    user = await requireUser(req, admin);
  } catch (error) {
    console.error("Erreur authentification :", error);

    res.status(error.status || 401).json({
      error: error.message || "Utilisateur non authentifié",
    });
    return;
  }

  const { deviceId } = req.body || {};

  if (
    typeof deviceId !== "string" ||
    deviceId.trim().length === 0 ||
    deviceId.length > 200
  ) {
    res.status(400).json({
      error: "deviceId invalide",
    });
    return;
  }

  const normalizedDeviceId = deviceId.trim();

  try {
    /*
     * Identité utilisateur unique :
     * user.id
     *
     * device_id identifie l'appareil.
     */
    const { error: upsertError } = await admin
      .from("device_accounts")
      .upsert(
        {
          id: user.id,
          device_id: normalizedDeviceId,
        },
        {
          onConflict: "device_id,id",
          ignoreDuplicates: true,
        }
      );

    if (upsertError) {
      console.error(
        "Erreur lors de l'enregistrement de l'appareil :",
        upsertError
      );

      res.status(500).json({
        error: "Impossible d'enregistrer l'appareil",
      });
      return;
    }

    /*
     * Compte le nombre de comptes associés à l'appareil.
     */
    const {
      count,
      error: countError,
    } = await admin
      .from("device_accounts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("device_id", normalizedDeviceId);

    if (countError) {
      console.error(
        "Erreur lors du comptage des comptes :",
        countError
      );

      res.status(500).json({
        error: "Impossible de vérifier les comptes de l'appareil",
      });
      return;
    }

    const accountsOnDevice = count || 0;
    const restricted = accountsOnDevice > MAX_ACCOUNTS_PER_DEVICE;

    /*
     * profiles.id est l'unique identifiant utilisateur.
     */
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        restricted,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error(
        "Erreur lors de la mise à jour du profil :",
        profileError
      );

      res.status(500).json({
        error: "Impossible de mettre à jour le profil",
      });
      return;
    }

    res.status(200).json({
      ok: true,
      accountsOnDevice,
      restricted,
    });
  } catch (error) {
    console.error("Erreur /api/register-device :", error);

    res.status(500).json({
      error: "Erreur lors de l'enregistrement de l'appareil",
    });
  }
}

2. "supabase/migrations/013_device_accounts.sql"

:::writing{variant="document" id="75294" title="supabase/migrations/013_device_accounts.sql"}

-- ============================================================
-- BAARO - Device Accounts
-- ============================================================
-- Identifiant utilisateur unique :
--     auth.users.id = profiles.id = device_accounts.id
--
-- device_id reste uniquement l'identifiant de l'appareil.
-- Aucun user_id n'est utilisé.
-- ============================================================

create table if not exists public.device_accounts (
  id uuid not null
    references auth.users(id)
    on delete cascade,

  device_id text not null,

  created_at timestamptz not null default now(),

  primary key (device_id, id)
);

-- Recherche rapide des comptes associés à un appareil.
create index if not exists device_accounts_device_id_idx
  on public.device_accounts (device_id);

-- Sécurité RLS.
alter table public.device_accounts enable row level security;

-- Les écritures sont effectuées côté serveur par
-- /api/register-device avec le client administrateur.
-- Aucune politique publique n'est nécessaire.

Important : cette migration corrige précisément le problème actuel : "/api/register-device" ne cherche plus "user_id" et la table nécessaire est créée avec "id" comme identifiant utilisateur unique.
