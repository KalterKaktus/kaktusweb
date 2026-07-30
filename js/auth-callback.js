import { getSupabase, isConfigReady } from "./supabase-client.js";
import { t } from "./i18n.js";

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
        setStatus(t("auth.signin_unavailable"), true);
        return;
    }

    const supabase = getSupabase();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorDescription = params.get("error_description");

    if (errorDescription) {
        setStatus("Login abgebrochen. Bitte versuche es erneut.", true);
        return;
    }

    if (code) {
        setStatus("Login wird abgeschlossen…");
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setStatus("Login fehlgeschlagen. Bitte versuche es erneut.", true);
                return;
            }
        }
    } else {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            setStatus(t("auth.invalid_login_link"), true);
            return;
        }
    }

    const target = getReturnPath();
    sessionStorage.removeItem("auth_return_to");
    window.location.replace(target);
}

finishLogin();
