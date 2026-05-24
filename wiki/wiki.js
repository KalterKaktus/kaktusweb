function setupWikiNav() {
    document.querySelectorAll(".nav").forEach((nav, index) => {
        const container = nav.querySelector(".nav-container");
        const links = nav.querySelector(".nav-links");
        if (!container || !links || container.querySelector(".nav-toggle")) {
            return;
        }

        const menuId = links.id || `wiki-nav-menu-${index + 1}`;
        links.id = menuId;

        const toggle = document.createElement("button");
        toggle.className = "nav-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-controls", menuId);
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Navigation öffnen");
        toggle.innerHTML = "<span></span><span></span><span></span>";
        container.insertBefore(toggle, links);

        const setOpen = (open) => {
            nav.classList.toggle("is-menu-open", open);
            toggle.setAttribute("aria-expanded", String(open));
            toggle.setAttribute("aria-label", open ? "Navigation schließen" : "Navigation öffnen");
            document.body.classList.toggle("nav-menu-open", open);
        };

        toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-menu-open")));
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

setupWikiNav();

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

    // Original-HTML pro Section cachen damit Highlights sauber entfernt werden können
    sections.forEach((sec) => { sec.dataset.originalHtml = sec.innerHTML; });

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
