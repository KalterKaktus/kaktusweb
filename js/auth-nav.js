import { getSupabase, isConfigReady } from "./supabase-client.js";
import { ensureProfile, fetchProfile, getDisplayName } from "./profile.js";
import { setXpUser } from "./xp-service.js";
import { levelFromXp, renderLevelTag, renderPlayerName } from "./progression.js";

const PRESENCE_HEARTBEAT_MS = 30000;
const FORCE_RELOAD_MESSAGE = "Dein Spielstand wurde aktualisiert. Die Seite wird neu geladen.";

let adminMessageChannel = null;
let presenceTimer = null;
let activeSessionUserId = "";
const siteMessageQueue = [];

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
    const current = window.location.pathname;

    const next = current.includes("login.html")
        ? "/"
        : window.location.pathname + window.location.search;

    return `/login.html?next=${encodeURIComponent(next)}`;
}

function profileHref() {
    return window.location.pathname.startsWith("/adminpanel")
        ? "/profile/?from=adminpanel"
        : "/profile/";
}

function blockTouchDoubleTapZoom() {
    document.addEventListener("dblclick", (event) => {
        if (window.matchMedia("(pointer: coarse)").matches) {
            event.preventDefault();
        }
    }, { passive: false });
}

function setupSiteNav() {
    document.querySelectorAll(".nav").forEach((nav, index) => {
        const container = nav.querySelector(".nav-container");
        const links = nav.querySelector(".nav-links");
        if (!container || !links || container.querySelector(".nav-toggle")) {
            return;
        }

        const menuId = links.id || `site-nav-menu-${index + 1}`;
        links.id = menuId;

        const toggle = document.createElement("button");
        toggle.className = "nav-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-controls", menuId);
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Navigation öffnen");
        toggle.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        container.insertBefore(toggle, links);

        const setOpen = (open) => {
            nav.classList.toggle("is-menu-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Navigation schließen" : "Navigation öffnen");
            document.body.classList.toggle("nav-menu-open", open);
        };

        toggle.addEventListener("click", () => {
            setOpen(!nav.classList.contains("is-menu-open"));
        });

        links.addEventListener("click", (event) => {
            if (event.target.closest("a")) {
                setOpen(false);
            }
        });

        document.addEventListener("click", (event) => {
            if (nav.classList.contains("is-menu-open") && !nav.contains(event.target)) {
                setOpen(false);
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        });

        window.addEventListener("resize", () => {
            if (window.matchMedia("(min-width: 761px)").matches) {
                setOpen(false);
            }
        });
    });
}

function renderLoggedOut(container) {
    container.innerHTML = `<a class="nav-link auth-link" href="${loginHref()}">Login</a>`;
}

function renderConfigMissing(container) {
    container.innerHTML = `<span class="auth-muted">Login</span>`;
}

function currentPagePath() {
    return `${window.location.pathname}${window.location.hash || ""}`;
}

async function syncPresence(user) {
    const supabase = getSupabase();
    if (!supabase || !user?.id) {
        return;
    }

    const { error } = await supabase
        .from("user_presence")
        .upsert({
            user_id: user.id,
            path: currentPagePath(),
            last_seen: new Date().toISOString(),
        }, { onConflict: "user_id" });

    if (error) {
        console.error("Online-Status konnte nicht aktualisiert werden:", error.message);
    }
}

async function markSiteAdminMessageRead(user, messageId) {
    const supabase = getSupabase();
    if (!supabase || !user?.id || !messageId) {
        return false;
    }

    const { data, error } = await supabase
        .from("admin_messages")
        .update({ read: true })
        .eq("id", messageId)
        .eq("user_id", user.id)
        .eq("read", false)
        .select("id");

    if (error) {
        console.error("Admin-Nachricht konnte nicht markiert werden:", error.message);
        return false;
    }

    return Boolean(data?.length);
}

function openNextSiteMessage() {
    if (document.querySelector(".site-message-backdrop") || !siteMessageQueue.length) {
        return;
    }

    const message = siteMessageQueue.shift();
    const backdrop = document.createElement("div");
    backdrop.className = "site-message-backdrop";
    backdrop.innerHTML = `
        <section class="site-message" role="dialog" aria-modal="true" aria-labelledby="site-message-title">
            <p class="page-kicker">KalterKaktus Nachricht</p>
            <h2 id="site-message-title">Admin-Nachricht</h2>
            <p>${escapeHtml(message)}</p>
            <button class="auth-btn site-message-button" type="button">Okay</button>
        </section>
    `;
    backdrop.querySelector("button")?.addEventListener("click", () => {
        backdrop.remove();
        openNextSiteMessage();
    });
    document.body.append(backdrop);
}

async function handleSiteAdminMessage(user, message) {
    if (!message || message.read) {
        return;
    }

    const claimed = await markSiteAdminMessageRead(user, message.id);
    if (!claimed) {
        return;
    }

    if (message.message === FORCE_RELOAD_MESSAGE) {
        window.dispatchEvent(new CustomEvent("kk-admin-reload"));
        window.location.reload();
        return;
    }

    siteMessageQueue.push(message.message || "Du hast eine neue Nachricht.");
    openNextSiteMessage();
}

async function loadUnreadSiteAdminMessages(user) {
    const supabase = getSupabase();
    if (!supabase || !user?.id) {
        return;
    }

    const { data, error } = await supabase
        .from("admin_messages")
        .select("id,message,read")
        .eq("user_id", user.id)
        .eq("read", false)
        .order("created_at", { ascending: true })
        .limit(10);

    if (error) {
        console.error("Admin-Nachrichten konnten nicht geladen werden:", error.message);
        return;
    }

    for (const message of data || []) {
        await handleSiteAdminMessage(user, message);
    }
}

