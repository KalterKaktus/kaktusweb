import { getSupabase, isConfigReady } from "/js/supabase-client.js";

const usersRoot = document.getElementById("admin-users");
const status = document.getElementById("admin-status");
const refreshButton = document.getElementById("admin-refresh");

function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatNumber(value) {
    return Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(Number(value) || 0);
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

function renderUsers(users) {
    usersRoot.innerHTML = users.map((user) => {
        const save = user.save;
        return `
            <article class="admin-user" data-user-id="${escapeHtml(user.id)}">
                <div class="admin-user-head">
                    <div>
                        <h2>${escapeHtml(user.username || "Ohne Name")}</h2>
                        <p>${escapeHtml(user.id)}</p>
                    </div>
                    <span class="admin-ban">${user.is_banned ? "Gesperrt" : "Aktiv"}</span>
                </div>
                <div class="admin-actions">
                    <div class="admin-save">
                        <strong>Spielstand</strong>
                        <small>Name: ${escapeHtml(save?.display_name || "-")}</small>
                        <small>Gesamt: ${save ? formatNumber(save.total_earned) : "-"}</small>
                        <small>Kakteen: ${save ? formatNumber(save.cactus) : "-"}</small>
                    </div>
                </div>
                <div class="admin-inline">
                    <input class="admin-input" data-cactus-input type="number" min="0" step="1" value="${escapeHtml(save?.cactus || 0)}" aria-label="Kakteen setzen">
                    <button class="admin-button" data-action="currency" type="button">Kakteen setzen</button>
                    <button class="admin-button is-danger" data-action="delete-save" type="button">Spielstand löschen</button>
                    <button class="admin-button" data-action="ban" type="button">${user.is_banned ? "Entsperren" : "Sperren"}</button>
                </div>
                <div class="admin-inline">
                    <input class="admin-input is-message" data-message-input type="text" maxlength="500" placeholder="Nachricht an User">
                    <button class="admin-button" data-action="message" type="button">Nachricht schicken</button>
                </div>
            </article>
        `;
    }).join("");
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

usersRoot.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    const card = event.target.closest("[data-user-id]");
    if (!button || !card) {
        return;
    }

    const userId = card.dataset.userId;
    const action = button.dataset.action;
    button.disabled = true;

    try {
        if (action === "delete-save") {
            if (!window.confirm("Spielstand wirklich löschen?")) {
                return;
            }
            await api("delete-save", { userId });
        }

        if (action === "currency") {
            const cactus = Number(card.querySelector("[data-cactus-input]")?.value);
            await api("currency", { userId, cactus });
        }

        if (action === "message") {
            const message = card.querySelector("[data-message-input]")?.value.trim();
            if (!message) {
                throw new Error("Bitte eine Nachricht eingeben.");
            }
            await api("message", { userId, message });
        }

        if (action === "ban") {
            await api("ban", { userId, isBanned: button.textContent.includes("Sperren") });
        }

        await loadUsers();
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        button.disabled = false;
    }
});

refreshButton.addEventListener("click", loadUsers);
loadUsers();
