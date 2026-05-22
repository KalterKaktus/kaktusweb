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
