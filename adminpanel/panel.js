import { getSupabase, isConfigReady } from "/js/supabase-client.js";

const usersRoot = document.getElementById("admin-users");
const status = document.getElementById("admin-status");
const refreshButton = document.getElementById("admin-refresh");
const adminAbuseRoot = document.getElementById("admin-abuse");
const adminAbuseGame = document.getElementById("admin-abuse-game");

function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
    return escapeHtml(value);
}

function formatNumber(value) {
    return Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatGameName(gameId) {
    if (gameId === "kaktus-clicker") {
        return "KaktusClicker";
    }

    return String(gameId || "Game")
        .split(/[-_]/)
        .filter(Boolean)
        .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
        .join(" ");
}

function jsonText(value) {
    return JSON.stringify(value ?? {}, null, 2);
}

function formatPresenceTitle(presence) {
    if (presence?.online) {
        return presence.path || "Online";
    }

    if (presence?.path) {
        return `Zuletzt auf ${presence.path} - ${formatDate(presence.last_seen)}`;
    }

    return "Kein aktiver Seitenstatus";
}

async function getAccessToken() {
    if (!isConfigReady()) {
        throw new Error("Supabase-Login ist nicht konfiguriert.");
    }

    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
        throw new Error("Bitte zuerst mit deinem Admin-Account einloggen.");
    }

    return session.access_token;
}

async function api(action, payload) {
    const accessToken = await getAccessToken();
    const response = await fetch("/adminpanel/api", {
        method: action === "list" ? "GET" : "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: action === "list" ? undefined : JSON.stringify({ action, ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Admin-Aktion fehlgeschlagen.");
    }
    return data;
}

function renderPrimitiveField(label, value, path) {
    const pathData = escapeAttr(JSON.stringify(path));

    if (typeof value === "boolean") {
        return `
            <label class="admin-field is-check">
                <span>${escapeHtml(label)}</span>
                <input data-payload-path="${pathData}" data-payload-type="boolean" type="checkbox" ${value ? "checked" : ""}>
            </label>
        `;
    }

    if (typeof value === "number") {
        return `
            <label class="admin-field">
                <span>${escapeHtml(label)}</span>
                <input class="admin-input" data-payload-path="${pathData}" data-payload-type="number" type="number" step="any" value="${escapeAttr(value)}">
            </label>
        `;
    }

    if (value === null) {
        return `
            <label class="admin-field">
                <span>${escapeHtml(label)}</span>
                <textarea class="admin-textarea is-compact" data-payload-path="${pathData}" data-payload-type="json">null</textarea>
            </label>
        `;
    }

    return `
        <label class="admin-field">
            <span>${escapeHtml(label)}</span>
            <input class="admin-input" data-payload-path="${pathData}" data-payload-type="string" type="text" value="${escapeAttr(value)}">
        </label>
    `;
}

function renderPayloadValue(label, value, path) {
    if (Array.isArray(value)) {
        return `
            <label class="admin-field is-wide">
                <span>${escapeHtml(label)} <small>Array JSON</small></span>
                <textarea class="admin-textarea" data-payload-path="${escapeAttr(JSON.stringify(path))}" data-payload-type="json">${escapeHtml(jsonText(value))}</textarea>
            </label>
        `;
    }

    if (value && typeof value === "object") {
        const entries = Object.entries(value);
        return `
            <fieldset class="admin-payload-group">
                <legend>${escapeHtml(label)}</legend>
                <div class="admin-payload-grid">
                    ${entries.length
                        ? entries.map(([key, item]) => renderPayloadValue(key, item, [...path, key])).join("")
                        : `<p class="admin-empty">Leeres Objekt. Ergänzungen gehen über Payload JSON.</p>`}
                </div>
            </fieldset>
        `;
    }

    return renderPrimitiveField(label, value, path);
}

function renderPayloadFields(payload) {
    const entries = Object.entries(payload || {});
    return entries.length
        ? entries.map(([key, value]) => renderPayloadValue(key, value, [key])).join("")
        : `<p class="admin-empty">Payload ist leer.</p>`;
}

