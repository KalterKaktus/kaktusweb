import { getSupabase, isConfigReady } from "./supabase-client.js";
import {
    ensureProfile,
    fetchProfile,
    getDisplayName,
    normalizeUsername,
    saveUsername,
    validateUsername,
} from "./profile.js";

function setStatus(message, isError = false) {
    const status = document.getElementById("profile-status");
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function redirectToLogin() {
    const current = window.location.pathname;

    const next = current.includes("login.html")
        ? "/"
        : window.location.pathname + window.location.search;

    window.location.replace(`/login.html?next=${encodeURIComponent(next)}`);
}

async function initProfilePage() {
    if (!isConfigReady()) {
        setStatus("Profil ist gerade nicht verfügbar.", true);
        return;
    }

    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
        redirectToLogin();
        return;
    }

    const user = session.user;
    const emailField = document.getElementById("profile-email");
    const usernameField = document.getElementById("profile-username");
    const form = document.getElementById("profile-form");
    const displayName = document.getElementById("profile-display-name");

    if (emailField) {
        emailField.textContent = user.email || "—";
    }

    const profile = await ensureProfile(user.id);
    const currentName = getDisplayName(user, profile);

    if (displayName) {
        displayName.textContent = currentName;
    }

    if (usernameField && profile?.username) {
        usernameField.value = profile.username;
    }

    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = normalizeUsername(usernameField?.value);
        const validationError = validateUsername(username);

        if (validationError) {
            setStatus(validationError, true);
            return;
        }

        const submitButton = form.querySelector("button[type='submit']");
        submitButton.disabled = true;
        setStatus("Speichern…");

        const { data, error } = await saveUsername(user.id, username);

        if (error) {
            setStatus(error.message, true);
            submitButton.disabled = false;
            return;
        }

        if (displayName) {
            displayName.textContent = getDisplayName(user, data);
        }

        setStatus("Profil gespeichert. In der Navigation wird jetzt dein Benutzername angezeigt.");
        submitButton.disabled = false;
    });
}

initProfilePage();
