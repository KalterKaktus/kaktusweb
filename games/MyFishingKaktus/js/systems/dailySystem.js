import {
    getDailyReward,
    getWeekPreview,
    localDayKey,
    nextStreakState,
} from "../data/dailyRewards.js";

export class DailySystem {
    constructor(options = {}) {
        this.options = options;
        this.overlay = null;
        this.pending = null;
        this._buildOverlay();
    }

    /**
     * Checkt nach dem Save-Load ob ein Daily Reward fällig ist.
     * Wenn ja: berechnet den nächsten Streak-Wert, persistiert ihn ans State und öffnet das Popup.
     * Belohnungs-Anwendung passiert erst beim Claim-Klick.
     */
    checkAndShow(state) {
        if (!state || !state.daily) return false;
        const result = nextStreakState(state.daily.streak, state.daily.lastClaimedDay);
        if (!result.eligible) return false;

        // Streak schon im State setzen + lastClaimedDay setzen damit Reload nicht doppelt zeigt.
        // Belohnung selbst kommt erst beim Claim — der Coin/Spawn-Bonus zählt nicht als "schon geclaimed".
        state.daily.streak = result.newStreak;
        state.daily.lastClaimedDay = localDayKey();
        state.daily.totalClaimed = (state.daily.totalClaimed || 0) + 1;
        if (result.newStreak > (state.daily.bestStreak || 0)) {
            state.daily.bestStreak = result.newStreak;
        }
        this.options.onClaimRegistered?.();

        const reward = getDailyReward(result.newStreak);
        this.pending = reward;
        this._render(reward, state.daily);
        this.overlay.hidden = false;
        this.overlay.setAttribute("aria-hidden", "false");
        return true;
    }

    _buildOverlay() {
        const overlay = document.createElement("section");
        overlay.className = "daily-overlay";
        overlay.id = "daily-overlay";
        overlay.hidden = true;
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="daily-card" data-daily-card>
                <div class="daily-burst" aria-hidden="true"></div>
                <p class="daily-kicker">Daily Login-Bonus</p>
                <strong class="daily-streak-line" data-daily-streak></strong>
                <div class="daily-reward-line">
                    <span class="daily-reward-coins" data-daily-coins>+0 Coins</span>
                    <span class="daily-reward-spawn" data-daily-spawn hidden></span>
                </div>
                <div class="daily-week-grid" data-daily-week></div>
                <button type="button" class="daily-claim" data-daily-claim>Einsammeln</button>
            </div>
        `;
        document.body.append(overlay);
        this.overlay = overlay;
        overlay.querySelector("[data-daily-claim]").addEventListener("click", () => this._claim());
    }

    _render(reward, daily) {
        const card = this.overlay.querySelector("[data-daily-card]");
        // Theme: Legendary > Epic > Gold
        let theme = "gold";
        if (reward.spawn?.rarity === "Epic") theme = "epic";
        if (reward.spawn?.rarity === "Legendary") theme = "legendary";
        card.dataset.theme = theme;

        const streakLine = this.overlay.querySelector("[data-daily-streak]");
        streakLine.textContent = `Tag ${reward.streakDay} · Streak ${daily.streak}`;

        const coinsEl = this.overlay.querySelector("[data-daily-coins]");
        coinsEl.textContent = `+${reward.coins.toLocaleString("de-DE")} Coins`;

        const spawnEl = this.overlay.querySelector("[data-daily-spawn]");
        if (reward.spawn) {
            const count = reward.spawn.count > 1 ? `${reward.spawn.count}× ` : "";
            spawnEl.textContent = `${count}${reward.spawn.rarity}-Fischstelle!`;
            spawnEl.hidden = false;
        } else {
            spawnEl.hidden = true;
        }

        // Wochen-Vorschau: 7 Tage rendern, aktuellen markieren
        const weekGrid = this.overlay.querySelector("[data-daily-week]");
        const weekStart = Math.floor((reward.streakDay - 1) / 7) * 7 + 1;
        const previews = getWeekPreview(weekStart);
        weekGrid.innerHTML = previews.map((p, i) => {
            const dayNum = weekStart + i;
            const isToday = dayNum === reward.streakDay;
            const isPast = dayNum < reward.streakDay;
            const isSpecial = !!p.spawn;
            const cls = [
                "daily-week-cell",
                isToday ? "is-today" : "",
                isPast ? "is-past" : "",
                isSpecial ? "is-special" : "",
            ].filter(Boolean).join(" ");
            const label = isSpecial
                ? (p.spawn.rarity === "Legendary" ? "★ Legend" : `${p.spawn.count > 1 ? p.spawn.count + "×" : "★"} Epic`)
                : `+${p.coins}`;
            return `
                <div class="${cls}">
                    <span class="daily-week-day">T ${p.dayInWeek}</span>
                    <span class="daily-week-reward">${label}</span>
                </div>
            `;
        }).join("");
    }

    _claim() {
        const reward = this.pending;
        this.overlay.hidden = true;
        this.overlay.setAttribute("aria-hidden", "true");
        this.pending = null;
        if (reward) this.options.onClaim?.(reward);
    }
}
