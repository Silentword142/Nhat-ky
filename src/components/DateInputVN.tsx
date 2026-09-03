import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { formatDateVN, parseDateParts, getZodiacFromDate, toISODateString, ZodiacInfo } from '../utils/date';

interface DateInputVNProps {
  id?: string;
  value?: string;
  onChange: (isoDateValue: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  showZodiac?: boolean;
  showFormatHint?: boolean;
  max?: string;
  min?: string;
}

export const DateInputVN: React.FC<DateInputVNProps> = ({
  id,
  value = '',
  onChange,
  placeholder = 'dd/mm/yyyy',
  label,
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  showZodiac = false,
  showFormatHint = true,
  max,
  min,
}) => {
  // Store display text in DD/MM/YYYY
  const [displayText, setDisplayText] = useState<string>(() => {
    return formatDateVN(value);
  });

  const [zodiac, setZodiac] = useState<ZodiacInfo | null>(() => {
    return showZodiac ? getZodiacFromDate(value) : null;
  });

  const hiddenDateInputRef = useRef<HTMLInputElement>(null);

  // Sync with external value changes
  useEffect(() => {
    const formatted = formatDateVN(value);
    setDisplayText(formatted);
    if (showZodiac) {
      setZodiac(getZodiacFromDate(value));
    }
  }, [value, showZodiac]);

  // Handle typing with auto-masking dd/mm/yyyy
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    // Filter non-digits except slash or dash
    const cleanNumbers = raw.replace(/[^\d]/g, '');

    // Format as DD/MM/YYYY
    let formatted = '';
    if (cleanNumbers.length > 0) {
      const d = cleanNumbers.slice(0, 2);
      formatted = d;
      if (cleanNumbers.length >= 3) {
        const m = cleanNumbers.slice(2, 4);
        formatted += '/' + m;
      }
      if (cleanNumbers.length >= 5) {
        const y = cleanNumbers.slice(4, 8);
        formatted += '/' + y;
      }
    }

    setDisplayText(formatted);

    // If a complete 8 digits DD/MM/YYYY is entered, validate and fire onChange
    if (cleanNumbers.length === 8) {
      const parts = parseDateParts(formatted);
      if (parts) {
        const iso = toISODateString(formatted);
        onChange(iso);
        if (showZodiac) {
          setZodiac(getZodiacFromDate(formatted));
        }
      }
    } else if (cleanNumbers.length === 0) {
      onChange('');
      if (showZodiac) setZodiac(null);
    }
  };

  // On blur, validate text
  const handleBlur = () => {
    if (!displayText) {
      onChange('');
      return;
    }
    const parts = parseDateParts(displayText);
    if (parts) {
      const standardDisplay = `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
      setDisplayText(standardDisplay);
      const iso = toISODateString(standardDisplay);
      onChange(iso);
      if (showZodiac) {
        setZodiac(getZodiacFromDate(standardDisplay));
      }
    } else {
      // If invalid, revert back to previous value
      setDisplayText(formatDateVN(value));
    }
  };

  // Handle Native Calendar Selection
  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedIso = e.target.value; // YYYY-MM-DD
    if (selectedIso) {
      const formatted = formatDateVN(selectedIso);
      setDisplayText(formatted);
      onChange(selectedIso);
      if (showZodiac) {
        setZodiac(getZodiacFromDate(selectedIso));
      }
    }
  };

  const openDatePicker = () => {
    if (hiddenDateInputRef.current) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          hiddenDateInputRef.current.showPicker();
        } else {
          hiddenDateInputRef.current.focus();
        }
      } catch {
        hiddenDateInputRef.current.focus();
      }
    }
  };

  const isoValue = toISODateString(value || displayText);

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 font-cute">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {/* Visible Formatted Input (DD/MM/YYYY) */}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9/]*"
          maxLength={10}
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full pl-3.5 pr-10 py-2 rounded-xl bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-rose-400 font-mono tracking-wide placeholder:text-zinc-400 ${inputClassName}`}
        />

        {/* Calendar Trigger Button */}
        <button
          type="button"
          tabIndex={-1}
          onClick={openDatePicker}
          disabled={disabled}
          className="absolute right-2.5 p-1 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-zinc-700 transition cursor-pointer"
          title="Mở lịch chọn ngày (dd/mm/yyyy)"
        >
          <CalendarIcon className="w-4 h-4 text-rose-500" />
        </button>

        {/* Hidden native date input to back up calendar picker */}
        <input
          ref={hiddenDateInputRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={isoValue}
          max={max}
          min={min}
          onChange={handleNativePickerChange}
          className="sr-only absolute opacity-0 pointer-events-none"
        />
      </div>

      {/* Helper text / Format indicator */}
      <div className="flex flex-wrap items-center justify-between gap-1 mt-1 text-[11px]">
        {showFormatHint && (
          <span className="text-zinc-400 dark:text-zinc-500 font-cute">
            Định dạng: <strong className="text-zinc-600 dark:text-zinc-400 font-mono">ngày/tháng/năm (dd/mm/yyyy)</strong>
          </span>
        )}

        {/* Accurate Zodiac display if enabled */}
        {showZodiac && zodiac && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 font-cute font-bold text-[11px] border border-rose-200/60 dark:border-rose-800/60 animate-fadeIn">
            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
            <span>
              Cung {zodiac.icon} {zodiac.vietnameseName} ({zodiac.englishName})
            </span>
          </span>
        )}
      </div>
    </div>
  );
};
