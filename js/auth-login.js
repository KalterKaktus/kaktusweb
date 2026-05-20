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
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

async function initLoginPage() {
    const form = document.getElementById("magic-link-form");
    if (!form) {
        return;
    }

    const returnPath = getReturnPath();
    sessionStorage.setItem("auth_return_to", returnPath);

    if (!isConfigReady()) {
        setStatus("Supabase ist nicht konfiguriert. Lege js/config.js an (siehe js/config.example.js).", true);
        form.querySelector("button")?.setAttribute("disabled", "disabled");
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailInput = document.getElementById("auth-email");
        const submitButton = form.querySelector("button[type='submit']");
        const email = String(emailInput?.value || "").trim();

        if (!email) {
            setStatus("Bitte eine E-Mail-Adresse eingeben.", true);
            return;
        }

        const supabase = getSupabase();
        if (!supabase) {
            setStatus("Supabase-Client konnte nicht geladen werden.", true);
            return;
        }

        submitButton.disabled = true;
        setStatus("Magic Link wird gesendet…");

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: getAuthRedirectUrl(),
            },
        });

        if (error) {
            setStatus(`Fehler: ${error.message}`, true);
            submitButton.disabled = false;
            return;
        }

        setStatus("E-Mail gesendet. Öffne den Link in deinem Postfach, um dich anzumelden.");
        form.reset();
        submitButton.disabled = false;
    });
}

initLoginPage();
