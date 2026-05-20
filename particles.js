// Particle Network Background with Magnetic Mouse Effect
class ParticleNetwork {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'particle-canvas';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '0';
        this.canvas.style.opacity = '0.6';
        
        document.body.insertBefore(this.canvas, document.body.firstChild);
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        
        this.resize();
        this.init();
        this.animate();
        
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.x;
            this.mouse.y = e.y;
        });
        
        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    init() {
        this.particles = [];
        const numberOfParticles = Math.floor((this.canvas.width * this.canvas.height) / 15000);
        
        for (let i = 0; i < numberOfParticles; i++) {
            const size = Math.random() * 2 + 1;
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const directionX = (Math.random() * 0.4) - 0.2;
            const directionY = (Math.random() * 0.4) - 0.2;
            
            this.particles.push(new Particle(x, y, directionX, directionY, size, this.canvas));
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].update(this.mouse);
            this.particles[i].draw(this.ctx);
        }
        
        this.connect();
    }
    
    connect() {
        const maxDistance = 120;
        
        // Check if light mode
        const isLightMode = document.body.classList.contains('light-mode');
        const baseColor = isLightMode ? '44, 36, 22' : '240, 237, 230';
        
        for (let a = 0; a < this.particles.length; a++) {
            for (let b = a; b < this.particles.length; b++) {
                const dx = this.particles[a].x - this.particles[b].x;
                const dy = this.particles[a].y - this.particles[b].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < maxDistance) {
                    const opacity = 1 - (distance / maxDistance);
                    
                    this.ctx.strokeStyle = `rgba(${baseColor}, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[a].x, this.particles[a].y);
                    this.ctx.lineTo(this.particles[b].x, this.particles[b].y);
                    this.ctx.stroke();
                }
            }
        }
    }
}

class Particle {
    constructor(x, y, directionX, directionY, size, canvas) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.canvas = canvas;
        this.baseX = x;
        this.baseY = y;
    }
    
    draw(ctx) {
        const isLightMode = document.body.classList.contains('light-mode');
        const fillColor = isLightMode ? 'rgb(44, 36, 22)' : 'rgb(240, 237, 230)';
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    
    update(mouse) {
        // Boundary check
        if (this.baseX > this.canvas.width || this.baseX < 0) {
            this.directionX = -this.directionX;
        }
        if (this.baseY > this.canvas.height || this.baseY < 0) {
            this.directionY = -this.directionY;
        }
        
        // Move base position
        this.baseX += this.directionX;
        this.baseY += this.directionY;
        
        // Magnetic effect
        if (mouse.x != null && mouse.y != null) {
            const dx = mouse.x - this.baseX;
            const dy = mouse.y - this.baseY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < mouse.radius) {
                const force = (mouse.radius - distance) / mouse.radius;
                const angle = Math.atan2(dy, dx);
                
                // Attract to mouse (magnetic effect)
                this.x = this.baseX + Math.cos(angle) * force * 40;
                this.y = this.baseY + Math.sin(angle) * force * 40;
            } else {
                // Return to base position
                this.x += (this.baseX - this.x) * 0.1;
                this.y += (this.baseY - this.y) * 0.1;
            }
        } else {
            // Return to base position when mouse is out
            this.x += (this.baseX - this.x) * 0.1;
            this.y += (this.baseY - this.y) * 0.1;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ParticleNetwork();
    });
} else {
    new ParticleNetwork();
}