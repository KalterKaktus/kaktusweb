import { getSupabase, isConfigReady } from "./supabase-client.js";

function getReturnPath() {
    const stored = sessionStorage.getItem("auth_return_to");
    if (stored && stored.startsWith("/") && !stored.startsWith("//")) {
        return stored;
    }
    return "/";
}

function setStatus(message, isError = false) {
    const status = document.getElementById("callback-status");
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

async function finishLogin() {
    if (!isConfigReady()) {
        setStatus("Supabase ist nicht konfiguriert (js/config.js fehlt).", true);
        return;
    }

    const supabase = getSupabase();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorDescription = params.get("error_description");

    if (errorDescription) {
        setStatus(`Login abgebrochen: ${errorDescription}`, true);
        return;
    }

    if (code) {
        setStatus("Login wird abgeschlossen…");
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            setStatus(`Login fehlgeschlagen: ${error.message}`, true);
            return;
        }
    } else {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            setStatus("Kein gültiger Login-Link. Bitte erneut anmelden.", true);
            return;
        }
    }

    const target = getReturnPath();
    sessionStorage.removeItem("auth_return_to");
    window.location.replace(target);
}

finishLogin();
