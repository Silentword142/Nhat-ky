import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  PenTool,
  Eraser,
  RotateCcw,
  Sparkles,
  Heart,
  Mail,
  Send,
  Trash2,
  Eye,
  X,
  Palette,
  Stamp,
  Type,
  Check,
} from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { HandwrittenCard } from '../types';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { EnvelopeModal } from '../components/EnvelopeModal';
import { formatDateVN } from '../utils/date';

const PAPER_TEMPLATES = [
  { id: 'lined', name: 'Giấy Kẻ Ngang', className: 'paper-lined', previewColor: '#fffdfa' },
  { id: 'sakura', name: 'Hoa Anh Đào', className: 'bg-rose-50/90', previewColor: '#ffe4e6' },
  { id: 'parchment', name: 'Vintage Cổ Điển', className: 'bg-[#faf3e8]', previewColor: '#faf3e8' },
  { id: 'starry', name: 'Đêm Sao Lãng Mạn', className: 'bg-[#1e1b2e] text-white', previewColor: '#1e1b2e' },
  { id: 'grid', name: 'Sổ Lưới Cute', className: 'paper-grid', previewColor: '#fffbf5' },
];

const PEN_COLORS = [
  { hex: '#be123c', name: 'Đỏ Hồng Lãng Mạn' },
  { hex: '#e11d48', name: 'Đỏ Tình Yêu' },
  { hex: '#a855f7', name: 'Tím Thơ Mộng' },
  { hex: '#ec4899', name: 'Hồng Phấn' },
  { hex: '#d97706', name: 'Vàng Hoàng Gia' },
  { hex: '#1e293b', name: 'Mực Đen Viết Thư' },
  { hex: '#2563eb', name: 'Xanh Mực Bút Máy' },
  { hex: '#059669', name: 'Xanh Lá Tươi Mát' },
];

const LOVE_STAMPS = ['💌', '💖', '💋', '🌸', '✨', '🐱', '🐻', '🎀', '🌹', '🎂', '💍', '🧸'];

const WAX_SEALS = [
  { id: 'rose_wax', label: 'Con Dấu Hoa Hồng', color: '#be123c', emoji: '🌹' },
  { id: 'golden_heart', label: 'Trái Tim Vàng Kim', color: '#d97706', emoji: '💛' },
  { id: 'cupid', label: 'Thần Tình Yêu', color: '#9333ea', emoji: '🏹' },
  { id: 'kiss', label: 'Nụ Hôn Ngọt Ngào', color: '#e11d48', emoji: '💋' },
];

const VIETNAMESE_FONTS = [
  { id: 'font-dancing', name: 'Dancing Script (Thư pháp thanh lịch)', sample: 'Yêu em trọn vẹn 💖' },
  { id: 'font-caveat', name: 'Caveat (Bút bi tự nhiên)', sample: 'Ấm áp bên nhau' },
  { id: 'font-patrick', name: 'Patrick Hand (Nét chữ ngay ngắn)', sample: 'Lời thì thầm ngọt ngào' },
  { id: 'font-pacifico', name: 'Pacifico (Retro lãng mạn)', sample: 'Bình yên bên anh' },
  { id: 'font-playpen', name: 'Playpen Sans (Nét bút mực tươi sáng)', sample: 'Khoảnh khắc diệu kỳ' },
  { id: 'font-cute', name: 'Quicksand (Nét tròn hiện đại)', sample: 'Kỷ niệm đôi ta' },
  { id: 'font-comfortaa', name: 'Comfortaa (Tròn trịa đáng yêu)', sample: 'Hạnh phúc ngọt ngào' },
];

