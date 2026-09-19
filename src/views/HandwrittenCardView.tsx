import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PenTool,
  Eraser,
  RotateCcw,
  Heart,
  Send,
  Trash2,
  Eye,
  X,
  Stamp,
  Type,
} from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { HandwrittenCard } from '../types';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';
import { EnvelopeModal } from '../components/EnvelopeModal';
import { CardPage, CARD_PAPERS, CARD_FONTS, cardTextStyle, getCardPaper } from '../components/CardPage';
import { formatDateVN } from '../utils/date';

const PEN_COLORS = [
  { hex: '#be123c', name: 'Đỏ Hồng Lãng Mạn' },
  { hex: '#e11d48', name: 'Đỏ Tình Yêu' },
  { hex: '#a855f7', name: 'Tím Thơ Mộng' },
  { hex: '#ec4899', name: 'Hồng Phấn' },
  { hex: '#d97706', name: 'Vàng Hoàng Gia' },
  { hex: '#1e293b', name: 'Mực Đen Viết Thư' },
  { hex: '#2563eb', name: 'Xanh Mực Bút Máy' },
  { hex: '#059669', name: 'Xanh Lá Tươi Mát' },
  { hex: '#ffffff', name: 'Trắng (hợp giấy tối)' },
];

const LOVE_STAMPS = ['💌', '💖', '💋', '🌸', '✨', '🐱', '🐻', '🎀', '🌹', '🎂', '💍', '🧸'];

const WAX_SEALS = [
  { id: 'rose_wax', label: 'Con Dấu Hoa Hồng', color: '#be123c', emoji: '🌹' },
  { id: 'golden_heart', label: 'Trái Tim Vàng Kim', color: '#d97706', emoji: '💛' },
  { id: 'cupid', label: 'Thần Tình Yêu', color: '#9333ea', emoji: '🏹' },
  { id: 'kiss', label: 'Nụ Hôn Ngọt Ngào', color: '#e11d48', emoji: '💋' },
];

// The drawing layer is a transparent PNG synced through Firestore, which drops inline data URLs
// over ~250k chars (see stripHeavyInlineDataForCloudSync) — keep the export comfortably below.
const CANVAS_W = 600;
const CANVAS_H = 800;
const MAX_DRAWING_DATA_URL = 230_000;

const exportDrawing = (canvas: HTMLCanvasElement): string => {
  let url = canvas.toDataURL('image/png');
  if (url.length <= MAX_DRAWING_DATA_URL) return url;
  for (const scale of [0.75, 0.55]) {
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(CANVAS_W * scale);
    tmp.height = Math.round(CANVAS_H * scale);
    tmp.getContext('2d')?.drawImage(canvas, 0, 0, tmp.width, tmp.height);
    url = tmp.toDataURL('image/png');
    if (url.length <= MAX_DRAWING_DATA_URL) break;
  }
  return url;
};

