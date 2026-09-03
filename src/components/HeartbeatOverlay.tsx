import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCouple } from '../context/CoupleContext';

export const HeartbeatOverlay: React.FC = () => {
  const { incomingHeartbeat, clearIncomingHeartbeat, sendHeartbeat } = useCouple();

  useEffect(() => {
    if (incomingHeartbeat) {
      // Trigger romantic confetti burst
      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f43f5e', '#fb7185', '#fda4af', '#f472b6', '#ec4899'],
          shapes: ['circle'],
        });
      } catch {
        // fallback
      }

      // Auto dismiss after 6s
      const timer = setTimeout(() => {
        clearIncomingHeartbeat();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [incomingHeartbeat, clearIncomingHeartbeat]);

  if (!incomingHeartbeat) return null;

  const getEmoji = () => {
    switch (incomingHeartbeat.type) {
      case 'miss_you':
        return '🥺💖';
      case 'hug':
        return '🫂💕';
      case 'kiss':
        return '💋✨';
      default:
        return '💖';
    }
  };

  const getTitle = () => {
    switch (incomingHeartbeat.type) {
      case 'miss_you':
        return `${incomingHeartbeat.senderName} đang nhớ bạn rất nhiều!`;
      case 'hug':
        return `${incomingHeartbeat.senderName} vừa gửi một cái ôm thật chặt!`;
      case 'kiss':
        return `${incomingHeartbeat.senderName} vừa gửi một nụ hôn ngọt ngào!`;
      default:
        return `${incomingHeartbeat.senderName} vừa chạm vào nhịp tim của bạn!`;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm pointer-events-auto">
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="relative max-w-sm w-full bg-white/95 dark:bg-zinc-900/95 border border-rose-200 dark:border-rose-900/40 rounded-3xl p-6 shadow-2xl text-center overflow-hidden"
        >
          {/* Background romantic glow ripples */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-48 h-48 rounded-full bg-rose-400 animate-ping" />
          </div>

          <button
            onClick={clearIncomingHeartbeat}
            className="absolute top-3 right-3 p-1.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Animated pulsing heart icon */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <motion.div
              animate={{ scale: [1, 1.25, 1, 1.25, 1] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-white shadow-lg shadow-rose-300 dark:shadow-rose-950 text-3xl"
            >
              {getEmoji()}
            </motion.div>
            <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-amber-400 animate-bounce" />
          </div>

          <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2 font-cute">
            {getTitle()}
          </h3>

          <p className="text-sm text-zinc-600 dark:text-zinc-300 italic mb-6">
            "{incomingHeartbeat.message || 'Tim mình vừa rung rinh khi nghĩ về cậu!'}"
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => {
                sendHeartbeat('kiss', 'Gửi lại cho cậu ngàn nụ hôn ngọt ngào! 💋');
                clearIncomingHeartbeat();
              }}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Heart className="w-4 h-4 fill-white" />
              Gửi Yêu Lại 💖
            </button>
            <button
              onClick={clearIncomingHeartbeat}
              className="py-2.5 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              Đóng
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
