import { getAuthRedirectUrl, getSupabase, isConfigReady } from "./supabase-client.js";

function getReturnPath() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
        return next;
    }
    return "/";
}

function setStatus(message, isError = false) {
    const status = document.getElementById("auth-status");
    if (!status) return;

    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function setOAuthLoading(isLoading) {
    document.querySelectorAll(".auth-oauth-btn").forEach((button) => {
        button.disabled = isLoading;
    });
}

async function startGoogleLogin() {
    const supabase = getSupabase();

    if (!supabase) {
        setStatus("Anmeldung ist gerade nicht verfügbar.", true);
        return;
    }

    setOAuthLoading(true);
    setStatus("Google-Login wird gestartet…");

    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: getAuthRedirectUrl(),
        },
    });

    if (error) {
        setStatus("Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.", true);
        setOAuthLoading(false);
    }
}

function initLoginPage() {
    const returnPath = getReturnPath();
    sessionStorage.setItem("auth_return_to", returnPath);

    const googleButton = document.getElementById("oauth-google");

    if (!googleButton) {
        return;
    }

    googleButton.addEventListener("click", startGoogleLogin);

    if (!isConfigReady()) {
        setStatus("Anmeldung ist gerade nicht verfügbar.", true);
        setOAuthLoading(true);
    }
}

initLoginPage();