function renderGamePanel(save, index) {
    const payload = save.payload || {};
    const gameName = formatGameName(save.game_id);
    return `
        <section class="admin-game-panel" data-game-panel="${escapeAttr(save.game_id)}" ${index ? "hidden" : ""}>
            <header class="admin-game-head">
                <div>
                    <p class="page-kicker">${escapeHtml(save.game_id)}</p>
                    <h3>${escapeHtml(gameName)}</h3>
                </div>
                <small>Zuletzt gespeichert: ${escapeHtml(formatDate(save.updated_at))}</small>
            </header>

            <div class="admin-meta-grid">
                <label class="admin-field">
                    <span>Display Name</span>
                    <input class="admin-input" data-save-display-name type="text" maxlength="120" value="${escapeAttr(save.display_name || "Spieler")}">
                </label>
                <label class="admin-field">
                    <span>DB total_earned</span>
                    <input class="admin-input" data-save-total-earned type="number" step="any" value="${escapeAttr(save.total_earned || 0)}">
                </label>
                <div class="admin-field admin-meta-note">
                    <span>Season</span>
                    <strong>${escapeHtml(save.season_id || "-")}</strong>
                </div>
            </div>

            <div class="admin-payload-root">
                ${renderPayloadFields(payload)}
            </div>

            <details class="admin-json">
                <summary>Payload JSON</summary>
                <textarea class="admin-textarea is-json" data-payload-json>${escapeHtml(jsonText(payload))}</textarea>
            </details>

            <div class="admin-inline">
                <button class="admin-button" data-action="save-fields" type="button">Werte speichern</button>
                <button class="admin-button" data-action="save-json" type="button">JSON speichern</button>
                <button class="admin-button" data-action="reload" type="button">Online neu laden</button>
                <button class="admin-button is-danger" data-action="delete-save" type="button">Spielstand löschen</button>
            </div>
        </section>
    `;
}

function renderUsers(users) {
    if (!users.length) {
        usersRoot.innerHTML = `<p class="admin-empty">Keine User gefunden.</p>`;
        return;
    }

    usersRoot.innerHTML = users.map((user) => {
        const saves = Array.isArray(user.saves) ? user.saves : [];
        const presence = user.presence || {};
        return `
            <article class="admin-user" data-user-id="${escapeAttr(user.id)}">
                <div class="admin-user-head">
                    <div>
                        <h2>${escapeHtml(user.username || "Ohne Name")}</h2>
                        <p>${escapeHtml(user.id)}</p>
                    </div>
                    <div class="admin-user-flags">
                        <button class="admin-presence ${presence.online ? "is-online" : "is-offline"}" type="button" title="${escapeAttr(formatPresenceTitle(presence))}">
                            ${presence.online ? "Online" : "Offline"}
                        </button>
                        <span class="admin-ban">${user.is_banned ? "Gesperrt" : "Aktiv"}</span>
                    </div>
                </div>

                <details class="admin-games">
                    <summary>Games ${saves.length ? `(${saves.length})` : ""}</summary>
                    <div class="admin-game-tabs">
                        ${saves.map((save, index) => `
                            <button class="admin-game-tab ${index ? "" : "is-active"}" data-action="toggle-game" data-game-id="${escapeAttr(save.game_id)}" type="button" aria-expanded="${index ? "false" : "true"}">
                                ${escapeHtml(formatGameName(save.game_id))}
                                <small>${escapeHtml(formatNumber(save.total_earned))}</small>
                            </button>
                        `).join("")}
                    </div>

                    ${saves.length
                        ? saves.map(renderGamePanel).join("")
                        : `<p class="admin-empty">Dieser User hat noch keinen Cloud-Spielstand.</p>`}
                </details>

                <details class="admin-account-tools">
                    <summary>Account-Werkzeuge</summary>
                    <div class="admin-inline">
                        <input class="admin-input is-message" data-message-input type="text" maxlength="500" placeholder="Nachricht an User">
                        <button class="admin-button" data-action="message" type="button">Nachricht schicken</button>
                        <button class="admin-button is-danger" data-action="ban" type="button">${user.is_banned ? "Entsperren" : "Sperren"}</button>
                    </div>
                </details>
            </article>
        `;
    }).join("");
}

function getPanel(button) {
    const panel = button.closest("[data-game-panel]");
    if (!panel) {
        throw new Error("Game-Menü fehlt.");
    }

    return panel;
}

function getGameId(button) {
    const gameId = getPanel(button).dataset.gamePanel;
    if (!gameId) {
        throw new Error("Game fehlt.");
    }

    return gameId;
}

