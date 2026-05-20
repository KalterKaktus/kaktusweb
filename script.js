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

