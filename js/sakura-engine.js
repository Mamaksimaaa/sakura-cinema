/**
 * Sakura Cinema Engine - Particle & Ambient Visuals
 * Provides interactive sakura petals, cyberpunk rain, and firefly effects
 */

class SakuraEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.mode = 'sakura'; // 'sakura' | 'rain' | 'fireflies' | 'off'
    this.particles = [];
    this.maxParticles = 65;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;
    this.wind = 0.5;
    this.targetWind = 0.5;
    this.isActive = true;
    this.animationFrameId = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));

    this.spawnParticles();
    this.start();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  onMouseMove(e) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
    // Slight wind shift based on cursor horizontal speed
    const centerOffset = (e.clientX - this.width / 2) / (this.width / 2);
    this.targetWind = 0.5 + centerOffset * 1.5;
  }

  setMode(mode) {
    this.mode = mode;
    this.particles = [];
    if (mode !== 'off') {
      this.spawnParticles();
      if (!this.isActive) {
        this.isActive = true;
        this.start();
      }
    } else {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }
  }

  spawnParticles() {
    const count = this.mode === 'rain' ? 120 : (this.mode === 'fireflies' ? 45 : this.maxParticles);
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomY = false) {
    const startY = randomY ? Math.random() * this.height : -30;
    
    if (this.mode === 'sakura') {
      return {
        x: Math.random() * (this.width + 100) - 50,
        y: startY,
        size: Math.random() * 8 + 8, // 8 - 16px
        speedY: Math.random() * 1.4 + 1.1,
        speedX: Math.random() * 1.2 - 0.6,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 2.5,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: Math.random() * 0.03 + 0.015,
        opacity: Math.random() * 0.4 + 0.55,
        color: this.getRandomSakuraColor()
      };
    } else if (this.mode === 'rain') {
      return {
        x: Math.random() * this.width,
        y: startY,
        length: Math.random() * 25 + 15,
        speedY: Math.random() * 12 + 16,
        speedX: -1.5,
        opacity: Math.random() * 0.4 + 0.2,
        color: 'rgba(160, 220, 255,'
      };
    } else { // fireflies
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 3 + 1.5,
        speedY: (Math.random() - 0.5) * 0.7,
        speedX: (Math.random() - 0.5) * 0.7,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.04 + 0.02,
        color: 'rgba(255, 230, 120,'
      };
    }
  }

  getRandomSakuraColor() {
    const colors = [
      { r: 255, g: 183, b: 197 }, // Classic soft sakura pink
      { r: 255, g: 154, b: 181 }, // Deep cherry blossom
      { r: 255, g: 215, b: 228 }, // Pale blossom
      { r: 255, g: 117, b: 151 }, // Vivid anime magenta-pink
      { r: 255, g: 240, b: 245 }  // White-pink
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  start() {
    const loop = () => {
      if (!this.isActive || this.mode === 'off') return;
      this.update();
      this.draw();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop() {
    this.isActive = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  update() {
    // Smooth wind transition
    this.wind += (this.targetWind - this.wind) * 0.02;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (this.mode === 'sakura') {
        p.swing += p.swingSpeed;
        p.rotation += p.rotationSpeed;
        p.y += p.speedY;
        p.x += Math.sin(p.swing) * 1.5 + this.wind;

        // Reset if went out of view
        if (p.y > this.height + 30 || p.x > this.width + 50 || p.x < -50) {
          this.particles[i] = this.createParticle(false);
        }
      } else if (this.mode === 'rain') {
        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y > this.height) {
          p.y = -p.length;
          p.x = Math.random() * (this.width + 100);
        }
      } else if (this.mode === 'fireflies') {
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += p.pulseSpeed;

        if (p.x < 0) p.x = this.width;
        if (p.x > this.width) p.x = 0;
        if (p.y < 0) p.y = this.height;
        if (p.y > this.height) p.y = 0;
      }
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    for (const p of this.particles) {
      if (this.mode === 'sakura') {
        this.drawSakuraPetal(p);
      } else if (this.mode === 'rain') {
        this.drawRainDrop(p);
      } else if (this.mode === 'fireflies') {
        this.drawFirefly(p);
      }
    }
  }

  drawSakuraPetal(p) {
    this.ctx.save();
    this.ctx.translate(p.x, p.y);
    this.ctx.rotate((p.rotation * Math.PI) / 180);
    this.ctx.scale(Math.cos(p.swing * 0.7), 1);

    this.ctx.beginPath();
    // Authentic cherry petal curve geometry
    this.ctx.moveTo(0, 0);
    this.ctx.bezierCurveTo(-p.size / 2, -p.size / 2, -p.size, p.size / 3, 0, p.size);
    this.ctx.bezierCurveTo(p.size, p.size / 3, p.size / 2, -p.size / 2, 0, 0);

    const c = p.color;
    this.ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${p.opacity})`;
    this.ctx.shadowColor = `rgba(${c.r}, ${c.g}, ${c.b}, 0.5)`;
    this.ctx.shadowBlur = 6;
    this.ctx.fill();

    this.ctx.restore();
  }

  drawRainDrop(p) {
    this.ctx.beginPath();
    this.ctx.moveTo(p.x, p.y);
    this.ctx.lineTo(p.x + p.speedX * 2, p.y + p.length);
    this.ctx.strokeStyle = `${p.color} ${p.opacity})`;
    this.ctx.lineWidth = 1.2;
    this.ctx.stroke();
  }

  drawFirefly(p) {
    const glow = Math.sin(p.pulse) * 0.4 + 0.6;
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    this.ctx.fillStyle = `${p.color} ${glow * 0.9})`;
    this.ctx.shadowColor = 'rgba(255, 235, 130, 0.9)';
    this.ctx.shadowBlur = 10;
    this.ctx.fill();
    this.ctx.restore();
  }
}

window.SakuraEngine = SakuraEngine;
