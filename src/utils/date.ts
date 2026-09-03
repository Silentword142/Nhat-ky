/**
 * Standard date formatting and Zodiac utility for LoveSync
 * All date displays across the application are normalized to DD/MM/YYYY
 */

import { useEffect, useMemo, useState } from 'react';

export interface LoveDuration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const ZERO_DURATION: LoveDuration = { days: 0, hours: 0, minutes: 0, seconds: 0 };

/**
 * Live-ticking "days/hours/minutes/seconds together" counter, self-contained per component.
 * Runs its own 1s timer scoped to whichever component calls it — unlike sourcing this from
 * shared app context, only that component re-renders every second, not the entire app tree.
 */
export function useLoveDuration(startDate?: string | null): LoveDuration {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!startDate || !startDate.trim()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startDate]);

  return useMemo(() => {
    if (!startDate || !startDate.trim()) return ZERO_DURATION;
    const start = new Date(startDate).getTime();
    if (isNaN(start)) return ZERO_DURATION;

    const diff = Math.max(0, now - start);
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  }, [startDate, now]);
}

export interface DateParts {
  day: number;
  month: number;
  year: number;
}

/**
 * Safely parse date parts (day, month, year) from ANY input format without timezone shift bugs.
 * Handles DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO string, Date object, timestamp number.
 */
export function parseDateParts(dateInput?: string | number | Date | null): DateParts | null {
  if (!dateInput && dateInput !== 0) return null;

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;

    // Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10);
      const y = parseInt(dmyMatch[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return { day: d, month: m, year: y };
      }
    }

    // Check YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10);
      const d = parseInt(ymdMatch[3], 10);
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return { day: d, month: m, year: y };
      }
    }
  }

  // If Date object or timestamp number
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;

  return {
    day: d.getDate(),
    month: d.getMonth() + 1,
    year: d.getFullYear(),
  };
}

/**
 * Format any date input to DD/MM/YYYY string
 * Supports: YYYY-MM-DD, DD/MM/YYYY, ISO string, timestamp number, Date object
 */
export function formatDateVN(dateInput?: string | number | Date | null): string {
  const parts = parseDateParts(dateInput);
  if (!parts) {
    if (typeof dateInput === 'string' && dateInput.trim()) return dateInput.trim();
    return '';
  }
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  return `${day}/${month}/${parts.year}`;
}

/**
 * Convert any date input to standard YYYY-MM-DD format (for internal storage/APIs)
 */
