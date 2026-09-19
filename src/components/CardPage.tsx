import React from 'react';

/**
 * A letter "page": the message text is the main content, and an optional hand-drawn layer
 * (transparent PNG) sits on top of the same paper. Everything is sized in container units
 * (cqw) so the composer preview and the opened letter look identical at any width.
 */

export interface CardPaperStyle {
  id: string;
  name: string;
  bg: string;
  ink: string;
  line: string;
  pattern: 'lines' | 'dots' | 'none';
  swatch: string;
}

export const CARD_PAPERS: CardPaperStyle[] = [
  { id: 'lined', name: 'Giấy kẻ ngang', bg: '#fffdfa', ink: '#3f2f2a', line: '#ebd5c7', pattern: 'lines', swatch: '#fffdfa' },
  { id: 'sakura', name: 'Hoa anh đào', bg: '#ffe9ee', ink: '#5b2135', line: '#f9c6d3', pattern: 'lines', swatch: '#ffe4e6' },
  { id: 'parchment', name: 'Vintage cổ điển', bg: '#f7ecd8', ink: '#4a3520', line: '#e3cfa8', pattern: 'lines', swatch: '#f7ecd8' },
  { id: 'starry', name: 'Đêm sao', bg: '#1e1b2e', ink: '#f4effa', line: '#3a3557', pattern: 'lines', swatch: '#1e1b2e' },
  { id: 'grid', name: 'Sổ chấm bi', bg: '#fffbf5', ink: '#3f2f2a', line: '#e5cfba', pattern: 'dots', swatch: '#fffbf5' },
  { id: 'pastel', name: 'Pastel trơn', bg: '#efeaff', ink: '#3b2f5c', line: '#efeaff', pattern: 'none', swatch: '#efeaff' },
];

export const getCardPaper = (id?: string): CardPaperStyle => CARD_PAPERS.find((p) => p.id === id) || CARD_PAPERS[0];

export const CARD_FONTS = [
  { id: 'font-dancing', name: 'Dancing', sample: 'Yêu em trọn vẹn' },
  { id: 'font-caveat', name: 'Caveat', sample: 'Ấm áp bên nhau' },
  { id: 'font-patrick', name: 'Patrick', sample: 'Lời thì thầm' },
  { id: 'font-pacifico', name: 'Pacifico', sample: 'Bình yên bên anh' },
  { id: 'font-playpen', name: 'Playpen', sample: 'Khoảnh khắc diệu kỳ' },
  { id: 'font-cute', name: 'Quicksand', sample: 'Kỷ niệm đôi ta' },
  { id: 'font-comfortaa', name: 'Comfortaa', sample: 'Hạnh phúc ngọt ngào' },
];

const LINE_H = 8.4; // cqw
const FONT_SIZE = 4.9; // cqw

export const cardTextStyle = (paper: CardPaperStyle): React.CSSProperties => {
  const style: React.CSSProperties = {
    color: paper.ink,
    fontSize: `${FONT_SIZE}cqw`,
    lineHeight: `${LINE_H}cqw`,
    backgroundAttachment: 'local',
  };
  if (paper.pattern === 'lines') {
    style.backgroundImage = `repeating-linear-gradient(transparent, transparent calc(${LINE_H}cqw - 1px), ${paper.line} calc(${LINE_H}cqw - 1px), ${paper.line} ${LINE_H}cqw)`;
    style.backgroundSize = `100% ${LINE_H}cqw`;
  }
  return style;
};

interface CardPageProps {
  paperId?: string;
  /** Interactive text layer (composer). When omitted, `text` is rendered read-only. */
  textLayer?: React.ReactNode;
  text?: string;
  fontId?: string;
  /** Transparent drawing shown on top of the text. */
  overlaySrc?: string;
  /** Extra layers above everything (e.g. the live drawing canvas in the composer). */
  children?: React.ReactNode;
  className?: string;
}

export const CardPage: React.FC<CardPageProps> = ({ paperId, textLayer, text, fontId, overlaySrc, children, className = '' }) => {
  const paper = getCardPaper(paperId);
  const isDots = paper.pattern === 'dots';

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl shadow-inner border border-black/5 ${className}`}
      style={{
        containerType: 'inline-size',
        aspectRatio: '3 / 4',
        backgroundColor: paper.bg,
        backgroundImage: isDots ? `radial-gradient(${paper.line} 1.2px, transparent 1.2px)` : undefined,
        backgroundSize: isDots ? '4cqw 4cqw' : undefined,
      }}
    >
      {textLayer ?? (
        <div className="absolute inset-[6cqw] overflow-y-auto">
          <div className={`${fontId || 'font-handwriting'} whitespace-pre-wrap break-words`} style={cardTextStyle(paper)}>
            {text}
          </div>
        </div>
      )}
      {overlaySrc && <img src={overlaySrc} alt="Nét vẽ tay trên thiệp" className="absolute inset-0 w-full h-full pointer-events-none select-none" draggable={false} />}
      {children}
    </div>
  );
};
