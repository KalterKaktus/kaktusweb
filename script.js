document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (event) {
            event.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        });
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.2,
        rootMargin: '0px 0px -50px 0px',
    });

    document
        .querySelectorAll('.section-title, .about-paragraph, .live-timer, .social-btn')
        .forEach(element => observer.observe(element));

    const startDate = new Date('2026-02-09T00:00:00').getTime();

    function updateTimer() {
        const now = Date.now();
        const diff = now - startDate;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const values = {
            days,
            hours,
            minutes,
            seconds,
        };

        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = String(value).padStart(2, '0');
            }
        });
    }

    updateTimer();
    setInterval(updateTimer, 1000);

    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const orb1 = document.querySelector('.orb-1');
        const orb2 = document.querySelector('.orb-2');

        if (orb1 && orb2) {
            orb1.style.transform = `translate(${scrollY * 0.12}px, ${scrollY * 0.08}px)`;
            orb2.style.transform = `translate(${-scrollY * 0.08}px, ${-scrollY * 0.12}px)`;
        }
    });
});

const DISCORD_USER_ID = "419902218922229760";
const DISCORD_STATUS_REFRESH_MS = 5000;

async function loadDiscordStatus() {
    const statusEl = document.getElementById("discord-status");
    const activityEl = document.getElementById("discord-activity");

    if (!statusEl || !activityEl) return;

    try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`);
        const json = await response.json();

        if (!json.success) {
            statusEl.textContent = "Status nicht verfügbar";
            return;
        }

        const data = json.data;

        const statusMap = {
            online: "Online",
            idle: "Abwesend",
            dnd: "Nicht stören",
            offline: "Offline",
        };

        statusEl.textContent = statusMap[data.discord_status] || "Unbekannt";

        const cards = [];
        const game = data.activities?.find((activity) => activity.type === 0);

        if (game) {
            const started = game.timestamps?.start
                ? formatElapsedTime(Date.now() - game.timestamps.start)
                : null;

            let imageUrl = "";

            if (game.assets?.large_image && game.application_id) {
                imageUrl = `https://cdn.discordapp.com/app-assets/${encodeURIComponent(game.application_id)}/${encodeURIComponent(game.assets.large_image)}.png`;
            }

            cards.push(renderActivityCard({
                imageUrl,
                imageAlt: "Game Cover",
                title: `Game: ${game.name}`,
                detail: started ? `Seit ${started}` : "",
            }));
        }

        if (data.listening_to_spotify && data.spotify) {
            cards.push(renderActivityCard({
                imageUrl: data.spotify.album_art_url,
                imageAlt: "Spotify Cover",
                title: `Spotify: ${data.spotify.song}`,
                detail: data.spotify.artist,
            }));
        }

        activityEl.innerHTML = cards.length
            ? cards.join("")
            : "Keine aktive Aktivität";
    } catch (error) {
        statusEl.textContent = "Status konnte nicht geladen werden";
        activityEl.textContent = "";
    }
}

loadDiscordStatus();
setInterval(loadDiscordStatus, DISCORD_STATUS_REFRESH_MS);

function renderActivityCard({ imageUrl, imageAlt, title, detail }) {
    const safeImageUrl = sanitizeImageUrl(imageUrl);

    return `
        <div class="activity-box">
            ${safeImageUrl ? `<img src="${safeImageUrl}" class="activity-cover" alt="${escapeHtml(imageAlt)}">` : ""}
            <div>
                <div>${escapeHtml(title)}</div>
                ${detail ? `<div>${escapeHtml(detail)}</div>` : ""}
            </div>
        </div>
    `;
}

function sanitizeImageUrl(value) {
    const url = String(value || "");
    return /^https:\/\/[\w.-]+\/[\w./?=&%:-]+$/.test(url) ? url : "";
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatElapsedTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}
