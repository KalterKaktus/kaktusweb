import { getSupabase, isConfigReady } from "/js/supabase-client.js";
import { fetchProfile, getDisplayName, normalizeUsername, saveUsername, validateUsername } from "/js/profile.js";
import { BADGE_ORDER, BADGES, xpProgress } from "/js/progression.js";

const els = {
    status: document.getElementById("profile-status"),
    loginGate: document.getElementById("profile-login-gate"),
    header: document.getElementById("profile-header"),
    usernameCard: document.getElementById("profile-username-card"),
    usernameForm: document.getElementById("profile-username-form"),
    usernameInput: document.getElementById("profile-username-input"),
    usernameSubmit: document.getElementById("profile-username-submit"),
    usernameStatus: document.getElementById("profile-username-status"),
    badgesCard: document.getElementById("profile-badges-card"),
    vipCard: document.getElementById("profile-vip-card"),
    referralCard: document.getElementById("profile-referral-card"),
    referralLink: document.getElementById("profile-referral-link"),
    referralCopy: document.getElementById("profile-referral-copy"),
    referralPending: document.getElementById("profile-referral-pending"),
    referralQualified: document.getElementById("profile-referral-qualified"),
    statsCard: document.getElementById("profile-stats-card"),
    avatar: document.getElementById("profile-avatar"),
    name: document.getElementById("profile-name"),
    colorTrigger: document.getElementById("profile-color-trigger"),
    colorDot: document.getElementById("profile-color-dot"),
    email: document.getElementById("profile-email"),
    level: document.getElementById("profile-level"),
    xpCurrent: document.getElementById("profile-xp-current"),
    xpNext: document.getElementById("profile-xp-next"),
    xpFill: document.getElementById("profile-xp-fill"),
    xpHint: document.getElementById("profile-xp-hint"),
    badgeGrid: document.getElementById("profile-badge-grid"),
    badgeClear: document.getElementById("profile-badge-clear"),
    statsGrid: document.getElementById("profile-stats-grid"),
};

const VIP_COLOR_PRESETS = [
    "#ffd166", "#ff6b6b", "#ff86c2", "#d58cff",
    "#9f9dff", "#5fb8ff", "#65e2a2", "#a3ff8c",
    "#ff9966", "#c8f5ff", "#ffffff",
];

const fmtNumber = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

let session = null;
let myUserId = null;
let myProfile = null;
let myBadges = new Set();
let equippedBadge = null;

function setStatus(message, isError = false) {
    if (!els.status) return;
    els.status.hidden = !message;
    els.status.textContent = message || "";
    els.status.style.color = isError ? "#ff6b6b" : "";
}

function showLoginGate() {
    setStatus("");
    els.loginGate.hidden = false;
}

function renderHeader(profile, user) {
    const name = getDisplayName(user, profile) || "Spieler";
    const initial = (name[0] || "?").toUpperCase();
    els.avatar.textContent = initial;
    els.name.textContent = name;
    els.name.style.color = profile?.vip ? (profile.vip_color || "") : "";
    els.email.textContent = user?.email || "";

    // Namensfarbe-Button: bei VIP voll funktionsfähig, sonst gesperrt mit Hint
    els.colorTrigger.hidden = false;
    els.colorTrigger.classList.toggle("is-locked", !profile?.vip);
    els.colorDot.style.background = profile?.vip ? (profile.vip_color || "#ffd166") : "#666";

    const xp = Number(profile?.total_xp || 0);
    const prog = xpProgress(xp);
    els.level.textContent = String(prog.level);
    els.xpCurrent.textContent = `${fmtNumber.format(xp)} XP gesamt`;
    els.xpNext.textContent = `${fmtNumber.format(prog.gained)} / ${fmtNumber.format(prog.needed)}`;
    els.xpFill.style.width = `${prog.percent}%`;
    const remaining = Math.max(0, prog.needed - prog.gained);
    els.xpHint.textContent = prog.capped
        ? `Level-Cap 9999 erreicht — du bist der absolute King.`
        : `Nächstes Level in ${fmtNumber.format(remaining)} XP`;

    els.header.hidden = false;
}

function renderBadges() {
    const xp = Number(myProfile?.total_xp || 0);
    const ctx = { level: xpProgress(xp).level };
    const html = BADGE_ORDER.map((id) => {
        const b = BADGES[id];
        if (!b) return "";
        const owned = myBadges.has(id);
        const equipped = equippedBadge === id;
        const locked = !owned;
        const classes = ["badge-card"];
        if (equipped) classes.push("is-equipped");
        if (locked) classes.push("is-locked");
        const lockHint = locked
            ? `<p class="badge-card-desc"><strong>So bekommst du es:</strong> ${b.desc}</p>`
            : `<p class="badge-card-desc">${b.desc}</p>`;
        return `
            <button type="button" class="${classes.join(" ")}" data-badge-id="${id}" style="--badge-c:${b.color}"${locked ? " disabled" : ""}>
                <div class="badge-card-icon">${b.icon}</div>
                <h3 class="badge-card-name">${b.name}</h3>
                ${lockHint}
            </button>
        `;
    }).join("");
    els.badgeGrid.innerHTML = html;
    els.badgesCard.hidden = false;
}

