import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

let client = null;

export function isConfigReady() {
    const key = String(window.SUPABASE_ANON_KEY || "");
    return Boolean(
        window.SUPABASE_URL &&
        key &&
        !key.includes("DEIN_sb_publishable")
    );
}

export function getSupabase() {
    if (!isConfigReady()) {
        return null;
    }

    if (!client) {
        client = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
            auth: {
                flowType: "pkce",
                detectSessionInUrl: false,
                persistSession: true,
                autoRefreshToken: true,
            },
        });
    }

    return client;
}

export function getAuthRedirectUrl() {
    const base = String(window.SITE_URL || window.location.origin).replace(/\/$/, "");
    return `${base}/auth/callback.html`;
}
