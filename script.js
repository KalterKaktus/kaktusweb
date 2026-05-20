document.addEventListener('DOMContentLoaded', () => {
    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.2,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                if (entry.target.classList.contains('stat-item')) {
                    const numberElement = entry.target.querySelector('.stat-number');
                    if (numberElement && !numberElement.classList.contains('counted')) {
                        animateCounter(numberElement);
                        numberElement.classList.add('counted');
                    }
                }
            }
        });
    }, observerOptions);

    const elementsToObserve = document.querySelectorAll(
    '.section-title, .about-paragraph, .live-timer, .social-btn'
);

    elementsToObserve.forEach(el => observer.observe(el));

    

// Live Timer
const startDate = new Date('2026-02-09T00:00:00').getTime();

function updateTimer() {
    const now = new Date().getTime();
    const diff = now - startDate;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    
    if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
    if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
}

updateTimer();
setInterval(updateTimer, 1000);

    // Parallax effect for gradient orbs
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const orb1 = document.querySelector('.orb-1');
        const orb2 = document.querySelector('.orb-2');
        
        if (orb1 && orb2) {
            orb1.style.transform = `translate(${scrollY * 0.3}px, ${scrollY * 0.2}px)`;
            orb2.style.transform = `translate(${-scrollY * 0.2}px, ${-scrollY * 0.3}px)`;
        }
    });

    // Hide scroll indicator on scroll
    let scrollIndicatorHidden = false;
    window.addEventListener('scroll', () => {
        if (!scrollIndicatorHidden && window.scrollY > 100) {
            const indicator = document.querySelector('.scroll-indicator');
            if (indicator) {
                indicator.style.opacity = '0';
                indicator.style.transition = 'opacity 0.5s ease';
                scrollIndicatorHidden = true;
            }
        }
    });

    // Console easter egg
    console.log(`
╔══════════════════════════════════════╗
║                                      ║
║         🌵 KalterKaktus 🌵          ║
║                                      ║
║    Willkommen im Code, Entdecker!   ║
║                                      ║
║  Diese Seite wurde mit ❤️ gebaut    ║
║                                      ║
╚══════════════════════════════════════╝
    `);

    // Log page load time
    window.addEventListener('load', () => {
        const loadTime = performance.now();
        console.log(`🚀 Seite geladen in ${loadTime.toFixed(2)}ms`);
    });

});


