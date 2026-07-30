// Nav-Setup + Language-Switcher werden von /js/auth-nav.js übernommen. Hier
// deshalb keine eigene setupWikiNav mehr — sonst blockiert der early-return
// in setupSiteNav (weil .nav-toggle bereits von uns erstellt wäre) das
// Einfügen des Language-Switchers auf allen Wiki-Seiten.

// --- Wiki-Suche: filtert Sections nach Volltextmatch ---
function setupWikiSearch() {
    const input = document.getElementById("wiki-search-input");
    const article = document.querySelector("[data-wiki-searchable]");
    const info = document.querySelector("[data-wiki-search-info]");
    if (!input || !article) return;

    const sections = Array.from(article.querySelectorAll("[data-searchable]"));
    const HIGHLIGHT_CLASS = "wiki-highlight";

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
        })[c]);
    }

    function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

    // Original-HTML pro Section cachen damit Highlights sauber entfernt werden können.
    function snapshotSections() {
        sections.forEach((sec) => { sec.dataset.originalHtml = sec.innerHTML; });
    }
    snapshotSections();

    // WICHTIG: i18n schreibt die Sections per data-i18n-html neu. Dieses Script
    // läuft als klassisches Script VOR den Modulen, der erste Snapshot wäre also
    // immer Deutsch. Nach jedem Sprachwechsel (und nach dem initialen Apply) neu
    // snapshotten — sonst würde die Suche auf RU deutschen Text wiederherstellen.
    document.addEventListener("kk:languagechange", () => {
        snapshotSections();
        if (input.value.trim()) applyFilter(input.value);
    });
    // Initiales Apply von i18n passiert nach diesem Script → einmal nachziehen.
    window.setTimeout(snapshotSections, 0);

    function applyFilter(query) {
        const q = query.trim().toLowerCase();
        if (!q) {
            sections.forEach((sec) => {
                sec.hidden = false;
                sec.innerHTML = sec.dataset.originalHtml;
            });
            if (info) info.textContent = "";
            return;
        }

        let matchCount = 0;
        const regex = new RegExp(`(${escapeRegex(q)})`, "gi");

        sections.forEach((sec) => {
            const text = sec.textContent.toLowerCase();
            if (text.includes(q)) {
                matchCount++;
                sec.hidden = false;
                // Highlight via regex auf originalHtml — wir gehen über DOM-Klone um keine HTML-Tags zu ersetzen
                const tmp = document.createElement("div");
                tmp.innerHTML = sec.dataset.originalHtml;
                highlightTextNodes(tmp, regex);
                sec.innerHTML = tmp.innerHTML;
            } else {
                sec.hidden = true;
                sec.innerHTML = sec.dataset.originalHtml;
            }
        });

        if (info) {
            info.textContent = matchCount === 0
                ? "Keine Treffer"
                : `${matchCount} Sektion${matchCount === 1 ? "" : "en"} gefunden`;
        }
    }

    function highlightTextNodes(root, regex) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const parent = node.parentNode;
                if (!parent || parent.nodeName === "SCRIPT" || parent.nodeName === "STYLE") return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach((node) => {
            const original = node.nodeValue;
            if (!regex.test(original)) return;
            regex.lastIndex = 0;
            const replaced = original.replace(regex, `$1`);
            const frag = document.createDocumentFragment();
            replaced.split(/|/).forEach((part, i) => {
                if (i % 2 === 1) {
                    const mark = document.createElement("mark");
                    mark.className = HIGHLIGHT_CLASS;
                    mark.textContent = part;
                    frag.appendChild(mark);
                } else if (part) {
                    frag.appendChild(document.createTextNode(part));
                }
            });
            node.parentNode.replaceChild(frag, node);
        });
    }

    let timer = 0;
    input.addEventListener("input", () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => applyFilter(input.value), 140);
    });
}

setupWikiSearch();
