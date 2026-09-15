import { getAdminClient, requireUser } from "./_shared.js";

const MAX_ACCOUNTS_PER_DEVICE = 3;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({
      error: "Méthode non autorisée",
    });
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
     * device_id identifie uniquement l'appareil.
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
     * Compte les comptes associés à l'appareil.
     */
    const { count, error: countError } = await admin
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
