import { getSupabase, isConfigReady } from "./supabase-client.js";

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

function loginHref() {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    return `/login.html?next=${next}`;
}

function renderLoggedOut(container) {
    container.innerHTML = `<a class="nav-link auth-link" href="${loginHref()}">Anmelden</a>`;
}

function renderConfigMissing(container) {
    container.innerHTML = `<span class="auth-muted" title="js/config.js anlegen (siehe js/config.example.js)">Login</span>`;
}

function renderLoggedIn(container, user) {
    const email = user.email || "Account";
    const label = email.length > 20 ? `${email.slice(0, 18)}…` : email;

    container.innerHTML = `
        <span class="auth-user" title="${escapeAttr(email)}">${escapeHtml(label)}</span>
        <button type="button" class="auth-btn" id="auth-sign-out-btn">Abmelden</button>
    `;

    const signOutButton = container.querySelector("#auth-sign-out-btn");
    signOutButton?.addEventListener("click", async () => {
        const supabase = getSupabase();
        if (!supabase) {
            return;
        }

        signOutButton.disabled = true;
        await supabase.auth.signOut();
        renderLoggedOut(container);
    });
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

    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
        renderLoggedIn(container, session.user);
    } else {
        renderLoggedOut(container);
    }

    supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.user) {
            renderLoggedIn(container, nextSession.user);
        } else {
            renderLoggedOut(container);
        }
    });
}

initAuthNav();