export function toISODateString(dateInput?: string | number | Date | null): string {
  const parts = parseDateParts(dateInput);
  if (!parts) return '';
  const day = String(parts.day).padStart(2, '0');
  const month = String(parts.month).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

/**
 * Format date and time to DD/MM/YYYY HH:mm or HH:mm DD/MM/YYYY
 */
export function formatDateTimeVN(dateInput?: string | number | Date | null, timeFirst = false): string {
  if (!dateInput && dateInput !== 0) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return formatDateVN(dateInput);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (timeFirst) {
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  }
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Full Zodiac definitions with proper Vietnamese names and traits
 */
export interface ZodiacInfo {
  name: string; // "Bảo Bình (Aquarius)"
  vietnameseName: string; // "Bảo Bình"
  englishName: string; // "Aquarius"
  icon: string; // "♒"
  traits: string;
}

export function getZodiacSign(day: number, month: number): ZodiacInfo {
  const zodiacList: Array<ZodiacInfo & { check: (d: number, m: number) => boolean }> = [
    {
      name: 'Ma Kết (Capricorn)',
      vietnameseName: 'Ma Kết',
      englishName: 'Capricorn',
      icon: '♑',
      traits: 'Chân thành, kiên trì, chu đáo, đáng tin cậy',
      check: (d, m) => (m === 12 && d >= 22) || (m === 1 && d <= 19),
    },
    {
      name: 'Bảo Bình (Aquarius)',
      vietnameseName: 'Bảo Bình',
      englishName: 'Aquarius',
      icon: '♒',
      traits: 'Sáng tạo, độc đáo, thông minh, thấu hiểu',
      check: (d, m) => (m === 1 && d >= 20) || (m === 2 && d <= 18),
    },
    {
      name: 'Song Ngư (Pisces)',
      vietnameseName: 'Song Ngư',
      englishName: 'Pisces',
      icon: '♓',
      traits: 'Dịu dàng, lãng mạn, giàu cảm xúc, ngọt ngào',
      check: (d, m) => (m === 2 && d >= 19) || (m === 3 && d <= 20),
    },
    {
      name: 'Bạch Dương (Aries)',
      vietnameseName: 'Bạch Dương',
      englishName: 'Aries',
      icon: '♈',
      traits: 'Nhiệt huyết, tự tin, tràn đầy năng lượng tích cực',
      check: (d, m) => (m === 3 && d >= 21) || (m === 4 && d <= 19),
    },
    {
      name: 'Kim Ngưu (Taurus)',
      vietnameseName: 'Kim Ngưu',
      englishName: 'Taurus',
      icon: '♉',
      traits: 'Đáng tin cậy, kiên định, ấm áp, chung thủy',
      check: (d, m) => (m === 4 && d >= 20) || (m === 5 && d <= 20),
    },
    {
      name: 'Song Tử (Gemini)',
      vietnameseName: 'Song Tử',
      englishName: 'Gemini',
      icon: '♊',
      traits: 'Thông minh, linh hoạt, hài hước, duyên dáng',
      check: (d, m) => (m === 5 && d >= 21) || (m === 6 && d <= 21),
    },
    {
      name: 'Cự Giải (Cancer)',
      vietnameseName: 'Cự Giải',
      englishName: 'Cancer',
      icon: '♋',
      traits: 'Tình cảm, ân cần, biết quan tâm, chở che',
      check: (d, m) => (m === 6 && d >= 22) || (m === 7 && d <= 22),
    },
    {
      name: 'Sư Tử (Leo)',
      vietnameseName: 'Sư Tử',
      englishName: 'Leo',
      icon: '♌',
      traits: 'Tự tin, hào phóng, chung tình, bản lĩnh',
      check: (d, m) => (m === 7 && d >= 23) || (m === 8 && d <= 22),
    },
    {
      name: 'Xử Nữ (Virgo)',
      vietnameseName: 'Xử Nữ',
      englishName: 'Virgo',
      icon: '♍',
      traits: 'Tinh tế, cẩn trọng, cầu toàn, biết lắng nghe',
      check: (d, m) => (m === 8 && d >= 23) || (m === 9 && d <= 22),
    },
    {
      name: 'Thiên Bình (Libra)',
      vietnameseName: 'Thiên Bình',
      englishName: 'Libra',
      icon: '♎',
      traits: 'Hài hòa, thanh lịch, lãng mạn, đáng yêu',
      check: (d, m) => (m === 9 && d >= 23) || (m === 10 && d <= 23),
    },
    {
      name: 'Bọ Cạp (Scorpio)',
      vietnameseName: 'Bọ Cạp',
      englishName: 'Scorpio',
      icon: '♏',
      traits: 'Sâu sắc, say đắm, chung thủy tuyệt đối, quyến rũ',
      check: (d, m) => (m === 10 && d >= 24) || (m === 11 && d <= 22),
    },
    {
      name: 'Nhân Mã (Sagittarius)',
      vietnameseName: 'Nhân Mã',
      englishName: 'Sagittarius',
      icon: '♐',
      traits: 'Lạc quan, tự do, vui tươi, chân thành',
      check: (d, m) => (m === 11 && d >= 23) || (m === 12 && d <= 21),
    },
  ];

  const found = zodiacList.find((z) => z.check(day, month));
  return found || zodiacList[0];
}

/**
 * Get Zodiac info directly from any date input string/Date/timestamp
 */
export function getZodiacFromDate(dateInput?: string | number | Date | null): ZodiacInfo | null {
  const parts = parseDateParts(dateInput);
  if (!parts) return null;
  return getZodiacSign(parts.day, parts.month);
}
