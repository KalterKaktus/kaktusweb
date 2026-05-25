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

function setEmailLoading(isLoading) {
    document.querySelectorAll("#auth-email-form button, #auth-email-form input").forEach((el) => {
        el.disabled = isLoading;
    });
}

async function handleEmailSignIn(event) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
        setStatus("Anmeldung ist gerade nicht verfügbar.", true);
        return;
    }
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    if (!email || !password) {
        setStatus("Bitte E-Mail und Passwort eingeben.", true);
        return;
    }
    setEmailLoading(true);
    setStatus("Anmeldung läuft…");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        setStatus(`Anmeldung fehlgeschlagen: ${error.message}`, true);
        setEmailLoading(false);
        return;
    }
    setStatus("Erfolgreich angemeldet — Weiterleitung…");
    const returnPath = sessionStorage.getItem("auth_return_to") || "/";
    window.location.href = returnPath;
}

async function handleEmailSignUp() {
    const supabase = getSupabase();
    if (!supabase) return;
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    if (!email || !password) {
        setStatus("Bitte E-Mail und Passwort eingeben (min 6 Zeichen).", true);
        return;
    }
    setEmailLoading(true);
    setStatus("Account wird erstellt…");
    const { error, data } = await supabase.auth.signUp({ email, password });
    if (error) {
        setStatus(`Sign-Up fehlgeschlagen: ${error.message}`, true);
        setEmailLoading(false);
        return;
    }
    if (data?.session) {
        // Auto-confirmed (z.B. wenn Supabase Email-Confirm deaktiviert ist)
        setStatus("Account erstellt — Weiterleitung…");
        const returnPath = sessionStorage.getItem("auth_return_to") || "/";
        window.location.href = returnPath;
    } else {
        // Email-Confirm aktiviert: User muss Link in Mail klicken
        setStatus("Account erstellt — bitte E-Mail bestätigen, dann hier anmelden.");
        setEmailLoading(false);
    }
}

function initLoginPage() {
    const returnPath = getReturnPath();
    sessionStorage.setItem("auth_return_to", returnPath);

    // Referral-Code aus URL (?ref=ABCDEF) für späteren claim_referral Aufruf merken.
    // Wird beim nächsten Auth-Login (in auth-nav.js) verbraucht. Lebenszeit: bis localStorage geleert.
    const refParam = new URLSearchParams(window.location.search).get("ref");
    if (refParam && /^[A-Z0-9]{4,12}$/i.test(refParam)) {
        localStorage.setItem("kk_referral_code", refParam.toUpperCase());
    }

    const googleButton = document.getElementById("oauth-google");
    if (googleButton) {
        googleButton.addEventListener("click", startGoogleLogin);
    }

    // Email/Passwort-Login ist überall aktiv (Production + Dev). Fake-Account-Schutz
    // läuft via Supabase Email-Confirm (in Dashboard → Auth → Sign In/Up aktivieren)
    // plus die DB-Anti-Cheat-Trigger.
    const emailForm = document.getElementById("auth-email-form");
    const signUpBtn = document.getElementById("auth-email-signup");
    if (emailForm) emailForm.addEventListener("submit", handleEmailSignIn);
    if (signUpBtn) signUpBtn.addEventListener("click", handleEmailSignUp);

    if (!isConfigReady()) {
        setStatus("Anmeldung ist gerade nicht verfügbar.", true);
        setOAuthLoading(true);
        setEmailLoading(true);
    }
}

initLoginPage();