function readPayloadJson(panel) {
    const textarea = panel.querySelector("[data-payload-json]");
    let payload;

    try {
        payload = JSON.parse(textarea?.value || "{}");
    } catch {
        throw new Error("Payload JSON ist ungültig.");
    }

    if (!payload || Array.isArray(payload) || typeof payload !== "object") {
        throw new Error("Payload JSON muss ein Objekt sein.");
    }

    return payload;
}

function setPath(target, path, value) {
    let node = target;
    path.slice(0, -1).forEach((key) => {
        if (!node[key] || typeof node[key] !== "object") {
            node[key] = {};
        }
        node = node[key];
    });
    node[path.at(-1)] = value;
}

function readFieldValue(field) {
    if (field.dataset.payloadType === "boolean") {
        return field.checked;
    }

    if (field.dataset.payloadType === "number") {
        const value = Number(field.value);
        if (!Number.isFinite(value)) {
            throw new Error(`Ungültige Zahl bei ${JSON.parse(field.dataset.payloadPath).join(".")}.`);
        }
        return value;
    }

    if (field.dataset.payloadType === "json") {
        try {
            return JSON.parse(field.value);
        } catch {
            throw new Error(`Ungültiges JSON bei ${JSON.parse(field.dataset.payloadPath).join(".")}.`);
        }
    }

    return field.value;
}

function readPayloadFields(panel) {
    const payload = readPayloadJson(panel);
    panel.querySelectorAll("[data-payload-path]").forEach((field) => {
        const path = JSON.parse(field.dataset.payloadPath);
        setPath(payload, path, readFieldValue(field));
    });
    return payload;
}

function readSaveRequest(panel, payload) {
    const totalEarned = Number(panel.querySelector("[data-save-total-earned]")?.value);
    if (!Number.isFinite(totalEarned)) {
        throw new Error("DB total_earned muss eine Zahl sein.");
    }

    return {
        gameId: panel.dataset.gamePanel,
        displayName: panel.querySelector("[data-save-display-name]")?.value.trim() || "Spieler",
        totalEarned,
        payload,
    };
}

async function loadUsers() {
    try {
        setStatus("User werden geladen...");
        const { users } = await api("list");
        renderUsers(users || []);
        setStatus(`${users?.length || 0} User geladen.`);
    } catch (error) {
        setStatus(error.message, true);
    }
}

function toggleGamePanel(button, card) {
    const gameId = button.dataset.gameId;
    card.querySelectorAll("[data-game-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.gamePanel !== gameId;
    });
    card.querySelectorAll("[data-action='toggle-game']").forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-expanded", String(active));
    });
}

usersRoot.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    const card = event.target.closest("[data-user-id]");
    if (!button || !card) {
        return;
    }

    const userId = card.dataset.userId;
    const action = button.dataset.action;

    if (action === "toggle-game") {
        toggleGamePanel(button, card);
        return;
    }

    button.disabled = true;

    try {
        if (action === "save-fields" || action === "save-json") {
            const panel = getPanel(button);
            const payload = action === "save-json" ? readPayloadJson(panel) : readPayloadFields(panel);
            await api("update-save", { userId, ...readSaveRequest(panel, payload) });
            setStatus("Spielstand gespeichert.");
        }

        if (action === "delete-save") {
            if (!window.confirm("Spielstand wirklich löschen?")) {
                return;
            }
            await api("delete-save", { userId, gameId: getGameId(button) });
            setStatus("Spielstand gelöscht.");
        }

        if (action === "reload") {
            await api("reload", { userId, gameId: getGameId(button) });
            setStatus("Neu laden an Online-Client geschickt.");
            return;
        }

        if (action === "message") {
            const message = card.querySelector("[data-message-input]")?.value.trim();
            await api("message", { userId, message });
            setStatus("Nachricht geschickt.");
            return;
        }

        if (action === "ban") {
            await api("ban", { userId, isBanned: button.textContent.includes("Sperren") });
            setStatus("Account-Status aktualisiert.");
        }

        await loadUsers();
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        button.disabled = false;
    }
});

refreshButton.addEventListener("click", loadUsers);
adminAbuseRoot.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-admin-event]");
    if (!button) {
        return;
    }

    button.disabled = true;
    try {
        await api("trigger-game-event", {
            gameId: adminAbuseGame.value,
            eventType: button.dataset.adminEvent,
        });
        setStatus("Globales Game-Event ausgelöst.");
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        button.disabled = false;
    }
});
loadUsers();
