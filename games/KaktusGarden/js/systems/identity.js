import { t } from "/js/i18n.js";

/**
 * KaktusGarden startet erst nach erfolgreicher Anmeldung. Dieses Modul ergänzt
 * die bereits geprüfte Session nur um Anzeigename und Level aus dem Profil.
 */
const LOOKUP_TIMEOUT_MS = 4500;

function accountFallback(user) {
  return {
    id: user.id,
    name: user.email?.split("@")[0] || t("garden.guest"),
    level: 1,
    signedIn: true,
  };
}

export async function loadIdentity(auth) {
  if (!auth?.client || !auth?.user?.id) {
    throw new Error("KaktusGarden identity requires an authenticated session.");
  }

  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), LOOKUP_TIMEOUT_MS));
    const identity = await Promise.race([resolveProfile(auth), timeout]);
    return identity || accountFallback(auth.user);
  } catch (error) {
    console.warn("Garden-Profil nicht verfügbar, Session-Name wird verwendet:", error.message);
    return accountFallback(auth.user);
  }
}

async function resolveProfile({ client, user }) {
  const { levelFromXp } = await import("/js/progression.js");
  const { data: profile } = await client
    .from("profiles")
    .select("id,username,total_xp")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    name: profile?.username || user.email?.split("@")[0] || t("garden.guest"),
    level: levelFromXp(profile?.total_xp || 0),
    signedIn: true,
  };
}
