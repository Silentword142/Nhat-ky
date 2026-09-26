import React, { useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Eraser,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Circle,
  Heading as HeadingIcon,
  Type,
  ListChecks,
  Table2,
  Scale,
  Sigma,
  MapPin,
  Trophy,
} from 'lucide-react';
import { PlanBlock, PlanOption } from '../types';
import { colName, displayValue, evaluateSheet, isErrorValue, parseNumber } from '../utils/sheet';
import { soundService } from '../services/sound';
import { PlaceActions, PlacePickButton } from './PlaceTools';
import { safeUrl } from '../utils/maps';
import { formatVND, groupThousands } from '../utils/money';

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

const fieldCls =
  'w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border-0 text-sm text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400 placeholder:text-zinc-400';

/* ---------- helpers ---------- */

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P']);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);

/** Content comes from the partner's device too, so only a tiny tag whitelist survives (no attributes at all). */
export const sanitizeHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const clean = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        if (DROP_WITH_CONTENT.has(el.tagName)) {
          el.remove();
          return;
        }
        clean(el);
        if (!ALLOWED_TAGS.has(el.tagName)) {
          el.replaceWith(...Array.from(el.childNodes));
        } else {
          Array.from(el.attributes).forEach((a) => el.removeAttribute(a.name));
        }
      } else if (child.nodeType !== Node.TEXT_NODE) {
        child.remove();
      }
    });
  };
  clean(doc.body);
  return doc.body.innerHTML;
};

export const escapeToHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/** Input that keeps its own draft and only commits on blur / Enter (avoids syncing every keystroke). */
const CommitInput: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onCommit: (v: string) => void }
> = ({ value, onCommit, className, ...rest }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      {...rest}
      value={draft}
      className={className}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
};

/* ---------- rich text ---------- */

const RichTextBlock: React.FC<{ html: string; onCommit: (html: string) => void }> = ({ html, onCommit }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const safe = sanitizeHtml(html);
    if (el.innerHTML !== safe) el.innerHTML = safe;
  }, [html]);

  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
  };

  const tools = [
    { cmd: 'bold', icon: <Bold className="w-3.5 h-3.5" />, title: 'In đậm' },
    { cmd: 'italic', icon: <Italic className="w-3.5 h-3.5" />, title: 'In nghiêng' },
    { cmd: 'underline', icon: <Underline className="w-3.5 h-3.5" />, title: 'Gạch chân' },
    { cmd: 'strikeThrough', icon: <Strikethrough className="w-3.5 h-3.5" />, title: 'Gạch ngang' },
    { cmd: 'insertUnorderedList', icon: <List className="w-3.5 h-3.5" />, title: 'Danh sách chấm' },
    { cmd: 'insertOrderedList', icon: <ListOrdered className="w-3.5 h-3.5" />, title: 'Danh sách số' },
    { cmd: 'removeFormat', icon: <Eraser className="w-3.5 h-3.5" />, title: 'Xóa định dạng' },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tools.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            // mousedown + preventDefault keeps the text selection while clicking the toolbar
            onMouseDown={(e) => {
              e.preventDefault();
              exec(t.cmd);
            }}
            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-rose-100 dark:hover:bg-rose-950 hover:text-rose-600 transition"
          >
            {t.icon}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={() => {
          const next = sanitizeHtml(ref.current?.innerHTML || '');
          if (next !== sanitizeHtml(html)) onCommit(next);
        }}
        data-placeholder="Viết nội dung chi tiết ở đây: lịch trình, quán muốn thử, lưu ý..."
        className="min-h-[96px] px-3.5 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-sm leading-relaxed text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-400 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400"
      />
    </div>
  );
};

/* ---------- checklist ---------- */

