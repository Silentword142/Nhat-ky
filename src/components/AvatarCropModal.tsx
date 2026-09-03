import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Move, Crop, RefreshCcw, Sparkles } from 'lucide-react';
import { soundService } from '../services/sound';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Reset state when a new image is loaded
  useEffect(() => {
    if (imageSrc && isOpen) {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        imgRef.current = img;
        setImageSize({ width: img.width, height: img.height });
        setZoom(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      };
    }
  }, [imageSrc, isOpen]);

  // Handle Drag / Pan (Mouse & Touch)
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Zoom control via Wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.min(Math.max(0.5, prev + delta), 4));
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    soundService.playPop();
    setRotation((prev) => (prev + 90) % 360);
  };

  // Reset transforms
  const handleReset = () => {
    soundService.playPop();
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Generate cropped output canvas
  const handleConfirmCrop = useCallback(() => {
    if (!imgRef.current) return;
    soundService.playSparkle();

    const OUTPUT_SIZE = 360; // Quality resolution for avatar
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const CROP_CONTAINER_SIZE = 260; // Visual preview size in px
    const scaleFactor = OUTPUT_SIZE / CROP_CONTAINER_SIZE;

    // Center output context
    ctx.save();
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Calculate base rendering dimensions to cover/fit
    const img = imgRef.current;
    let baseWidth = CROP_CONTAINER_SIZE;
    let baseHeight = CROP_CONTAINER_SIZE;

    if (img.width > img.height) {
      baseWidth = (img.width / img.height) * CROP_CONTAINER_SIZE;
    } else {
      baseHeight = (img.height / img.width) * CROP_CONTAINER_SIZE;
    }

    const finalWidth = baseWidth * zoom * scaleFactor;
    const finalHeight = baseHeight * zoom * scaleFactor;
    const finalPosX = position.x * scaleFactor;
    const finalPosY = position.y * scaleFactor;

    // Account for rotation in translation offset
    if (rotation === 90) {
      ctx.drawImage(img, finalPosY - finalWidth / 2, -finalPosX - finalHeight / 2, finalWidth, finalHeight);
    } else if (rotation === 180) {
      ctx.drawImage(img, -finalPosX - finalWidth / 2, -finalPosY - finalHeight / 2, finalWidth, finalHeight);
    } else if (rotation === 270) {
      ctx.drawImage(img, -finalPosY - finalWidth / 2, finalPosX - finalHeight / 2, finalWidth, finalHeight);
    } else {
      ctx.drawImage(img, finalPosX - finalWidth / 2, finalPosY - finalHeight / 2, finalWidth, finalHeight);
    }

    ctx.restore();

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCropComplete(croppedDataUrl);
  }, [zoom, rotation, position, onCropComplete]);

  if (!isOpen || !imageSrc) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] p-6 shadow-2xl border border-rose-100 dark:border-zinc-800 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500">
                <Crop className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-white font-cute flex items-center gap-1.5">
                  <span>Căn Chỉnh & Cắt Ảnh Avatar</span>
                  <Sparkles className="w-4 h-4 text-rose-500" />
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Kéo để di chuyển, phóng to / thu nhỏ cho vừa khung tròn
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 transition"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Interactive Crop Stage */}
          <div className="flex flex-col items-center justify-center">
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              className="relative w-[260px] h-[260px] rounded-3xl bg-zinc-950 overflow-hidden cursor-grab active:cursor-grabbing select-none border-2 border-rose-200 dark:border-zinc-700 shadow-inner flex items-center justify-center"
            >
              {/* Scaled & Rotated & Positioned Image */}
              {imageSrc && (
                <div
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${zoom})`,
                    transition: isDragging ? 'none' : 'transform 0.08s ease-out',
                    transformOrigin: 'center center',
                  }}
                  className="pointer-events-none flex items-center justify-center max-w-none max-h-none"
                >
                  <img
                    src={imageSrc}
                    alt="Crop preview"
                    className="max-w-none object-contain"
                    style={{
                      width: imageSize.width > imageSize.height ? 'auto' : '260px',
                      height: imageSize.width > imageSize.height ? '260px' : 'auto',
                    }}
                    draggable={false}
                  />
                </div>
              )}

              {/* Circular Avatar Mask Guide */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Dark Vignette outside circle */}
                <div
                  className="w-full h-full"
                  style={{
                    background:
                      'radial-gradient(circle at center, transparent 116px, rgba(0, 0, 0, 0.65) 118px)',
                  }}
                />
                {/* Glowing Circular Border */}
                <div className="absolute w-[232px] h-[232px] rounded-full border-2 border-dashed border-white/90 shadow-[0_0_15px_rgba(255,255,255,0.4)] pointer-events-none" />
                {/* Center crosshair */}
                <div className="absolute w-4 h-0.5 bg-white/40 pointer-events-none" />
                <div className="absolute h-4 w-0.5 bg-white/40 pointer-events-none" />
              </div>

              {/* Drag indicator hint */}
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[10px] text-white/80 font-medium flex items-center gap-1 pointer-events-none">
                <Move className="w-3 h-3" />
                <span>Kéo để căn giữa</span>
              </div>
            </div>
          </div>

          {/* Controls: Zoom Slider, Rotate, Reset */}
          <div className="space-y-3 pt-1">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.2))}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-50 dark:hover:bg-zinc-700 transition"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <div className="flex-1 flex items-center gap-2">
                <input
                  type="range"
                  min="0.6"
                  max="3.5"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <span className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300 w-10 text-right">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3.5, prev + 0.2))}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-50 dark:hover:bg-zinc-700 transition"
                title="Phóng to"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRotate}
                  className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Xoay 90°</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs transition"
                >
                  <RefreshCcw className="w-3.5 h-3.5 inline mr-1" />
                  <span>Đặt lại</span>
                </button>
              </div>

              <div className="text-[11px] text-zinc-400 font-cute">
                Ảnh đại diện tròn hoàn hảo ✨
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Xác Nhận & Dùng Avatar Này 💖</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
