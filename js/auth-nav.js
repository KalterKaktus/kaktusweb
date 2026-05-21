import { getSupabase, isConfigReady } from "./supabase-client.js";
import { ensureProfile, fetchProfile, getDisplayName } from "./profile.js";

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function truncateLabel(value, maxLength = 18) {
    const text = String(value || "");
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function loginHref() {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    return `/login.html?next=${next}`;
}

function renderLoggedOut(container) {
    container.innerHTML = `<a class="nav-link auth-link" href="${loginHref()}">Login</a>`;
}

function renderConfigMissing(container) {
    container.innerHTML = `<span class="auth-muted">Login</span>`;
}

function renderLoggedIn(container, user, profile) {
    const displayName = getDisplayName(user, profile);
    const label = truncateLabel(displayName);
    const title = profile?.username
        ? `Benutzername: ${displayName}`
        : `E-Mail: ${user.email || displayName}`;

    container.innerHTML = `
        <a class="nav-link auth-profile-link" href="/profile.html" title="${escapeAttr(title)}">${escapeHtml(label)}</a>
        <button type="button" class="auth-btn" id="auth-sign-out-btn">Logout</button>
    `;

    const signOutButton = container.querySelector("#auth-sign-out-btn");
    signOutButton?.addEventListener("click", async () => {
        const supabase = getSupabase();
        if (!supabase) {
            renderLoggedOut(container);
            return;
        }

        signOutButton.disabled = true;
        renderLoggedOut(container);

        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout fehlgeschlagen:", error.message);
        }
    });
}

async function renderSession(container, session) {
    if (!session?.user) {
        renderLoggedOut(container);
        return;
    }

    await ensureProfile(session.user.id);
    const profile = await fetchProfile(session.user.id);
    renderLoggedIn(container, session.user, profile);
}

async function initAuthNav() {
    const container = document.getElementById("auth-nav");
    if (!container) {
        return;
    }

    if (!isConfigReady()) {
        renderConfigMissing(container);
        return;
    }

    try {
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();

        await renderSession(container, session);

        supabase.auth.onAuthStateChange((_event, nextSession) => {
            window.setTimeout(() => {
                renderSession(container, nextSession).catch((error) => {
                    console.error("Auth-Navigation aktualisieren fehlgeschlagen:", error.message);
                    renderLoggedOut(container);
                });
            }, 0);
        });
    } catch (error) {
        console.error("Auth-Navigation laden fehlgeschlagen:", error.message);
        renderLoggedOut(container);
    }
}

initAuthNav();
