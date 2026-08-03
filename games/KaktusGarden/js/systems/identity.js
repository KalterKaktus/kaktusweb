import { t } from "/js/i18n.js";

/**
 * Wer spielt hier? Name und Level kommen aus dem Profil, wenn jemand angemeldet
 * ist — sonst wird als Gast gespielt.
 *
 * Der Supabase-Client hängt an einem CDN-Import; ist der langsam oder
 * blockiert, darf das Spiel davon nicht aufgehalten werden. Deshalb wird das
 * Laden hart begrenzt und fällt danach auf den Gast zurück.
 */
const LOOKUP_TIMEOUT_MS = 4500;

function guest() {
  return { id: `guest-${Math.random().toString(36).slice(2, 8)}`, name: t("garden.guest"), level: 1, signedIn: false };
}

export async function loadIdentity() {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), LOOKUP_TIMEOUT_MS));
    const identity = await Promise.race([resolveProfile(), timeout]);
    return identity || guest();
  } catch (error) {
    console.warn("Profil nicht verfügbar, es wird als Gast gespielt:", error.message);
    return guest();
  }
}

async function resolveProfile() {
  const [{ getSupabase, isConfigReady }, { levelFromXp }] = await Promise.all([
    import("/js/supabase-client.js"),
    import("/js/progression.js"),
  ]);
  if (!isConfigReady()) return null;

  const client = getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.user?.id) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("id,username,total_xp")
    .eq("id", session.user.id)
    .maybeSingle();

  return {
    id: session.user.id,
    name: profile?.username || session.user.email?.split("@")[0] || t("garden.guest"),
    level: levelFromXp(profile?.total_xp || 0),
    signedIn: true,
  };
}
