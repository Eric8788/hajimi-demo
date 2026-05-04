'use client';

import React, { useEffect, useRef } from 'react';

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width: number, height: number;
    let particles: Particle[] = [];
    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#A142F4', '#F442A8'];
    const mouse = { x: -1000, y: -1000, radius: 150 };

    class Particle {
      x: number;
      y: number;
      baseSize: number;
      size: number;
      color: string;
      vx: number;
      vy: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        // Bigger particles with larger size variance
        this.baseSize = Math.random() * 8 + 3; 
        this.size = this.baseSize;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        // Slower movement
        this.vx = (Math.random() - 0.5) * 0.6;
        this.vy = (Math.random() - 0.5) * 0.6;
      }

      draw() {
        if (!ctx) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x > width + 20) this.x = -20;
        else if (this.x < -20) this.x = width + 20;

        if (this.y > height + 20) this.y = -20;
        else if (this.y < -20) this.y = height + 20;

        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
          const forceDirectionX = dx / distance;
          const forceDirectionY = dy / distance;
          const force = (mouse.radius - distance) / mouse.radius;
          this.vx -= forceDirectionX * force * 0.4;
          this.vy -= forceDirectionY * force * 0.4;
        }

        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 1.5) {
          this.vx *= 0.95;
          this.vy *= 0.95;
        } else if (speed < 0.2) {
          this.vx += (Math.random() - 0.5) * 0.1;
          this.vy += (Math.random() - 0.5) * 0.1;
        }

        this.draw();
      }
    }

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      init();
    };

    const init = () => {
      particles = [];
      const numParticles = Math.min((width * height) / 8000, 200);
      for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => p.update());
      requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseOut = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);

    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1, // Lower layer
        pointerEvents: 'none',
        filter: 'blur(10px)', // Stronger blur
        opacity: 0.6,
      }}
    />
  );
};

export default ParticleBackground;
