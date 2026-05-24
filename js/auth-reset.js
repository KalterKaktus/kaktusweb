import { getSupabase, isConfigReady } from "/js/supabase-client.js";

const els = {
    intro: document.getElementById("reset-intro"),
    form: document.getElementById("reset-form"),
    password: document.getElementById("reset-password"),
    confirm: document.getElementById("reset-password-confirm"),
    submit: document.getElementById("reset-submit"),
    status: document.getElementById("reset-status"),
};

function setStatus(el, message, isError = false) {
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", isError);
}

function parseHashParams() {
    // Supabase Recovery-Links liefern Tokens als URL-Fragment (#) statt Query (?)
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const params = new URLSearchParams(raw);
    return {
        access_token: params.get("access_token"),
        refresh_token: params.get("refresh_token"),
        type: params.get("type"),
        error: params.get("error_description") || params.get("error"),
    };
}

async function initReset() {
    if (!isConfigReady()) {
        setStatus(els.intro, "Konfiguration fehlt. Bitte später erneut versuchen.", true);
        return;
    }
    const supabase = getSupabase();
    const hash = parseHashParams();

    if (hash.error) {
        setStatus(els.intro, `Link ungültig: ${decodeURIComponent(hash.error)}`, true);
        return;
    }

    // Wenn schon eine aktive Session existiert (z.B. nach Refresh), reicht das.
    // Sonst Session via Recovery-Tokens aufbauen.
    if (hash.access_token && hash.refresh_token) {
        const { error } = await supabase.auth.setSession({
            access_token: hash.access_token,
            refresh_token: hash.refresh_token,
        });
        if (error) {
            setStatus(els.intro, `Recovery-Token wird abgelehnt: ${error.message}`, true);
            return;
        }
        // Hash entfernen damit beim Reload kein "alter" Token nochmal benutzt wird
        history.replaceState(null, "", window.location.pathname);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
        setStatus(els.intro, "Kein gültiger Recovery-Token erkannt. Bitte den Reset-Link aus der Mail erneut anklicken.", true);
        return;
    }

    els.intro.textContent = `Eingeloggt als ${session.user.email}. Setze jetzt dein neues Passwort.`;
    els.form.hidden = false;
    els.password.focus();
}

async function handleSubmit(event) {
    event.preventDefault();
    setStatus(els.status, "");
    const pw1 = els.password.value;
    const pw2 = els.confirm.value;
    if (!pw1 || pw1.length < 6) {
        setStatus(els.status, "Passwort muss mindestens 6 Zeichen haben.", true);
        return;
    }
    if (pw1 !== pw2) {
        setStatus(els.status, "Passwörter stimmen nicht überein.", true);
        return;
    }
    const supabase = getSupabase();
    els.submit.disabled = true;
    setStatus(els.status, "Passwort wird gespeichert…");
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) {
        setStatus(els.status, `Speichern fehlgeschlagen: ${error.message}`, true);
        els.submit.disabled = false;
        return;
    }
    setStatus(els.status, "✅ Passwort aktualisiert. Du wirst zur Startseite weitergeleitet…");
    setTimeout(() => {
        window.location.href = "/";
    }, 1800);
}

els.form?.addEventListener("submit", handleSubmit);
initReset().catch((err) => {
    console.error("Reset-Init fehlgeschlagen:", err);
    setStatus(els.intro, "Unerwarteter Fehler beim Initialisieren der Reset-Seite.", true);
});