function subscribeSiteAdminMessages(user) {
    const supabase = getSupabase();
    if (!supabase || !user?.id) {
        return;
    }

    adminMessageChannel = supabase
        .channel(`site-admin-messages-${user.id}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "admin_messages",
                filter: `user_id=eq.${user.id}`,
            },
            (payload) => {
                handleSiteAdminMessage(user, payload.new).catch((error) => {
                    console.error("Admin-Nachricht anzeigen fehlgeschlagen:", error.message);
                });
            }
        )
        .subscribe();
}

async function stopSessionFeatures() {
    window.clearInterval(presenceTimer);
    presenceTimer = null;
    activeSessionUserId = "";

    const supabase = getSupabase();
    if (supabase && adminMessageChannel) {
        await supabase.removeChannel(adminMessageChannel);
    }
    adminMessageChannel = null;
}

async function maybeClaimPendingReferral() {
    const code = localStorage.getItem("kk_referral_code");
    if (!code) return;
    const supabase = getSupabase();
    if (!supabase) return;
    try {
        const { data, error } = await supabase.rpc("claim_referral", { referrer_code: code });
        if (!error) {
            localStorage.removeItem("kk_referral_code");
            if (data === true) {
                console.info("[referral] Werbung registriert für Code", code);
            }
        }
    } catch (e) {
        console.debug("[referral] claim failed:", e?.message || e);
    }
}

async function startSessionFeatures(user) {
    if (!user?.id) {
        await stopSessionFeatures();
        return;
    }

    if (activeSessionUserId === user.id) {
        await syncPresence(user);
        return;
    }

    await stopSessionFeatures();
    activeSessionUserId = user.id;
    await syncPresence(user);
    // Wenn der User mit ?ref= reingekommen ist (gespeichert in localStorage) → jetzt einlösen.
    await maybeClaimPendingReferral();
    presenceTimer = window.setInterval(() => {
        syncPresence(user);
    }, PRESENCE_HEARTBEAT_MS);
    subscribeSiteAdminMessages(user);
    await loadUnreadSiteAdminMessages(user);
}

function renderLoggedIn(container, user, profile) {
    const displayName = getDisplayName(user, profile);
    const label = truncateLabel(displayName);
    const title = profile?.username
        ? `Benutzername: ${displayName}`
        : `E-Mail: ${user.email || displayName}`;

    // Level + equipped Badge — wie auf Leaderboards. VIP-Farbe wird auch hier angewandt.
    const level = levelFromXp(profile?.total_xp);
    const levelTag = renderLevelTag(level, profile?.equipped_badge || null);
    const styledName = renderPlayerName(escapeHtml(label), {
        vip: Boolean(profile?.vip),
        vipColor: profile?.vip_color || null,
    });

    container.innerHTML = `
        <a class="nav-link auth-profile-link" href="${profileHref()}" title="${escapeAttr(title)}">${levelTag}${styledName}</a>
        <button type="button" class="auth-btn" id="auth-sign-out-btn">Logout</button>
    `;

    const signOutButton = container.querySelector("#auth-sign-out-btn");
    signOutButton?.addEventListener("click", async () => {
        const supabase = getSupabase();
        if (!supabase) {
            renderLoggedOut(container);
            window.location.replace("/");
            return;
        }

        signOutButton.disabled = true;
        renderLoggedOut(container);

        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout fehlgeschlagen:", error.message);
        }
        // Nach Logout zur Homepage — sonst läuft das Game (oder andere
        // page-specific Auth-State) mit halb-resettetem Zustand weiter.
        // replace() statt href: kein Back-Button zur authenticated Page.
        window.location.replace("/");
    });
}

async function renderSession(container, session) {
    if (!session?.user) {
        renderLoggedOut(container);
        await stopSessionFeatures();
        return;
    }

    await ensureProfile(session.user.id);
    const profile = await fetchProfile(session.user.id);

    // Ban-Enforcement (zentral): jeder Page-Load checkt is_banned und kickt
    // den User raus. Daten bleiben unverändert — bei Unban läuft alles weiter.
    if (profile?.is_banned) {
        await handleBannedSession(container);
        return;
    }

    renderLoggedIn(container, session.user, profile);
    await startSessionFeatures(session.user);
}

let bannedRedirectInFlight = false;
async function handleBannedSession(container) {
    if (bannedRedirectInFlight) return;
    bannedRedirectInFlight = true;

    await stopSessionFeatures();
    const supabase = getSupabase();
    if (supabase) {
        try { await supabase.auth.signOut(); } catch {}
    }
    renderLoggedOut(container);

    // Auf /login.html wartet der ?banned=1 Param schon — login.js zeigt
    // dann den Hinweis sticky. Auf anderen Pages: kurzer Hinweis + redirect.
    if (window.location.pathname !== "/login.html") {
        try { window.alert("Dein Account wurde gesperrt."); } catch {}
        window.location.replace("/login.html?banned=1");
    }
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
            renderSession(container, nextSession).catch((error) => {
                console.error("Auth-Navigation aktualisieren fehlgeschlagen:", error.message);
                renderLoggedOut(container);
            });
        });
    } catch (error) {
        console.error("Auth-Navigation laden fehlgeschlagen:", error.message);
        renderLoggedOut(container);
    }
}

setupSiteNav();
blockTouchDoubleTapZoom();
initAuthNav();
