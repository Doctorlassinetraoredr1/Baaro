import { supabase } from "../supabaseClient.js";
import { API_BASE } from "../config.js";

/**
 * Génère les headers d'authentification.
 */
async function authHeaders() {
  const { data } =
    await supabase.auth.getSession();

  const token =
    data?.session?.access_token;

  return {
    "Content-Type": "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

/**
 * Fonction générique pour les requêtes wallet.
 */
async function walletRequest(body) {
  try {
    const res = await fetch(
      `${API_BASE}/api/wallet`,
      {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(body),
      }
    );

    const json = await res
      .json()
      .catch(() => ({}));

    if (!res.ok) {
      return {
        ok: false,
        error:
          json?.error ||
          res.statusText ||
          "Erreur wallet",
        status: res.status,
      };
    }

    return {
      ok: true,
      ...json,
    };
  } catch (error) {
    console.error(
      "Wallet API Error:",
      error
    );

    return {
      ok: false,
      error:
        error?.message ||
        "Erreur de connexion au serveur",
      status: 500,
    };
  }
}

// --------------------------------------------------
// Wallet
// --------------------------------------------------

export const walletStatus = () =>
  walletRequest({
    action: "status",
  });

export const walletEarn = (
  actionKey,
  detail = "",
  referenceId = null
) =>
  walletRequest({
    action: "earn",
    actionKey,
    detail,
    referenceId,
  });

export const walletRedeem = (
  optionId
) =>
  walletRequest({
    action: "redeem",
    optionId,
  });

export const walletConvert = (
  pts
) =>
  walletRequest({
    action: "convert",
    pts,
  });

export async function earnPoints(
  actionKey,
  detail = "",
  referenceId = null
) {
  return walletEarn(
    actionKey,
    detail,
    referenceId
  );
}

// --------------------------------------------------
// Cadeaux / Live / PK
// --------------------------------------------------

export async function sendGift(
  receiverId,
  giftId,
  amount = 1,
  pkBattleId = null
) {
  if (!receiverId || !giftId) {
    return {
      ok: false,
      error:
        "receiverId et giftId sont obligatoires",
      status: 400,
    };
  }

  return walletRequest({
    action: "send_gift",
    receiverId,
    giftId,
    amount,
    pkBattleId,
  });
}

// --------------------------------------------------
// Retraits
// --------------------------------------------------

export async function requestWithdrawal(
  amount,
  payment_method,
  account_details
) {
  if (
    !amount ||
    !payment_method ||
    !account_details
  ) {
    return {
      ok: false,
      error:
        "amount, payment_method et account_details sont obligatoires",
      status: 400,
    };
  }

  if (amount < 1000) {
    return {
      ok: false,
      error:
        "Le montant minimum de retrait est de 1000 pépites",
      status: 400,
    };
  }

  return walletRequest({
    action: "withdraw",
    amount,
    payment_method,
    account_details,
  });
}

// --------------------------------------------------
// Solde
// --------------------------------------------------

export async function getWalletBalance() {
  return walletRequest({
    action: "get_balance",
  });
}

// --------------------------------------------------
// Recharge
// --------------------------------------------------

export async function topupDiamonds(
  amount,
  provider = "cinetpay"
) {
  if (!amount || amount < 100) {
    return {
      ok: false,
      error:
        "Le montant minimum de recharge est de 100 FCFA",
      status: 400,
    };
  }

  return walletRequest({
    action: "topup",
    amount,
    provider,
  });
}