const ChecklistBlock: React.FC<{
  block: Extract<PlanBlock, { type: 'checklist' }>;
  onChange: (b: PlanBlock) => void;
}> = ({ block, onChange }) => {
  const [text, setText] = useState('');
  const done = block.items.filter((i) => i.done).length;
  const pct = block.items.length ? Math.round((done / block.items.length) * 100) : 0;

  const add = () => {
    if (!text.trim()) return;
    onChange({ ...block, items: [...block.items, { id: newId('it'), text: text.trim(), done: false }] });
    setText('');
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-3">
        <CommitInput
          value={block.title}
          onCommit={(title) => onChange({ ...block, title })}
          placeholder="Tên danh sách (ví dụ: Đồ cần mang)"
          className="flex-1 bg-transparent border-0 p-0 text-sm font-bold text-zinc-800 dark:text-zinc-100 focus:ring-0 placeholder:font-normal placeholder:text-zinc-400"
        />
        <span className="text-[11px] font-bold text-zinc-400 whitespace-nowrap">
          {done}/{block.items.length}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-1.5">
        {block.items.map((it) => (
          <li key={it.id} className="flex items-center gap-2.5 group">
            <button
              type="button"
              onClick={() => onChange({ ...block, items: block.items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)) })}
              aria-label="Đánh dấu"
            >
              {it.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5 text-rose-300" />}
            </button>
            <CommitInput
              value={it.text}
              onCommit={(t) => onChange({ ...block, items: block.items.map((x) => (x.id === it.id ? { ...x, text: t } : x)) })}
              className={`flex-1 bg-transparent border-0 p-0 text-sm focus:ring-0 ${it.done ? 'line-through opacity-50' : 'text-zinc-800 dark:text-zinc-100'}`}
            />
            <button
              type="button"
              onClick={() => onChange({ ...block, items: block.items.filter((x) => x.id !== it.id) })}
              className="p-1 text-zinc-300 hover:text-red-500 sm:opacity-0 group-hover:opacity-100 transition"
              aria-label="Xóa mục"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Thêm ô tick mới rồi nhấn Enter..."
          className={fieldCls}
        />
        <button type="button" onClick={add} disabled={!text.trim()} className="px-3 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white transition" aria-label="Thêm">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ---------- table with formulas ---------- */

const TableBlock: React.FC<{
  block: Extract<PlanBlock, { type: 'table' }>;
  onChange: (b: PlanBlock) => void;
}> = ({ block, onChange }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<string[][]>(block.rows);
  const [focus, setFocus] = useState<{ r: number; c: number } | null>(null);
  const dirtyRef = useRef(false);

  // Take remote/committed updates only while the user isn't mid-edit.
  useEffect(() => {
    if (!dirtyRef.current) setRows(block.rows);
  }, [block.rows]);

  const values = evaluateSheet(rows);
  const cols = rows[0]?.length || 0;

  const commit = (next: string[][]) => {
    dirtyRef.current = false;
    onChange({ ...block, rows: next });
  };
  const structural = (next: string[][]) => {
    setRows(next);
    commit(next);
  };

  const setCell = (r: number, c: number, v: string) => {
    dirtyRef.current = true;
    setRows((prev) => prev.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)));
  };

  const addRow = () => structural([...rows, Array(cols).fill('')]);
  const addCol = () => structural(rows.map((row, i) => [...row, i === 0 ? `Cột ${colName(cols)}` : '']));
  const removeRow = (r: number) => rows.length > 2 && structural(rows.filter((_, i) => i !== r));
  const removeCol = (c: number) => cols > 1 && structural(rows.map((row) => row.filter((_, i) => i !== c)));

  const addTotalRow = () => {
    const last = rows.length; // 1-based row number of the first row we're about to add is last+1
    const total = rows[0].map((_, c) => {
      if (c === 0) return 'Tổng';
      const numeric = rows.slice(1).some((row, i) => {
        const v = values[i + 1]?.[c];
        return typeof v === 'number' && row[c].trim() !== '';
      });
      return numeric ? `=SUM(${colName(c)}2:${colName(c)}${last})` : '';
    });
    structural([...rows, total]);
  };

  const moveFocus = (r: number, c: number) => {
    const el = wrapRef.current?.querySelector<HTMLInputElement>(`[data-cell="${r}-${c}"]`);
    el?.focus();
    el?.select();
  };

  return (
    <div className="space-y-2.5">
      <CommitInput
        value={block.title}
        onCommit={(title) => onChange({ ...block, title })}
        placeholder="Tên bảng (ví dụ: Bảng chi phí)"
        className="w-full bg-transparent border-0 p-0 text-sm font-bold text-zinc-800 dark:text-zinc-100 focus:ring-0 placeholder:font-normal placeholder:text-zinc-400"
      />

      <div ref={wrapRef} className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-400">
              <th className="w-8 border-r border-zinc-200 dark:border-zinc-700" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="group relative border-r border-zinc-200 dark:border-zinc-700 py-1 font-bold">
                  {colName(c)}
                  {cols > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCol(c)}
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-300 hover:text-red-500 sm:opacity-0 group-hover:opacity-100"
                      aria-label={`Xóa cột ${colName(c)}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className={`group ${r === 0 ? 'bg-rose-50 dark:bg-rose-950/30 font-bold' : ''}`}>
                <td className="relative border-r border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-center text-[10px] text-zinc-400 select-none">
                  <span className="group-hover:hidden">{r + 1}</span>
                  {r > 0 && rows.length > 2 && (
                    <button type="button" onClick={() => removeRow(r)} className="hidden group-hover:inline text-zinc-400 hover:text-red-500" aria-label={`Xóa dòng ${r + 1}`}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </td>
                {row.map((cell, c) => {
                  const isFocused = focus?.r === r && focus?.c === c;
                  const isFormula = cell.trim().startsWith('=');
                  const val = values[r]?.[c];
                  const err = isFormula && isErrorValue(val);
                  const shown = isFocused ? cell : isFormula ? displayValue(val ?? '') : cell;
                  const numeric = !isFocused && (typeof val === 'number' || (r > 0 && parseNumber(cell) !== null));
                  return (
                    <td key={c} className="border-r border-t border-zinc-200 dark:border-zinc-700 p-0 min-w-[92px]">
                      <input
                        data-cell={`${r}-${c}`}
                        value={shown}
                        onFocus={() => setFocus({ r, c })}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        onBlur={() => {
                          setFocus(null);
                          if (dirtyRef.current) commit(rows);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                            if (r + 1 < rows.length) setTimeout(() => moveFocus(r + 1, c), 0);
                          }
                        }}
                        title={isFormula ? cell : undefined}
                        className={`w-full px-2.5 py-2 bg-transparent border-0 focus:ring-2 focus:ring-inset focus:ring-rose-400 focus:bg-white dark:focus:bg-zinc-900 ${
                          numeric ? 'text-right tabular-nums' : ''
                        } ${err ? 'text-red-500 font-bold' : isFormula && !isFocused ? 'text-indigo-600 dark:text-indigo-300 font-semibold' : 'text-zinc-800 dark:text-zinc-100'}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={addRow} className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-rose-100 dark:hover:bg-rose-950 transition flex items-center gap-1">
          <Plus className="w-3 h-3" /> Dòng
        </button>
        <button type="button" onClick={addCol} className="px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-rose-100 dark:hover:bg-rose-950 transition flex items-center gap-1">
          <Plus className="w-3 h-3" /> Cột
        </button>
        <button type="button" onClick={addTotalRow} className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 transition flex items-center gap-1">
          <Sigma className="w-3 h-3" /> Thêm dòng Tổng
        </button>
        <span className="text-[11px] text-zinc-400 ml-auto">
          Gõ <code className="px-1 rounded bg-zinc-100 dark:bg-zinc-800">=SUM(B2:B5)</code>, <code className="px-1 rounded bg-zinc-100 dark:bg-zinc-800">=B2*C2</code>, AVERAGE, MIN, MAX, IF...
        </span>
      </div>
    </div>
  );
};

/* ---------- options comparison ---------- */

const OptionsBlock: React.FC<{
  block: Extract<PlanBlock, { type: 'options' }>;
  onChange: (b: PlanBlock) => void;
}> = ({ block, onChange }) => {
  const prices = block.options.map((o) => o.price).filter((p): p is number => typeof p === 'number' && p > 0);
  const cheapest = prices.length > 1 ? Math.min(...prices) : null;
  const chosen = block.options.find((o) => o.id === block.chosenId);

  const patch = (id: string, updates: Partial<PlanOption>) =>
    onChange({ ...block, options: block.options.map((o) => (o.id === id ? { ...o, ...updates } : o)) });

  return (
    <div className="space-y-3">
      <CommitInput
        value={block.title}
        onCommit={(title) => onChange({ ...block, title })}
        placeholder="Đang cân nhắc điều gì? (ví dụ: Chọn khách sạn)"
        className="w-full bg-transparent border-0 p-0 text-sm font-bold text-zinc-800 dark:text-zinc-100 focus:ring-0 placeholder:font-normal placeholder:text-zinc-400"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {block.options.map((o) => {
          const isChosen = block.chosenId === o.id;
          return (
            <div
              key={o.id}
              className={`relative p-3 rounded-2xl border-2 transition space-y-1.5 ${
                isChosen ? 'border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/20' : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <CommitInput
                  value={o.name}
                  onCommit={(name) => patch(o.id, { name })}
                  placeholder="Tên phương án"
                  className="flex-1 min-w-0 bg-transparent border-0 p-0 text-sm font-bold text-zinc-800 dark:text-zinc-100 focus:ring-0"
                />
                {cheapest !== null && o.price === cheapest && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 whitespace-nowrap flex items-center gap-0.5">
                    <Trophy className="w-3 h-3" /> Rẻ nhất
                  </span>
                )}
                <button type="button" onClick={() => onChange({ ...block, options: block.options.filter((x) => x.id !== o.id), chosenId: isChosen ? undefined : block.chosenId })} className="text-zinc-300 hover:text-red-500" aria-label="Xóa phương án">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <MapPin className="w-3 h-3 shrink-0" />
                <CommitInput value={o.place || ''} onCommit={(place) => patch(o.id, { place })} placeholder="Địa điểm" className="flex-1 min-w-0 bg-transparent border-0 p-0 text-xs focus:ring-0" />
              </div>
              <PlacePickButton
                lat={o.lat}
                lng={o.lng}
                query={o.place || o.name}
                className="w-full !py-1.5"
                onPick={(p) => patch(o.id, { lat: p.lat, lng: p.lng, place: o.place || (p.address ? p.address.split(',').slice(0, 2).join(',').trim() : undefined) })}
              />
              <CommitInput
                value={o.reviewUrl || ''}
                inputMode="url"
                onCommit={(v) => patch(o.id, { reviewUrl: v.trim() ? safeUrl(v) || undefined : undefined })}
                placeholder="Link review quán"
                className={`${fieldCls} !py-1.5 text-xs`}
              />
              <PlaceActions place={{ name: o.place, lat: o.lat, lng: o.lng, reviewUrl: o.reviewUrl }} />
              <CommitInput
                value={o.price ? groupThousands(o.price) : ''}
                inputMode="numeric"
                onCommit={(v) => patch(o.id, { price: parseNumber(v) ?? undefined })}
                placeholder="Giá (VNĐ)"
                className={`${fieldCls} !py-1.5 text-xs`}
              />
              {o.price ? <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{formatVND(o.price)}</p> : null}
              <CommitInput value={o.note || ''} onCommit={(note) => patch(o.id, { note })} placeholder="Ưu / nhược điểm..." className={`${fieldCls} !py-1.5 text-xs`} />
              <button
                type="button"
                onClick={() => {
                  soundService.playPop();
                  onChange({ ...block, chosenId: isChosen ? undefined : o.id });
                }}
                className={`w-full py-1.5 rounded-xl text-xs font-bold transition ${
                  isChosen ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-400'
                }`}
              >
                {isChosen ? '✓ Đã chọn phương án này' : 'Chọn phương án này'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...block, options: [...block.options, { id: newId('opt'), name: '' }] })}
          className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-rose-100 dark:hover:bg-rose-950 transition flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Thêm phương án
        </button>
        {chosen && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 text-right">
            Chốt: {chosen.name || 'Chưa đặt tên'}
            {chosen.price ? ` · ${formatVND(chosen.price)}` : ''}
          </span>
        )}
      </div>
    </div>
  );
};

/* ---------- editor ---------- */

const BLOCK_META: Record<PlanBlock['type'], { label: string; icon: React.ReactNode }> = {
  heading: { label: 'Tiêu đề', icon: <HeadingIcon className="w-3.5 h-3.5" /> },
  text: { label: 'Văn bản', icon: <Type className="w-3.5 h-3.5" /> },
  checklist: { label: 'Ô tick', icon: <ListChecks className="w-3.5 h-3.5" /> },
  table: { label: 'Bảng tính', icon: <Table2 className="w-3.5 h-3.5" /> },
  options: { label: 'Lựa chọn', icon: <Scale className="w-3.5 h-3.5" /> },
};

const makeBlock = (kind: string): PlanBlock => {
  const id = newId('blk');
  switch (kind) {
    case 'heading':
      return { id, type: 'heading', text: '' };
    case 'text':
      return { id, type: 'text', html: '' };
    case 'checklist':
      return { id, type: 'checklist', title: 'Danh sách việc cần làm', items: [{ id: newId('it'), text: '', done: false }] };
    case 'options':
      return {
        id,
        type: 'options',
        title: 'Đang cân nhắc...',
        options: [
          { id: newId('opt'), name: 'Phương án 1' },
          { id: newId('opt'), name: 'Phương án 2' },
        ],
      };
    case 'expense':
      return {
        id,
        type: 'table',
        title: 'Bảng chi phí',
        rows: [
          ['Khoản chi', 'Số lượng', 'Đơn giá', 'Thành tiền'],
          ['Vé di chuyển', '2', '500000', '=B2*C2'],
          ['Khách sạn', '2', '800000', '=B3*C3'],
          ['Ăn uống', '3', '300000', '=B4*C4'],
          ['Tổng', '', '', '=SUM(D2:D4)'],
        ],
      };
    default:
      return {
        id,
        type: 'table',
        title: 'Bảng mới',
        rows: [
          ['Cột A', 'Cột B', 'Cột C'],
          ['', '', ''],
          ['', '', ''],
        ],
      };
  }
};

const ADD_MENU: { kind: string; label: string; icon: React.ReactNode }[] = [
  { kind: 'heading', label: 'Tiêu đề', icon: <HeadingIcon className="w-4 h-4" /> },
  { kind: 'text', label: 'Văn bản', icon: <Type className="w-4 h-4" /> },
  { kind: 'checklist', label: 'Ô tick', icon: <ListChecks className="w-4 h-4" /> },
  { kind: 'table', label: 'Bảng trống', icon: <Table2 className="w-4 h-4" /> },
  { kind: 'expense', label: 'Bảng chi phí (có công thức)', icon: <Sigma className="w-4 h-4" /> },
  { kind: 'options', label: 'So sánh lựa chọn', icon: <Scale className="w-4 h-4" /> },
];

export const PlanBlocksEditor: React.FC<{ blocks: PlanBlock[]; onChange: (blocks: PlanBlock[]) => void }> = ({ blocks, onChange }) => {
  const replace = (b: PlanBlock) => onChange(blocks.map((x) => (x.id === b.id ? b : x)));
  const remove = (id: string) => {
    if (window.confirm('Xóa khối này?')) onChange(blocks.filter((b) => b.id !== id));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (kind: string) => {
    soundService.playPop();
    onChange([...blocks, makeBlock(kind)]);
  };

  return (
    <div className="space-y-4">
      {blocks.length === 0 && (
        <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-rose-200 dark:border-zinc-700">
          <p className="text-3xl mb-1">📝</p>
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Chưa có nội dung chi tiết</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Thêm văn bản, ô tick, bảng tính hay so sánh lựa chọn ở dưới nhé.</p>
        </div>
      )}

      {blocks.map((b, i) => (
        <div key={b.id} className="group/block relative p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-rose-400">
              {BLOCK_META[b.type].icon} {BLOCK_META[b.type].label}
            </span>
            <div className="flex items-center gap-0.5 text-zinc-300">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1 hover:text-zinc-600 disabled:opacity-30" aria-label="Chuyển lên">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="p-1 hover:text-zinc-600 disabled:opacity-30" aria-label="Chuyển xuống">
                <ChevronDown className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => remove(b.id)} className="p-1 hover:text-red-500" aria-label="Xóa khối">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {b.type === 'heading' && (
            <CommitInput
              value={b.text}
              onCommit={(text) => replace({ ...b, text })}
              placeholder="Tiêu đề phần (ví dụ: Ngày 1 — Khám phá thành phố)"
              className="w-full bg-transparent border-0 p-0 font-serif italic text-xl text-zinc-800 dark:text-zinc-100 focus:ring-0 placeholder:text-zinc-300"
            />
          )}
          {b.type === 'text' && <RichTextBlock html={b.html} onCommit={(html) => replace({ ...b, html })} />}
          {b.type === 'checklist' && <ChecklistBlock block={b} onChange={replace} />}
          {b.type === 'table' && <TableBlock block={b} onChange={replace} />}
          {b.type === 'options' && <OptionsBlock block={b} onChange={replace} />}
        </div>
      ))}

      <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-zinc-800/50 border border-rose-100 dark:border-zinc-800">
        <p className="text-xs font-bold text-rose-600 dark:text-rose-300 mb-2">➕ Thêm khối nội dung</p>
        <div className="flex flex-wrap gap-1.5">
          {ADD_MENU.map((m) => (
            <button
              key={m.kind}
              type="button"
              onClick={() => add(m.kind)}
              className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:border-rose-400 hover:text-rose-600 transition flex items-center gap-1.5"
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