function renderStats() {
    const xp = Number(myProfile?.total_xp || 0);
    const prog = xpProgress(xp);
    const ownedCount = myBadges.size;
    const allCount = BADGE_ORDER.length;
    const stats = [
        { label: "Level", value: prog.level },
        { label: "Gesamt-XP", value: fmtNumber.format(xp) },
        { label: "Badges", value: `${ownedCount}/${allCount}` },
        { label: "VIP", value: myProfile?.vip ? "Aktiv ✨" : "—" },
    ];
    els.statsGrid.innerHTML = stats.map((s) =>
        `<div><dt>${s.label}</dt><dd>${s.value}</dd></div>`
    ).join("");
    els.statsCard.hidden = false;
    els.vipCard.hidden = false;
}

async function equipBadge(badgeId) {
    if (!myUserId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const newValue = badgeId === equippedBadge ? null : badgeId;
    const { error } = await supabase
        .from("profiles")
        .update({ equipped_badge: newValue, updated_at: new Date().toISOString() })
        .eq("id", myUserId);
    if (error) {
        setStatus(`Konnte Badge nicht aktualisieren: ${error.message}`, true);
        return;
    }
    equippedBadge = newValue;
    renderBadges();
}

function bindBadgeClicks() {
    els.badgeGrid.addEventListener("click", (event) => {
        const card = event.target.closest("[data-badge-id]");
        if (!card || card.classList.contains("is-locked")) return;
        equipBadge(card.dataset.badgeId);
    });
    els.badgeClear.addEventListener("click", () => {
        if (equippedBadge) equipBadge(equippedBadge);
    });
}

function renderReferral() {
    if (!myProfile?.referral_code) {
        els.referralCard.hidden = true;
        return;
    }
    // Production-URL aus config.js — sonst kriegen lokal-Tester einen localhost-Link
    // den niemand außer ihnen selbst öffnen kann.
    const baseUrl = window.SITE_URL || window.location.origin;
    const link = `${baseUrl}/login.html?ref=${myProfile.referral_code}`;
    els.referralLink.value = link;
    els.referralCard.hidden = false;
}

function renderReferralStats(stats) {
    els.referralPending.textContent = String(stats.pending || 0);
    els.referralQualified.textContent = String(stats.qualified || 0);
}

async function loadEverything() {
    if (!isConfigReady()) {
        setStatus("Cloud-Verbindung nicht konfiguriert.", true);
        return;
    }
    const supabase = getSupabase();
    const { data: sess } = await supabase.auth.getSession();
    session = sess?.session || null;
    if (!session?.user?.id) {
        showLoginGate();
        return;
    }
    myUserId = session.user.id;

    // Profile + Badges + Referrals parallel laden
    const [profileRes, badgesRes, referralsRes] = await Promise.all([
        supabase
            .from("profiles")
            .select("id, username, avatar_url, total_xp, equipped_badge, vip, vip_color, referral_code, donation_total_cents, donation_count")
            .eq("id", myUserId)
            .maybeSingle(),
        supabase
            .from("user_badges")
            .select("badge_id")
            .eq("user_id", myUserId),
        supabase
            .from("referrals")
            .select("status")
            .eq("referrer_id", myUserId),
    ]);

    if (profileRes.error) {
        setStatus(`Profil konnte nicht geladen werden: ${profileRes.error.message}`, true);
        return;
    }
    myProfile = profileRes.data || { id: myUserId, total_xp: 0 };
    equippedBadge = myProfile.equipped_badge || null;
    myBadges = new Set((badgesRes.data || []).map((row) => row.badge_id));

    const refStats = { pending: 0, qualified: 0 };
    for (const r of (referralsRes.data || [])) {
        if (r.status === "qualified") refStats.qualified++;
        else refStats.pending++;
    }

    setStatus("");
    renderHeader(myProfile, session.user);
    renderUsernameSection();
    renderBadges();
    renderStats();
    renderReferral();
    renderReferralStats(refStats);
}

function showVipLockedDialog() {
    const overlay = document.createElement("div");
    overlay.className = "color-modal-overlay";
    overlay.innerHTML = `
        <div class="color-modal color-modal--locked">
            <button class="color-modal-close" type="button" aria-label="Schliessen">×</button>
            <div class="color-modal-locked-icon">🔒</div>
            <h3>Nur für VIP</h3>
            <p>
                Die Namensfarbe kannst du erst ändern wenn du <strong>👑 VIP</strong> hast.
                VIP-Status wird auf Discord-Anfrage vergeben — schreib mich an wenn du Interesse hast.
            </p>
            <p class="color-modal-tip">VIP gibt zusätzlich +20 % XP-Boost und das goldene VIP-Badge.</p>
        </div>
    `;
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest(".color-modal-close")) overlay.remove();
    });
    document.body.append(overlay);
}