export const HandwrittenCardView: React.FC = () => {
  const {
    cards,
    myProfile,
    partnerProfile,
    settings,
    sendHandwrittenCard,
    deleteCard,
  } = useCouple();

  const currentTheme = THEMES[settings.theme] || THEMES.sakura;

  // State
  const [selectedCardForView, setSelectedCardForView] = useState<HandwrittenCard | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [activeTabSub, setActiveTabSub] = useState<'all' | 'received' | 'sent'>('all');

  // Composer State
  const [cardTitle, setCardTitle] = useState('Bức thư bí mật gửi em');
  const [messageText, setMessageText] = useState('');
  const [selectedFont, setSelectedFont] = useState(VIETNAMESE_FONTS[0].id);
  const [paperTemplate, setPaperTemplate] = useState<HandwrittenCard['paperTemplate']>('lined');
  const [selectedSeal, setSelectedSeal] = useState(WAX_SEALS[0]);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].hex);
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [toolMode, setToolMode] = useState<'draw' | 'type'>('draw');

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [canvasHistory, setCanvasHistory] = useState<ImageData[]>([]);

  // Setup Canvas
  useEffect(() => {
    if (isComposerOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Set canvas resolution
        canvas.width = 600;
        canvas.height = 450;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        saveHistory();
      }
    }
  }, [isComposerOpen, paperTemplate]);

  // Save history for undo
  const saveHistory = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      const imgData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
      setCanvasHistory((prev) => [...prev.slice(-15), imgData]);
    }
  };

  // Undo drawing
  const handleUndo = () => {
    if (!canvasRef.current || canvasHistory.length <= 1) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      const newHistory = [...canvasHistory];
      newHistory.pop(); // remove current state
      const prevState = newHistory[newHistory.length - 1];
      if (prevState) {
        ctx.putImageData(prevState, 0, 0);
        setCanvasHistory(newHistory);
        soundService.playPop();
      }
    }
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      saveHistory();
      soundService.playPop();
    }
  };

  // Drawing event handlers (Touch & Mouse)
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    } else if ('clientX' in e) {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (toolMode !== 'draw' || !canvasRef.current) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = isEraser ? '#ffffff' : penColor;
    ctx.lineWidth = isEraser ? brushSize * 4 : brushSize;
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || toolMode !== 'draw' || !canvasRef.current) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveHistory();
    }
  };

  // Stamp sticker onto canvas
  const handleAddStampToCanvas = (stampEmoji: string) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '40px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      const randomX = 40 + Math.random() * (canvasRef.current.width - 100);
      const randomY = 60 + Math.random() * (canvasRef.current.height - 100);
      ctx.fillText(stampEmoji, randomX, randomY);
      saveHistory();
      soundService.playPop();
    }
  };

  // Submit Handwritten Card
  const handleSendCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cardDataUrl = '';
    if (canvasRef.current) {
      cardDataUrl = canvasRef.current.toDataURL('image/png');
    }

    sendHandwrittenCard({
      recipientName: partnerProfile?.name || 'Người thương',
      title: cardTitle.trim() || 'Thư gửi người yêu',
      cardDataUrl,
      paperTemplate,
      sealStyle: selectedSeal.id as HandwrittenCard['sealStyle'],
      sealColor: selectedSeal.color,
      messageText: messageText.trim() || undefined,
    });

    // Reset & Close
    setIsComposerOpen(false);
    setMessageText('');
    setCardTitle('Bức thư bí mật gửi em');
  };

  // Filter Cards
  const filteredCards = cards.filter((c) => {
    if (activeTabSub === 'received') return c.senderId !== myProfile.id;
    if (activeTabSub === 'sent') return c.senderId === myProfile.id;
    return true;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 pb-24 sm:pb-12">
      {/* Top action bar: Filter Tabs & Compose Card Button */}
      <div className={`p-5 rounded-[32px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-xl shadow-rose-100/30 dark:shadow-none mb-6 flex flex-col md:flex-row items-center justify-between gap-3`}>
        {/* Title & Sub tabs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <h2 className="font-serif italic text-xl sm:text-2xl text-[#333] dark:text-[#f4effa] whitespace-nowrap">
            Thiệp Viết Tay
          </h2>
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#FFF5F7] dark:bg-zinc-800 border border-[#FFE4E9] dark:border-zinc-700 w-full sm:w-auto">
            <button
              onClick={() => setActiveTabSub('all')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeTabSub === 'all'
                  ? 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow-sm'
                  : 'text-[#666] dark:text-zinc-400 hover:text-[#FF758F]'
              }`}
            >
              Tất Cả ({cards.length})
            </button>
            <button
              onClick={() => setActiveTabSub('received')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeTabSub === 'received'
                  ? 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow-sm'
                  : 'text-[#666] dark:text-zinc-400 hover:text-[#FF758F]'
              }`}
            >
              Đã Nhận 💌
            </button>
            <button
              onClick={() => setActiveTabSub('sent')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-bold transition ${
                activeTabSub === 'sent'
                  ? 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow-sm'
                  : 'text-[#666] dark:text-zinc-400 hover:text-[#FF758F]'
              }`}
            >
              Đã Gửi 📤
            </button>
          </div>
        </div>

        {/* Compose Button */}
        <button
          onClick={() => {
            soundService.playPop();
            setIsComposerOpen(true);
          }}
          className="w-full md:w-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] hover:from-[#ff607e] hover:to-[#ff8d92] text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap"
        >
          <PenTool className="w-4 h-4 stroke-[2.5px]" />
          <span>Viết & Vẽ Thiệp Mới</span>
        </button>
      </div>

      {/* Cards List / Envelopes Grid */}
      {filteredCards.length === 0 ? (
        <div className={`text-center py-16 px-4 rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle}`}>
          <div className="w-20 h-20 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center text-3xl mb-3 animate-float-slow">
            💌
          </div>
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1 font-cute">
            Hộp thư tình yêu đang trống
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-4">
            Hãy tự tay vẽ một bức thiệp xinh xắn, dán dấu sáp đỏ và gửi đến người yêu của bạn ngay nào!
          </p>
          <button
            onClick={() => setIsComposerOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-300 dark:shadow-rose-950 transition"
          >
            ✍️ Vẽ Bức Thư Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {filteredCards.map((card) => {
            const isSender = card.senderId === myProfile.id;
            const isOpened = card.isOpened;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -4 }}
                className="group relative bg-[#faf4ec] dark:bg-zinc-900/90 rounded-3xl p-5 shadow-md hover:shadow-xl transition-all duration-300 border-2 border-[#ecdfce] dark:border-zinc-800 flex flex-col justify-between overflow-hidden cursor-pointer"
                onClick={() => setSelectedCardForView(card)}
              >
                {/* Envelope Flap Header visual */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300">
                      {isSender ? '📤 Thư bạn gửi' : '💌 Thư nhận được'}
                    </span>
                    {!isOpened && !isSender && (
                      <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                        Mới
                      </span>
                    )}
                  </div>

                  {isSender && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCard(card.id);
                      }}
                      className="p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      title="Xóa thư"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Wax Seal Center Graphic */}
                <div className="my-4 flex flex-col items-center justify-center text-center">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 mb-2"
                    style={{
                      backgroundColor: card.sealColor || '#be123c',
                      boxShadow: `0 4px 15px ${card.sealColor || '#be123c'}50`,
                    }}
                  >
                    <div className="w-12 h-12 rounded-full border border-white/40 flex items-center justify-center">
                      <Heart className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>

                  <h4 className="font-bold text-base text-zinc-800 dark:text-zinc-100 font-romantic line-clamp-1">
                    {card.title || 'Bức thư ngọt ngào'}
                  </h4>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-cute">
                    Từ: <span className="font-semibold text-rose-600 dark:text-rose-400">{card.senderName}</span>
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-[#e8d9c5] dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    {formatDateVN(card.sentAt)}
                  </span>

                  <span className="flex items-center gap-1 text-rose-500 font-bold group-hover:underline font-cute">
                    <Eye className="w-3.5 h-3.5" />
                    {isOpened || isSender ? 'Xem Thư' : 'Mở Dấu Sáp ✨'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ENVELOPE OPEN MODAL */}
      <EnvelopeModal
        card={selectedCardForView}
        onClose={() => setSelectedCardForView(null)}
      />

      {/* HANDWRITTEN CARD COMPOSER MODAL */}
      <AnimatePresence>
        {isComposerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-3xl w-full my-auto bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-zinc-800 p-4 sm:p-6 max-h-[95vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✍️</span>
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-zinc-100 font-cute">
                    Tự Tay Viết & Vẽ Thiệp Tình Yêu
                  </h3>
                </div>
                <button
                  onClick={() => setIsComposerOpen(false)}
                  className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSendCardSubmit} className="space-y-3.5">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                    Tiêu đề phong thư
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Bức thư gửi công chúa của anh..."
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400"
                  />
                </div>

                {/* Toolbar: Tool modes, Pen Colors, Brush Size, Eraser, Clear, Paper style */}
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  {/* Mode switch: Draw Canvas vs Handwritten Text */}
                  <div className="flex items-center gap-1 bg-zinc-200 dark:bg-zinc-700 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setToolMode('draw')}
                      className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                        toolMode === 'draw'
                          ? 'bg-white dark:bg-zinc-900 text-rose-500 shadow-sm'
                          : 'text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" /> Vẽ Tự Do
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolMode('type')}
                      className={`px-3 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                        toolMode === 'type'
                          ? 'bg-white dark:bg-zinc-900 text-rose-500 shadow-sm'
                          : 'text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <Type className="w-3.5 h-3.5" /> Viết Chữ
                    </button>
                  </div>

                  {/* Pen Colors in Draw mode */}
                  {toolMode === 'draw' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {PEN_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => {
                            setPenColor(c.hex);
                            setIsEraser(false);
                          }}
                          className={`w-6 h-6 rounded-full border-2 transition transform ${
                            penColor === c.hex && !isEraser
                              ? 'scale-125 border-zinc-800 dark:border-white'
                              : 'border-transparent hover:scale-110'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  )}

                  {/* Font Style Selection when typing mode */}
                  {toolMode === 'type' && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-zinc-500">Phông chữ:</span>
                      {VIETNAMESE_FONTS.map((font) => (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => setSelectedFont(font.id)}
                          className={`px-2.5 py-1 rounded-xl text-xs transition border ${
                            selectedFont === font.id
                              ? 'bg-rose-500 text-white font-bold border-rose-500 shadow-sm'
                              : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-rose-50'
                          } ${font.id}`}
                        >
                          {font.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Brush controls */}
                  {toolMode === 'draw' && (
                    <div className="flex items-center gap-1.5">
                      {/* Eraser */}
                      <button
                        type="button"
                        onClick={() => setIsEraser(!isEraser)}
                        className={`p-1.5 rounded-xl transition ${
                          isEraser
                            ? 'bg-rose-500 text-white font-bold'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'
                        }`}
                        title="Tẩy nét vẽ"
                      >
                        <Eraser className="w-4 h-4" />
                      </button>

                      {/* Undo */}
                      <button
                        type="button"
                        onClick={handleUndo}
                        className="p-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300"
                        title="Hoàn tác"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {/* Clear */}
                      <button
                        type="button"
                        onClick={handleClearCanvas}
                        className="p-1.5 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:text-red-500"
                        title="Xóa trắng"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Cute Stamps Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="font-bold text-zinc-500 whitespace-nowrap flex items-center gap-1">
                    <Stamp className="w-3.5 h-3.5" /> Dán Sticker:
                  </span>
                  {LOVE_STAMPS.map((stamp) => (
                    <button
                      key={stamp}
                      type="button"
                      onClick={() => handleAddStampToCanvas(stamp)}
                      className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-base transition active:scale-125"
                      title="Chạm để đóng dấu lên thiệp"
                    >
                      {stamp}
                    </button>
                  ))}
                </div>

                {/* CANVAS DRAWING STAGE or TEXT WRITING STAGE */}
                <div
                  className={`relative w-full rounded-2xl overflow-hidden shadow-inner border-2 border-[#ebd9c5] dark:border-zinc-800 ${
                    PAPER_TEMPLATES.find((p) => p.id === paperTemplate)?.className || 'paper-lined'
                  }`}
                  style={{ minHeight: '340px' }}
                >
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-[340px] touch-none cursor-crosshair block"
                  />

                  {/* Text Overlay if in typing mode */}
                  {toolMode === 'type' && (
                    <div className="absolute inset-0 p-6 flex flex-col pointer-events-auto bg-transparent">
                      <textarea
                        rows={8}
                        placeholder="Viết những lời thì thầm ngọt ngào bằng nét chữ tay tại đây..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        className={`w-full h-full bg-transparent border-0 ${selectedFont} text-xl sm:text-2xl text-zinc-800 dark:text-zinc-100 focus:ring-0 leading-relaxed resize-none placeholder:text-zinc-400`}
                      />
                    </div>
                  )}
                </div>

                {/* Stationery Paper & Wax Seal Customization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Paper Selector */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      Mẫu Giấy Thư
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {PAPER_TEMPLATES.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPaperTemplate(p.id as HandwrittenCard['paperTemplate'])}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                            paperTemplate === p.id
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300'
                              : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Wax Seal Selector */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">
                      Con Dấu Sáp Niêm Phong
                    </label>
                    <div className="flex gap-2">
                      {WAX_SEALS.map((seal) => (
                        <button
                          key={seal.id}
                          type="button"
                          onClick={() => setSelectedSeal(seal)}
                          className={`flex-1 p-2 rounded-xl border flex flex-col items-center gap-1 transition ${
                            selectedSeal.id === seal.id
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40'
                              : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'
                          }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white shadow-sm"
                            style={{ backgroundColor: seal.color }}
                          >
                            {seal.emoji}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-200 truncate">
                            {seal.emoji}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submit & Cancel Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="px-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-200"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-300 dark:shadow-rose-950 flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>Niêm Phong & Gửi Thư 💌</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
