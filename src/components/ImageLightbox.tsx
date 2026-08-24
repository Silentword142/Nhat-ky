import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Move,
  ExternalLink,
} from 'lucide-react';
import { soundService } from '../services/sound';
import { formatDateVN } from '../utils/date';

export interface LightboxImageItem {
  url: string;
  title?: string;
  caption?: string;
  date?: string;
  location?: string;
  authorName?: string;
  originalQuality?: boolean;
  driveViewUrl?: string;
  driveDownloadUrl?: string;
  fileSize?: number;
  fileName?: string;
}

interface ImageLightboxProps {
  images: LightboxImageItem[] | string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Normalize image list
  const normalizedImages: LightboxImageItem[] = React.useMemo(() => {
    return images.map((img) => (typeof img === 'string' ? { url: img } : img));
  }, [images]);

  // Sync initial index
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex >= 0 && initialIndex < normalizedImages.length ? initialIndex : 0);
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex, normalizedImages.length]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, normalizedImages.length]);

  const handleNext = () => {
    if (currentIndex < normalizedImages.length - 1) {
      soundService.playPop();
      setCurrentIndex((prev) => prev + 1);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      soundService.playPop();
      setCurrentIndex((prev) => prev - 1);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleZoomIn = () => {
    soundService.playPop();
    setScale((prev) => Math.min(prev + 0.35, 4.0));
  };

  const handleZoomOut = () => {
    soundService.playPop();
    setScale((prev) => {
      const next = Math.max(prev - 0.35, 0.6);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    soundService.playPop();
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    soundService.playPop();
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(prev + 0.2, 4.0));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.2, 0.6);
        if (next <= 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownload = () => {
    soundService.playPop();
    const currentItem = normalizedImages[currentIndex];
    if (!currentItem) return;
    const link = document.createElement('a');
    link.href = currentItem.url;
    link.download = currentItem.title ? `${currentItem.title}.png` : `lovesync_memory_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || normalizedImages.length === 0) return null;

  const currentItem = normalizedImages[currentIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Top Control Bar */}
        <div className="absolute top-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between text-white z-20 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-semibold backdrop-blur-xs">
              {currentIndex + 1} / {normalizedImages.length}
            </span>
            {currentItem?.title && (
              <span className="font-serif italic font-bold text-sm sm:text-base text-rose-200 truncate max-w-[200px] sm:max-w-md">
                {currentItem.title}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold">
              Chất lượng gốc ✨
            </span>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {currentItem?.driveViewUrl && (
              <a
                href={currentItem.driveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5"
                title="Mở ảnh gốc trong Google Drive"
              >
                <span>Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              onClick={handleZoomOut}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95 cursor-pointer"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono w-12 text-center text-zinc-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95 cursor-pointer"
              title="Phóng to (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95 cursor-pointer"
              title="Khôi phục 100% (0)"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleRotate}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95 cursor-pointer"
              title="Xoay 90 độ"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95 cursor-pointer"
              title="Tải ảnh về máy"
            >
              <Download className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-white/20 mx-1" />
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white transition active:scale-95 shadow-lg shadow-rose-900/50 cursor-pointer"
              title="Đóng (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Previous Button */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-20 backdrop-blur-xs active:scale-95 cursor-pointer"
            title="Ảnh trước (Mũi tên trái)"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {/* Next Button */}
        {currentIndex < normalizedImages.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 p-3 sm:p-4 rounded-full bg-white/10 hover:bg-white/20 text-white transition z-20 backdrop-blur-xs active:scale-95 cursor-pointer"
            title="Ảnh tiếp theo (Mũi tên phải)"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {/* Main Stage Image with Zoom & Pan */}
        <div
          className="relative w-full h-full flex items-center justify-center p-6 sm:p-12 overflow-hidden"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          <motion.img
            key={currentItem.url}
            src={currentItem.url}
            alt={currentItem.title || 'LoveSync Memory'}
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-2xl shadow-2xl transition-transform duration-75 select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            }}
            draggable={false}
          />
        </div>

        {/* Bottom Caption & Memory Info */}
        {(currentItem.caption || currentItem.date || currentItem.location) && (
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white z-20 pointer-events-none">
            <div className="max-w-2xl mx-auto text-center space-y-1">
              {currentItem.caption && (
                <p className="font-cute text-sm sm:text-base text-zinc-100 drop-shadow-md">
                  "{currentItem.caption}"
                </p>
              )}
              <div className="flex items-center justify-center gap-3 text-xs text-rose-300/80 font-sans">
                {currentItem.date && <span>📅 {formatDateVN(currentItem.date)}</span>}
                {currentItem.location && <span>📍 {currentItem.location}</span>}
                {currentItem.authorName && <span>✍️ Bởi {currentItem.authorName}</span>}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
