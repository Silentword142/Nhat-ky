import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Sparkles, Heart, Clock, User, Download, Maximize2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { HandwrittenCard } from '../types';
import { useCouple } from '../context/CoupleContext';
import { soundService } from '../services/sound';
import { ImageLightbox } from './ImageLightbox';
import { formatDateTimeVN } from '../utils/date';

interface EnvelopeModalProps {
  card: HandwrittenCard | null;
  onClose: () => void;
}

export const EnvelopeModal: React.FC<EnvelopeModalProps> = ({ card, onClose }) => {
  const { openCard, myProfile } = useCouple();
  const [isOpenAnimationStarted, setIsOpenAnimationStarted] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  if (!card) return null;

  const isSender = card.senderId === myProfile.id;
  const isAlreadyOpened = card.isOpened;

  const handleBreakSeal = () => {
    soundService.playPaperOpen();
    setIsOpenAnimationStarted(true);

    try {
      confetti({
        particleCount: 70,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#f43f5e', '#fb7185', '#fbbf24', '#c084fc', '#f472b6'],
      });
    } catch {
      // fallback
    }

    if (!isAlreadyOpened && !isSender) {
      openCard(card.id);
    }
  };

  const showLetterContent = isAlreadyOpened || isSender || isOpenAnimationStarted;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          className="relative max-w-xl w-full my-auto bg-transparent"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 z-30 p-2 rounded-full bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shadow-lg hover:scale-105 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {!showLetterContent ? (
            /* SEALED ENVELOPE VIEW */
            <div className="relative w-full aspect-[4/3] max-h-[440px] bg-[#f8efe6] dark:bg-[#2b2427] rounded-2xl shadow-2xl border-4 border-[#ecdcc9] dark:border-[#44383c] p-6 flex flex-col items-center justify-center text-center overflow-hidden">
              {/* Envelope flap visual lines */}
              <div className="absolute top-0 inset-x-0 h-1/2 border-b-2 border-[#ddc6ad] dark:border-[#524449] pointer-events-none opacity-40" />

              <div className="mb-2 text-rose-500 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <Mail className="w-4 h-4" />
                Thư Tình Riêng Tư
              </div>

              <h2 className="text-2xl font-romantic text-zinc-800 dark:text-zinc-100 font-bold mb-2">
                {card.title || 'Bức thư ngọt ngào'}
              </h2>

              <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-8 font-cute">
                Gửi từ: <span className="font-semibold text-rose-600 dark:text-rose-400">{card.senderName}</span>
              </p>

              {/* INTERACTIVE WAX SEAL */}
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBreakSeal}
                className="relative group cursor-pointer"
                title="Bấm để mở phong thư"
              >
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition transform"
                  style={{
                    backgroundColor: card.sealColor || '#be123c',
                    boxShadow: `0 8px 25px ${card.sealColor || '#be123c'}60`,
                  }}
                >
                  {/* Wax texture concentric circles */}
                  <div className="w-20 h-20 rounded-full border-2 border-white/30 flex items-center justify-center">
                    <Heart className="w-10 h-10 text-white fill-white/80 animate-pulse" />
                  </div>
                </div>

                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-rose-600 dark:text-rose-400 bg-white/90 dark:bg-zinc-800/90 px-3 py-1 rounded-full shadow-sm">
                  ✨ Chạm để mở thư
                </div>
              </motion.button>
            </div>
          ) : (
            /* OPENED LETTER & DRAWN CANVAS VIEW */
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="w-full bg-[#fffbf2] dark:bg-[#1f1b20] rounded-3xl shadow-2xl border-2 border-[#eddac4] dark:border-[#42353b] p-6 sm:p-8 text-zinc-800 dark:text-zinc-100 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-4">
                <div>
                  <h2 className="text-2xl font-romantic font-bold text-rose-600 dark:text-rose-400">
                    {card.title || 'Thư gửi người yêu'}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-cute">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> {card.senderName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />{' '}
                      {formatDateTimeVN(card.sentAt)}
                    </span>
                  </div>
                </div>

                {card.cardDataUrl && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsZoomOpen(true)}
                      className="p-2 rounded-xl bg-rose-50 dark:bg-zinc-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 transition text-xs font-semibold flex items-center gap-1"
                      title="Phóng to & Zoom thư"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>Zoom</span>
                    </button>
                    <a
                      href={card.cardDataUrl}
                      download={`lovesync-letter-${card.id}.png`}
                      className="p-2 rounded-xl bg-rose-50 dark:bg-zinc-800 text-rose-600 dark:text-rose-300 hover:bg-rose-100 transition text-xs font-semibold flex items-center gap-1"
                      title="Tải ảnh thiệp viết tay"
                    >
                      <Download className="w-4 h-4" />
                      Lưu
                    </a>
                  </div>
                )}
              </div>

              {/* Render canvas drawn image if exists */}
              {card.cardDataUrl ? (
                <div
                  onClick={() => setIsZoomOpen(true)}
                  className="group relative rounded-2xl overflow-hidden shadow-inner border border-zinc-200/80 dark:border-zinc-800 mb-4 bg-white dark:bg-zinc-900 cursor-pointer"
                >
                  <img
                    src={card.cardDataUrl}
                    alt="Thiệp viết tay"
                    className="w-full object-contain max-h-[500px] group-hover:scale-102 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                    <span className="px-3 py-1.5 rounded-full bg-white text-zinc-900 font-bold text-xs shadow-md flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Phóng to & Zoom</span>
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Render handwritten message text if any */}
              {card.messageText && (
                <div className="paper-lined rounded-2xl p-5 sm:p-6 border border-[#eedcca] dark:border-[#382d3b] text-base sm:text-lg font-handwriting leading-relaxed text-zinc-800 dark:text-zinc-100 whitespace-pre-line shadow-sm mb-4">
                  {card.messageText}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 text-xs text-zinc-500 dark:text-zinc-400 font-cute">
                <span className="flex items-center gap-1 text-rose-500">
                  <Sparkles className="w-3.5 h-3.5" /> Kỷ niệm được lưu giữ an toàn
                </span>
                <span className="italic">Mãi yêu thương 💖</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {card.cardDataUrl && (
        <ImageLightbox
          images={[
            {
              url: card.cardDataUrl,
              title: card.title,
              caption: `Thư viết tay từ ${card.senderName}`,
              authorName: card.senderName,
            },
          ]}
          isOpen={isZoomOpen}
          onClose={() => setIsZoomOpen(false)}
        />
      )}
    </AnimatePresence>
  );
};
