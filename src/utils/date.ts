/**
 * Standard date formatting utility for LoveSync
 * All date displays across the application are normalized to DD/MM/YYYY
 */

/**
 * Format any date input to DD/MM/YYYY string
 * Supports: YYYY-MM-DD, ISO string, timestamp number, Date object
 */
export function formatDateVN(dateInput?: string | number | Date | null): string {
  if (!dateInput && dateInput !== 0) return '';

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    // If already in DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    // If in YYYY-MM-DD or YYYY-MM-DDTHH... format
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymdMatch) {
      const [, y, m, d] = ymdMatch;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return String(dateInput);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format date and time to DD/MM/YYYY HH:mm or HH:mm DD/MM/YYYY
 */
export function formatDateTimeVN(dateInput?: string | number | Date | null, timeFirst = false): string {
  if (!dateInput && dateInput !== 0) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

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
  const zodiacMap: Array<ZodiacInfo & { check: (d: number, m: number) => boolean }> = [
    {
      name: 'Ma Kết (Capricorn)',
      vietnameseName: 'Ma Kết',
      englishName: 'Capricorn',
      icon: '♑',
      traits: 'Chân thành, kiên trì, ấm áp',
      check: (d, m) => (m === 12 && d >= 22) || (m === 1 && d <= 19),
    },
    {
      name: 'Bảo Bình (Aquarius)',
      vietnameseName: 'Bảo Bình',
      englishName: 'Aquarius',
      icon: '♒',
      traits: 'Sáng tạo, độc đáo, thấu hiểu',
      check: (d, m) => (m === 1 && d >= 20) || (m === 2 && d <= 18),
    },
    {
      name: 'Song Ngư (Pisces)',
      vietnameseName: 'Song Ngư',
      englishName: 'Pisces',
      icon: '♓',
      traits: 'Dịu dàng, lãng mạn, chu đáo',
      check: (d, m) => (m === 2 && d >= 19) || (m === 3 && d <= 20),
    },
    {
      name: 'Bạch Dương (Aries)',
      vietnameseName: 'Bạch Dương',
      englishName: 'Aries',
      icon: '♈',
      traits: 'Nhiệt tình, tràn đầy năng lượng',
      check: (d, m) => (m === 3 && d >= 21) || (m === 4 && d <= 19),
    },
    {
      name: 'Kim Ngưu (Taurus)',
      vietnameseName: 'Kim Ngưu',
      englishName: 'Taurus',
      icon: '♉',
      traits: 'Đáng tin cậy, ngọt ngào, bền bỉ',
      check: (d, m) => (m === 4 && d >= 20) || (m === 5 && d <= 20),
    },
    {
      name: 'Song Tử (Gemini)',
      vietnameseName: 'Song Tử',
      englishName: 'Gemini',
      icon: '♊',
      traits: 'Thông minh, vui vẻ, duyên dáng',
      check: (d, m) => (m === 5 && d >= 21) || (m === 6 && d <= 21),
    },
    {
      name: 'Cự Giải (Cancer)',
      vietnameseName: 'Cự Giải',
      englishName: 'Cancer',
      icon: '♋',
      traits: 'Tình cảm, chu đáo, yêu thương',
      check: (d, m) => (m === 6 && d >= 22) || (m === 7 && d <= 22),
    },
    {
      name: 'Sư Tử (Leo)',
      vietnameseName: 'Sư Tử',
      englishName: 'Leo',
      icon: '♌',
      traits: 'Tự tin, hào phóng, chung thủy',
      check: (d, m) => (m === 7 && d >= 23) || (m === 8 && d <= 22),
    },
    {
      name: 'Xử Nữ (Virgo)',
      vietnameseName: 'Xử Nữ',
      englishName: 'Virgo',
      icon: '♍',
      traits: 'Tinh tế, cẩn thận, ngọt ngào',
      check: (d, m) => (m === 8 && d >= 23) || (m === 9 && d <= 22),
    },
    {
      name: 'Thiên Bình (Libra)',
      vietnameseName: 'Thiên Bình',
      englishName: 'Libra',
      icon: '♎',
      traits: 'Hài hòa, lịch thiệp, đáng yêu',
      check: (d, m) => (m === 9 && d >= 23) || (m === 10 && d <= 23),
    },
    {
      name: 'Bọ Cạp (Scorpio)',
      vietnameseName: 'Bọ Cạp',
      englishName: 'Scorpio',
      icon: '♏',
      traits: 'Say đắm, quyến rũ, sâu sắc',
      check: (d, m) => (m === 10 && d >= 24) || (m === 11 && d <= 21),
    },
    {
      name: 'Nhân Mã (Sagittarius)',
      vietnameseName: 'Nhân Mã',
      englishName: 'Sagittarius',
      icon: '♐',
      traits: 'Lạc quan, tự do, vui tươi',
      check: (d, m) => (m === 11 && d >= 22) || (m === 12 && d <= 21),
    },
  ];

  return zodiacMap.find((z) => z.check(day, month)) || zodiacMap[0];
}