async function saveVipColor(newColor) {
    if (!myUserId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { error } = await supabase
        .from("profiles")
        .update({ vip_color: newColor || null, updated_at: new Date().toISOString() })
        .eq("id", myUserId);
    if (error) {
        setStatus(`Farbe konnte nicht gespeichert werden: ${error.message}`, true);
        return false;
    }
    myProfile.vip_color = newColor || null;
    renderHeader(myProfile, session.user);
    return true;
}

function openColorPicker() {
    const currentColor = myProfile?.vip_color || "#ffd166";
    const overlay = document.createElement("div");
    overlay.className = "color-modal-overlay";
    overlay.innerHTML = `
        <div class="color-modal">
            <button class="color-modal-close" type="button" aria-label="Schliessen">×</button>
            <h3>👑 Namensfarbe wählen</h3>
            <p class="color-modal-preview-row">
                Vorschau: <span class="color-modal-preview" id="color-preview" style="color:${currentColor}">${els.name.textContent || "Dein Name"}</span>
            </p>
            <div class="color-modal-presets">
                ${VIP_COLOR_PRESETS.map((c) => `<button type="button" class="color-preset ${c.toLowerCase() === currentColor.toLowerCase() ? "is-active" : ""}" data-color="${c}" style="--c:${c}" aria-label="${c}"></button>`).join("")}
            </div>
            <label class="color-modal-custom">
                <span>Custom Farbe</span>
                <input type="color" id="color-custom-input" value="${currentColor}">
            </label>
            <div class="color-modal-actions">
                <button type="button" class="profile-button is-ghost" data-action="reset">Zurücksetzen (gold)</button>
                <button type="button" class="profile-button" data-action="save">Speichern</button>
            </div>
        </div>
    `;

    let pickedColor = currentColor;
    const preview = overlay.querySelector("#color-preview");
    const customInput = overlay.querySelector("#color-custom-input");

    function setPicked(color) {
        pickedColor = color;
        preview.style.color = color;
        overlay.querySelectorAll(".color-preset").forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.color.toLowerCase() === color.toLowerCase());
        });
        customInput.value = color;
    }

    overlay.querySelectorAll(".color-preset").forEach((btn) => {
        btn.addEventListener("click", () => setPicked(btn.dataset.color));
    });
    customInput.addEventListener("input", () => setPicked(customInput.value));

    overlay.addEventListener("click", async (e) => {
        if (e.target === overlay || e.target.closest(".color-modal-close")) {
            overlay.remove();
            return;
        }
        const action = e.target.closest("[data-action]")?.dataset.action;
        if (action === "save") {
            const ok = await saveVipColor(pickedColor);
            if (ok) overlay.remove();
        } else if (action === "reset") {
            const ok = await saveVipColor(null);
            if (ok) overlay.remove();
        }
    });

    document.body.append(overlay);
}

els.colorTrigger?.addEventListener("click", () => {
    if (!myProfile) return;
    if (myProfile.vip) {
        openColorPicker();
    } else {
        showVipLockedDialog();
    }
});

function setUsernameStatus(msg, kind = "") {
    if (!els.usernameStatus) return;
    els.usernameStatus.textContent = msg || "";
    els.usernameStatus.classList.toggle("is-error", kind === "error");
    els.usernameStatus.classList.toggle("is-ok", kind === "ok");
}

function renderUsernameSection() {
    if (!els.usernameCard) return;
    els.usernameCard.hidden = false;
    if (els.usernameInput) els.usernameInput.value = myProfile?.username || "";
}

els.usernameForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!myUserId) return;
    const value = normalizeUsername(els.usernameInput.value);
    const validationError = validateUsername(value);
    if (validationError) {
        setUsernameStatus(validationError, "error");
        return;
    }
    if (value === myProfile?.username) {
        setUsernameStatus("Das ist schon dein aktueller Name.", "error");
        return;
    }
    els.usernameSubmit.disabled = true;
    setUsernameStatus("Speichern…");
    const { data, error } = await saveUsername(myUserId, value);
    if (error) {
        setUsernameStatus(error.message, "error");
        els.usernameSubmit.disabled = false;
        return;
    }
    myProfile.username = data?.username || value;
    setUsernameStatus("✓ Username gespeichert. Wird in der Nav + auf Leaderboards verwendet.", "ok");
    renderHeader(myProfile, session.user);
    els.usernameSubmit.disabled = false;
});

// Copy-Button für Referral-Link
els.referralCopy?.addEventListener("click", async () => {
    const link = els.referralLink?.value;
    if (!link) return;
    try {
        await navigator.clipboard.writeText(link);
        els.referralCopy.textContent = "✓ Kopiert";
        setTimeout(() => { els.referralCopy.textContent = "Kopieren"; }, 1600);
    } catch {
        // Fallback: Input selektieren damit User Cmd+C drücken kann
        els.referralLink.select();
        els.referralCopy.textContent = "Manuell kopieren (Strg+C)";
    }
});

bindBadgeClicks();
loadEverything().catch((err) => {
    console.error(err);
    setStatus("Etwas ist schiefgelaufen beim Laden des Profils.", true);
});
