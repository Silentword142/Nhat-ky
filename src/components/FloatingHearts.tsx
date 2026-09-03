import React, { useEffect, useState } from 'react';
import { useCouple } from '../context/CoupleContext';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  symbol: string;
}

export const FloatingHearts: React.FC = () => {
  const { settings } = useCouple();
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!settings.floatingParticles) {
      setParticles([]);
      return;
    }

    const symbols = ['💖', '🌸', '✨', '💕', '🌷', '🤍', '💌'];
    const newParticles: Particle[] = Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      x: Math.random() * 95, // % from left
      y: 100 + Math.random() * 20, // start below bottom
      size: 14 + Math.random() * 16,
      opacity: 0.25 + Math.random() * 0.45,
      duration: 12 + Math.random() * 10,
      delay: Math.random() * 8,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
    }));

    setParticles(newParticles);
  }, [settings.floatingParticles]);

  if (!settings.floatingParticles) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute transform transition-transform"
          style={{
            left: `${p.x}%`,
            fontSize: `${p.size}px`,
            opacity: p.opacity,
            animation: `floatUpward ${p.duration}s infinite linear`,
            animationDelay: `${p.delay}s`,
            bottom: '-40px',
          }}
        >
          {p.symbol}
        </span>
      ))}
      <style>{`
        @keyframes floatUpward {
          0% {
            transform: translateY(0) rotate(0deg) scale(0.8);
            opacity: 0;
          }
          15% {
            opacity: 0.6;
          }
          85% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(-110vh) rotate(360deg) scale(1.1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
