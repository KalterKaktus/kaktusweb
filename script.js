document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Functionality mit DISCO MODE 🎉
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    const nav = document.querySelector('.nav');

    // Check for saved theme preference or default to dark mode
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        body.classList.add('light-mode');
    }

    // Disco Mode Easter Egg
    let clickCount = 0;
    let clickTimer = null;
    let discoMode = false;
    let discoInterval = null;
    let faceInterval = null;

    // Nav update function - DEFINIERT HIER OBEN!
    function updateNavColors() {
        const isLightMode = body.classList.contains('light-mode');
        
        if (window.scrollY > 50) {
            if (isLightMode) {
                nav.style.background = 'rgba(253, 251, 247, 0.98)';
                nav.style.borderBottom = '1px solid rgba(212, 196, 168, 0.3)';
            } else {
                nav.style.background = 'rgba(26, 29, 35, 0.95)';
                nav.style.borderBottom = '1px solid #3a3d45';
            }
        } else {
            if (isLightMode) {
                nav.style.background = 'rgba(253, 251, 247, 0.85)';
                nav.style.borderBottom = '1px solid rgba(212, 196, 168, 0.2)';
            } else {
                nav.style.background = 'rgba(26, 29, 35, 0.8)';
                nav.style.borderBottom = '1px solid #3a3d45';
            }
        }
    }

    // Toggle theme on button click
    themeToggle.addEventListener('click', () => {
        console.log('🔥 BUTTON CLICKED!');
        
        // Disco Mode Check
        clickCount++;
        console.log(`Click ${clickCount}/20`);
        
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 5000); // 5 Sekunden statt 60
        
        // Im Disco Mode - erlaube Theme Toggle aber kein Deaktivieren
        if (discoMode) {
            console.log('🎊 DISCO MODE LÄUFT! (Theme wechselt trotzdem) 🎊');
            body.classList.toggle('light-mode');
            const theme = body.classList.contains('light-mode') ? 'light' : 'dark';
            localStorage.setItem('theme', theme);
            updateNavColors();
            return;
        }
        
        // Aktiviere Disco Mode bei 5 Klicks
        if (clickCount >= 5) {
            discoMode = true;
            body.classList.add('disco-mode');
            clickCount = 0;
            console.log('🎊🎉 DISCO MODE ACTIVATED! 🎉🎊');
            
            // Flying Face Animation
            const discoFace = document.getElementById('discoFace');
            
            if (discoFace) {
                function moveFaceRandomly() {
                    const maxX = window.innerWidth - 150;
                    const maxY = window.innerHeight - 150;
                    const randomX = Math.random() * maxX;
                    const randomY = Math.random() * maxY;
                    const randomDuration = 2 + Math.random() * 3;
                    
                    discoFace.style.transition = `all ${randomDuration}s ease-in-out`;
                    discoFace.style.left = randomX + 'px';
                    discoFace.style.top = randomY + 'px';
                }
                
                moveFaceRandomly();
                faceInterval = setInterval(moveFaceRandomly, 3000);
            }
            
            // RGB Animation starten
            let hue = 0;
            discoInterval = setInterval(() => {
                hue = (hue + 2) % 360;
                const color1 = `hsl(${hue}, 70%, 50%)`;
                const color2 = `hsl(${(hue + 120) % 360}, 70%, 50%)`;
                const color3 = `hsl(${(hue + 240) % 360}, 70%, 50%)`;
                
                document.documentElement.style.setProperty('--accent', color1);
                document.documentElement.style.setProperty('--accent-light', color2);
                document.documentElement.style.setProperty('--border', color3);
                
                if (nav) {
                    nav.style.borderBottom = `2px solid ${color1}`;
                }
                
                themeToggle.style.borderColor = color2;
                
                if (discoFace) {
                    discoFace.style.filter = `drop-shadow(0 0 30px ${color1}) hue-rotate(${hue}deg)`;
                }
            }, 50);
            
            return;
        }
        
        // NORMALES THEME TOGGLE - passiert bei JEDEM Klick
        body.classList.toggle('light-mode');
        const theme = body.classList.contains('light-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        console.log(`Theme switched to: ${theme}`);
        updateNavColors();
    });

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
    '.section-title, .about-paragraph, .live-timer, .social-btn, .spotify-player'
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

    // Nav background on scroll
    window.addEventListener('scroll', updateNavColors);

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


