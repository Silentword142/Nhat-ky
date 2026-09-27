import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Pencil, Trash2, Clock, StickyNote } from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { CalendarNote, NoteColor } from '../types';
import { soundService } from '../services/sound';
import { formatDateVN } from '../utils/date';
import { DEFAULT_STICKER, NOTE_COLORS, NOTE_COLOR_ORDER, NOTE_STICKERS, stickerLabel } from '../utils/stickers';

interface Draft {
  sticker: string;
  color: NoteColor;
  time: string;
  text: string;
}

const emptyDraft = (): Draft => ({ sticker: DEFAULT_STICKER, color: 'pink', time: '', text: '' });

/** Sticker + paper colour + optional time + the note itself. */
const NoteForm: React.FC<{ initial?: CalendarNote; onSave: (d: Draft) => void; onCancel: () => void }> = ({ initial, onSave, onCancel }) => {
  const [draft, setDraft] = useState<Draft>(
    initial ? { sticker: initial.sticker, color: initial.color || 'pink', time: initial.time || '', text: initial.text } : emptyDraft()
  );
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.text.trim()) return;
        onSave({ ...draft, text: draft.text.trim() });
      }}
      className={`rounded-3xl border-2 p-3.5 space-y-3 ${NOTE_COLORS[draft.color].paper}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-11 h-11 shrink-0 rounded-2xl bg-white/80 dark:bg-zinc-900/60 flex items-center justify-center text-2xl shadow-sm">{draft.sticker}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{initial ? 'Sửa ghi chú' : 'Ghi chú mới'}</p>
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{stickerLabel(draft.sticker)}</p>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mb-1.5">Chọn sticker đánh dấu ngày</p>
        <div className="grid grid-cols-8 gap-1">
          {NOTE_STICKERS.map((s) => {
            const on = s.emoji === draft.sticker;
            return (
              <button
                key={s.emoji}
                type="button"
                title={s.label}
                onClick={() => {
                  soundService.playPop();
                  set({ sticker: s.emoji });
                }}
                className={`aspect-square rounded-xl text-lg flex items-center justify-center transition ${
                  on ? 'bg-white dark:bg-zinc-800 shadow-md scale-110 ring-2 ring-rose-400' : 'hover:bg-white/70 dark:hover:bg-zinc-800/70 hover:scale-110'
                }`}
              >
                {s.emoji}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Màu giấy">
          {NOTE_COLOR_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              title={NOTE_COLORS[c].label}
              aria-checked={draft.color === c}
              role="radio"
              onClick={() => set({ color: c })}
              className={`w-6 h-6 rounded-full ${NOTE_COLORS[c].dot} border-2 transition ${draft.color === c ? 'border-zinc-700 dark:border-white scale-110' : 'border-white dark:border-zinc-700'}`}
            />
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
          <Clock className="w-3.5 h-3.5" />
          <input
            type="time"
            value={draft.time}
            onChange={(e) => set({ time: e.target.value })}
            className="px-2 py-1 rounded-lg bg-white/80 dark:bg-zinc-900/60 border-0 text-xs font-bold text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-rose-400"
          />
        </label>
      </div>

      <textarea
        autoFocus
        rows={3}
        value={draft.text}
        onChange={(e) => set({ text: e.target.value })}
        placeholder="Viết gì đó cho ngày này... (hẹn đi ăn, sinh nhật, nhắc uống thuốc 💊)"
        className="w-full px-3 py-2.5 rounded-2xl bg-white/85 dark:bg-zinc-900/60 border-0 text-sm text-zinc-800 dark:text-zinc-100 font-cute focus:ring-2 focus:ring-rose-400 placeholder:text-zinc-400 resize-none"
      />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl bg-white/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-xs">
          Hủy
        </button>
        <button type="submit" disabled={!draft.text.trim()} className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-xs shadow-md disabled:opacity-40">
          {initial ? 'Lưu' : 'Dán ghi chú 📌'}
        </button>
      </div>
    </form>
  );
};

/**
 * The notes of one calendar day, shown when that day is tapped (render it keyed by the date, so a
 * different day always opens clean). Each note is a small sticky note
 * in its own paper colour; its sticker is also what marks the day on the calendar.
 */
export const CalendarNotes: React.FC<{ date: string }> = ({ date }) => {
  const { calendarNotes = [], addCalendarNote, updateCalendarNote, deleteCalendarNote } = useCouple();
  const [mode, setMode] = useState<{ kind: 'add' } | { kind: 'edit'; id: string } | null>(null);

  const notes = useMemo(
    () => calendarNotes.filter((n) => n.date === date).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.createdAt - b.createdAt),
    [calendarNotes, date]
  );

  const save = (d: Draft) => {
    soundService.playSparkle();
    const fields = { sticker: d.sticker, color: d.color, time: d.time || undefined, text: d.text };
    if (mode?.kind === 'edit') updateCalendarNote(mode.id, fields);
    else addCalendarNote({ ...fields, date });
    setMode(null);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="pt-3 border-t border-rose-100 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 font-cute">
          <StickyNote className="w-4 h-4 text-amber-500" /> Ghi chú ngày {formatDateVN(date)}
          {notes.length > 0 && <span className="px-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px]">{notes.length}</span>}
        </h4>
        {mode === null && (
          <button
            onClick={() => {
              soundService.playPop();
              setMode({ kind: 'add' });
            }}
            className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1 transition"
          >
            <Plus className="w-3 h-3 stroke-[3px]" /> Thêm
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {notes.map((n, i) =>
            mode?.kind === 'edit' && mode.id === n.id ? (
              <NoteForm key={n.id} initial={n} onSave={save} onCancel={() => setMode(null)} />
            ) : (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: i % 2 === 0 ? -0.8 : 0.8 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`group relative rounded-2xl border p-3 pl-12 shadow-sm ${NOTE_COLORS[n.color || 'pink'].paper}`}
              >
                {/* the sticker, peeking over the note's edge like a real one */}
                <span className="absolute -top-2 -left-1.5 w-11 h-11 rounded-2xl bg-white dark:bg-zinc-900 shadow-md flex items-center justify-center text-2xl rotate-[-8deg]" title={stickerLabel(n.sticker)}>
                  {n.sticker}
                </span>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {n.time && (
                      <p className="text-[11px] font-extrabold text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {n.time}
                      </p>
                    )}
                    <p className="text-sm text-zinc-800 dark:text-zinc-100 font-cute whitespace-pre-wrap break-words">{n.text}</p>
                    <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 mt-1">✍️ {n.authorName}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                    <button onClick={() => setMode({ kind: 'edit', id: n.id })} className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-500 hover:bg-white/70 dark:hover:bg-zinc-800" title="Sửa">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Gỡ ghi chú này khỏi lịch?')) deleteCalendarNote(n.id);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-white/70 dark:hover:bg-zinc-800"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>

        {mode?.kind === 'add' && <NoteForm onSave={save} onCancel={() => setMode(null)} />}

        {notes.length === 0 && mode === null && (
          <button
            onClick={() => {
              soundService.playPop();
              setMode({ kind: 'add' });
            }}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-900/50 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-amber-50/60 dark:hover:bg-amber-950/20 transition font-cute"
          >
            🧸 Chưa có ghi chú — chạm để dán một sticker lên ngày này
          </button>
        )}
      </div>
    </motion.div>
  );
};

/** The sticker a calendar cell shows: the day's first note (by time), with how many more there are. */
export const noteMarkersByDate = (notes: CalendarNote[]) => {
  const map = new Map<string, { sticker: string; count: number; preview: string }>();
  notes
    .slice()
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.createdAt - b.createdAt)
    .forEach((n) => {
      const cur = map.get(n.date);
      if (cur) map.set(n.date, { ...cur, count: cur.count + 1, preview: `${cur.preview}\n${n.sticker} ${n.text}` });
      else map.set(n.date, { sticker: n.sticker, count: 1, preview: `${n.sticker} ${n.text}` });
    });
  return map;
};