export const HandwrittenCardView: React.FC = () => {
  const { cards, myProfile, partnerProfile, settings, sendHandwrittenCard, deleteCard } = useCouple();

  const currentTheme = THEMES[settings.theme] || THEMES.sakura;

  // State
  const [selectedCardForView, setSelectedCardForView] = useState<HandwrittenCard | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [activeTabSub, setActiveTabSub] = useState<'all' | 'received' | 'sent'>('all');

  // Composer State
  const [cardTitle, setCardTitle] = useState('Bức thư bí mật gửi em');
  const [messageText, setMessageText] = useState('');
  const [selectedFont, setSelectedFont] = useState(CARD_FONTS[0].id);
  const [paperTemplate, setPaperTemplate] = useState<HandwrittenCard['paperTemplate']>('lined');
  const [selectedSeal, setSelectedSeal] = useState(WAX_SEALS[0]);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].hex);
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  // Text is the main content; drawing is an optional layer on the same page.
  const [toolMode, setToolMode] = useState<'type' | 'draw'>('type');

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const paper = getCardPaper(paperTemplate);

  // Fresh, transparent canvas each time the composer opens. Changing paper must NOT clear it.
  useEffect(() => {
    if (!isComposerOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    historyRef.current = [ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)];
    setHasDrawn(false);
  }, [isComposerOpen]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    historyRef.current = [...historyRef.current.slice(-15), ctx.getImageData(0, 0, canvas.width, canvas.height)];
    setHasDrawn(true);
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || historyRef.current.length <= 1) return;
    const next = historyRef.current.slice(0, -1);
    ctx.putImageData(next[next.length - 1], 0, 0);
    historyRef.current = next;
    setHasDrawn(next.length > 1);
    soundService.playPop();
  };

  const handleClearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    setHasDrawn(false);
    soundService.playPop();
  };

  const getCoordinates = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (toolMode !== 'draw') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getCoordinates(e);
    isDrawingRef.current = true;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = penColor;
    ctx.fillStyle = penColor;
    ctx.lineWidth = isEraser ? brushSize * 4 : brushSize;
    // A dot for a simple tap
    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || toolMode !== 'draw') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    canvasRef.current?.getContext('2d')?.beginPath();
    saveHistory();
  };

  const handleAddStampToCanvas = (stampEmoji: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '56px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText(stampEmoji, 40 + Math.random() * (canvas.width - 130), 80 + Math.random() * (canvas.height - 140));
    saveHistory();
    soundService.playPop();
  };

  const canSend = messageText.trim().length > 0 || hasDrawn;

  const handleSendCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;

    sendHandwrittenCard({
      recipientName: partnerProfile?.name || 'Người thương',
      title: cardTitle.trim() || 'Thư gửi người yêu',
      cardDataUrl: hasDrawn && canvasRef.current ? exportDrawing(canvasRef.current) : '',
      paperTemplate,
      sealStyle: selectedSeal.id as HandwrittenCard['sealStyle'],
      sealColor: selectedSeal.color,
      messageText: messageText.trim() || undefined,
      fontId: selectedFont,
      layout: 'stage',
    });

    setIsComposerOpen(false);
    setMessageText('');
    setToolMode('type');
    setCardTitle('Bức thư bí mật gửi em');
  };

  // Filter Cards
  const filteredCards = cards.filter((c) => {
    if (activeTabSub === 'received') return c.senderId !== myProfile.id;
    if (activeTabSub === 'sent') return c.senderId === myProfile.id;
    return true;
  });

  const subTabs = [
    { id: 'all' as const, label: `Tất Cả (${cards.length})` },
    { id: 'received' as const, label: 'Đã Nhận 💌' },
    { id: 'sent' as const, label: 'Đã Gửi 📤' },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 pb-24 sm:pb-12">
      {/* Top action bar: Filter Tabs & Compose Card Button */}
      <div className={`p-5 rounded-[32px] ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-xl shadow-rose-100/30 dark:shadow-none mb-6 flex flex-col md:flex-row items-center justify-between gap-3`}>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <h2 className="font-serif italic text-xl sm:text-2xl text-[#333] dark:text-[#f4effa] whitespace-nowrap">Thiệp Viết Tay</h2>
          <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#FFF5F7] dark:bg-zinc-800 border border-[#FFE4E9] dark:border-zinc-700 w-full sm:w-auto">
            {subTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTabSub(t.id)}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-xs font-bold transition ${
                  activeTabSub === t.id
                    ? 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow-sm'
                    : 'text-[#666] dark:text-zinc-400 hover:text-[#FF758F]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            soundService.playPop();
            setIsComposerOpen(true);
          }}
          className="w-full md:w-auto px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] hover:from-[#ff607e] hover:to-[#ff8d92] text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center justify-center gap-2 transition active:scale-95 whitespace-nowrap"
        >
          <PenTool className="w-4 h-4 stroke-[2.5px]" />
          <span>Viết Thiệp Mới</span>
        </button>
      </div>

      {/* Cards List / Envelopes Grid */}
      {filteredCards.length === 0 ? (
        <div className={`text-center py-16 px-4 rounded-3xl ${currentTheme.cardBg} border ${currentTheme.borderSubtle}`}>
          <div className="w-20 h-20 mx-auto rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center text-3xl mb-3 animate-float-slow">💌</div>
          <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1 font-cute">Hộp thư tình yêu đang trống</h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-4">
            Hãy viết một bức thiệp xinh xắn, vẽ thêm vài nét dễ thương, dán dấu sáp đỏ và gửi đến người yêu của bạn ngay nào!
          </p>
          <button
            onClick={() => setIsComposerOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-300 dark:shadow-rose-950 transition"
          >
            ✍️ Viết Bức Thư Đầu Tiên
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
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300">
                      {isSender ? '📤 Thư bạn gửi' : '💌 Thư nhận được'}
                    </span>
                    {!isOpened && !isSender && (
                      <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">Mới</span>
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

                  <h4 className="font-bold text-base text-zinc-800 dark:text-zinc-100 font-romantic line-clamp-1">{card.title || 'Bức thư ngọt ngào'}</h4>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-cute">
                    Từ: <span className="font-semibold text-rose-600 dark:text-rose-400">{card.senderName}</span>
                  </p>
                </div>

                <div className="pt-3 border-t border-[#e8d9c5] dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>{formatDateVN(card.sentAt)}</span>
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
      <EnvelopeModal card={selectedCardForView} onClose={() => setSelectedCardForView(null)} />

      {/* CARD COMPOSER MODAL */}
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
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-800 dark:text-zinc-100 font-cute">Viết Thiệp Tình Yêu</h3>
                </div>
                <button onClick={() => setIsComposerOpen(false)} className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Đóng">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSendCardSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1">Tiêu đề phong thư</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Bức thư gửi công chúa của anh..."
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm font-semibold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,420px)_1fr] gap-4 items-start">
                  {/* THE PAGE: text first, drawing layered on the same paper */}
                  <div className="mx-auto w-full max-w-[420px]">
                    <CardPage
                      paperId={paperTemplate}
                      textLayer={
                        <div className="absolute inset-[6cqw]">
                          <textarea
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Viết những lời thì thầm ngọt ngào tại đây..."
                            className={`${selectedFont} w-full h-full p-0 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none placeholder:opacity-40`}
                            style={cardTextStyle(paper)}
                          />
                        </div>
                      }
                    >
                      <canvas
                        ref={canvasRef}
                        onPointerDown={startDrawing}
                        onPointerMove={draw}
                        onPointerUp={stopDrawing}
                        onPointerCancel={stopDrawing}
                        className={`absolute inset-0 w-full h-full block ${toolMode === 'draw' ? 'cursor-crosshair touch-none' : 'pointer-events-none'}`}
                      />
                    </CardPage>
                    <p className="text-[11px] text-zinc-400 text-center mt-1.5">
                      {toolMode === 'type' ? 'Đang viết chữ — chuyển sang "Vẽ thêm" để vẽ lên trang giấy' : 'Đang vẽ trực tiếp lên trang giấy'}
                    </p>
                  </div>

                  {/* TOOLS */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1 bg-zinc-200 dark:bg-zinc-700 p-1 rounded-xl text-xs">
                      {[
                        { id: 'type' as const, label: 'Viết chữ', icon: <Type className="w-3.5 h-3.5" /> },
                        { id: 'draw' as const, label: 'Vẽ thêm', icon: <PenTool className="w-3.5 h-3.5" /> },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setToolMode(m.id)}
                          className={`flex-1 px-3 py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                            toolMode === m.id ? 'bg-white dark:bg-zinc-900 text-rose-500 shadow-sm' : 'text-zinc-600 dark:text-zinc-300'
                          }`}
                        >
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>

                    {toolMode === 'type' ? (
                      <div>
                        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">Kiểu chữ</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CARD_FONTS.map((font) => (
                            <button
                              key={font.id}
                              type="button"
                              onClick={() => setSelectedFont(font.id)}
                              className={`px-2.5 py-2 rounded-xl text-left border transition ${
                                selectedFont === font.id
                                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 shadow-sm'
                                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                              }`}
                            >
                              <span className={`${font.id} block text-base leading-tight truncate`}>{font.sample}</span>
                              <span className="block text-[10px] opacity-60 mt-0.5">{font.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {PEN_COLORS.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onClick={() => {
                                setPenColor(c.hex);
                                setIsEraser(false);
                              }}
                              className={`w-7 h-7 rounded-full border-2 transition transform ${
                                penColor === c.hex && !isEraser ? 'scale-125 border-zinc-800 dark:border-white' : 'border-zinc-300 hover:scale-110'
                              }`}
                              style={{ backgroundColor: c.hex }}
                              title={c.name}
                            />
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-zinc-500">Nét bút</span>
                          <input
                            type="range"
                            min={2}
                            max={16}
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="flex-1 accent-rose-500"
                          />
                          <span className="w-4 h-4 rounded-full bg-zinc-800 dark:bg-white shrink-0" style={{ transform: `scale(${0.3 + brushSize / 16})` }} />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setIsEraser(!isEraser)}
                            className={`p-2 rounded-xl transition ${isEraser ? 'bg-rose-500 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200'}`}
                            title="Tẩy nét vẽ"
                          >
                            <Eraser className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleUndo}
                            className="p-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300"
                            title="Hoàn tác"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={handleClearCanvas}
                            className="p-2 rounded-xl bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:text-red-500"
                            title="Xóa hết nét vẽ (giữ nguyên chữ)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div>
                          <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1 mb-1.5">
                            <Stamp className="w-3.5 h-3.5" /> Dán sticker
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {LOVE_STAMPS.map((stamp) => (
                              <button
                                key={stamp}
                                type="button"
                                onClick={() => handleAddStampToCanvas(stamp)}
                                className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-100 dark:hover:bg-rose-950 text-lg transition active:scale-125"
                                title="Chạm để dán lên thiệp"
                              >
                                {stamp}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Paper */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">Mẫu giấy thư</label>
                      <div className="flex gap-2 flex-wrap">
                        {CARD_PAPERS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setPaperTemplate(p.id as HandwrittenCard['paperTemplate'])}
                            title={p.name}
                            className={`w-9 h-9 rounded-xl border-2 transition ${paperTemplate === p.id ? 'border-rose-500 scale-110 shadow-md' : 'border-zinc-300 dark:border-zinc-600'}`}
                            style={{ backgroundColor: p.swatch }}
                          />
                        ))}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">{paper.name}</p>
                    </div>

                    {/* Wax Seal */}
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">Con dấu sáp niêm phong</label>
                      <div className="flex gap-2">
                        {WAX_SEALS.map((seal) => (
                          <button
                            key={seal.id}
                            type="button"
                            onClick={() => setSelectedSeal(seal)}
                            title={seal.label}
                            className={`flex-1 p-2 rounded-xl border flex items-center justify-center transition ${
                              selectedSeal.id === seal.id ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800'
                            }`}
                          >
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white shadow-sm" style={{ backgroundColor: seal.color }}>
                              {seal.emoji}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

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
                    disabled={!canSend}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-300 dark:shadow-rose-950 flex items-center gap-1.5 transition active:scale-95"
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
