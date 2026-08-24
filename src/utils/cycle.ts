import { DailyCycleLog, CycleSettings } from '../types';

export interface CycleSymptom {
  id: string;
  name: string;
  emoji: string;
  category: 'pain' | 'body' | 'mood' | 'discharge';
}

export const CYCLE_SYMPTOMS: CycleSymptom[] = [
  // Pain & Physical
  { id: 'cramps', name: 'Đau bụng dưới', emoji: '😣', category: 'pain' },
  { id: 'backache', name: 'Đau mỏi lưng', emoji: '🛋️', category: 'pain' },
  { id: 'headache', name: 'Đau đầu', emoji: '🤕', category: 'pain' },
  { id: 'tender_breasts', name: 'Căng tức ngực', emoji: '🍈', category: 'body' },
  { id: 'bloating', name: 'Đầy hơi / chướng bụng', emoji: '🎈', category: 'body' },
  { id: 'fatigue', name: 'Mệt mỏi uể oải', emoji: '🥱', category: 'body' },
  { id: 'acne', name: 'Nổi mụn / da dầu', emoji: '🫧', category: 'body' },
  { id: 'cravings', name: 'Thèm đồ ngọt / ăn vặt', emoji: '🍫', category: 'body' },
  { id: 'nausea', name: 'Buồn nôn', emoji: '🤢', category: 'body' },
  { id: 'hot_flashes', name: 'Nóng trong / bốc hỏa', emoji: '🌡️', category: 'body' },

  // Moods
  { id: 'happy', name: 'Vui tươi yêu đời', emoji: '🥰', category: 'mood' },
  { id: 'calm', name: 'Bình yên thư giãn', emoji: '🌸', category: 'mood' },
  { id: 'sensitive', name: 'Dễ xúc động / nhạy cảm', emoji: '🥺', category: 'mood' },
  { id: 'irritable', name: 'Dễ cáu gắt / bực bội', emoji: '😤', category: 'mood' },
  { id: 'sad', name: 'Buồn vu vơ / tủi thân', emoji: '🌧️', category: 'mood' },
  { id: 'tired_sleepy', name: 'Buồn ngủ thèm ôm', emoji: '😴', category: 'mood' },
  { id: 'energetic', name: 'Tràn đầy năng lượng', emoji: '⚡', category: 'mood' },
  { id: 'romantic', name: 'Ngọt ngào lãng mạn', emoji: '💖', category: 'mood' },
];

export const FLOW_LEVELS = [
  { id: 'none', label: 'Không có', emoji: '⚪', desc: 'Sạch sẽ' },
  { id: 'spotting', label: 'Đốm nhỏ', emoji: '🌸', desc: 'Vài giọt nhẹ' },
  { id: 'light', label: 'Lượng ít', emoji: '🩸', desc: 'Ít / ngày đầu & cuối' },
  { id: 'medium', label: 'Lượng vừa', emoji: '🩸🩸', desc: 'Bình thường' },
  { id: 'heavy', label: 'Lượng nhiều', emoji: '🩸🩸🩸', desc: 'Ngày cao điểm' },
] as const;

export const CERVICAL_MUCUS = [
  { id: 'dry', label: 'Khô ráo', emoji: '🌵' },
  { id: 'sticky', label: 'Dính', emoji: '🍯' },
  { id: 'creamy', label: 'Đục / trắng sữa', emoji: '🥛' },
  { id: 'egg_white', label: 'Trong / lòng trắng trứng (Thụ thai cao)', emoji: '🥚' },
] as const;

export type CyclePhase = 'menstrual' | 'follicular' | 'fertile' | 'ovulation' | 'luteal';

export interface DayCycleInfo {
  dateStr: string;
  isPeriod: boolean;
  isPredictedPeriod: boolean;
  isFertile: boolean;
  isOvulation: boolean;
  cycleDay: number;
  totalCycleDays: number;
  phase: CyclePhase;
  phaseName: string;
  phaseEmoji: string;
  phaseDesc: string;
  pregnancyChance: 'Rất thấp' | 'Thấp' | 'Trung bình' | 'Cao' | 'Rất cao (Đỉnh điểm)';
  chanceColor: string;
  daysUntilNextPeriod: number;
  daysLate: number;
  nextPeriodStartDate: string;
  healthInsight: string;
  partnerCareTip: string;
  partnerCareAction: string;
}

// Date helpers
const parseDate = (dStr: string) => {
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const diffDays = (d1: Date, d2: Date) => {
  const t1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const t2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
};

const addDays = (d: Date, days: number) => {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
};

/**
 * Get all known period start dates from logs and settings, sorted chronologically
 */
export const getPeriodStartDates = (
  cycleSettings: CycleSettings = { cycleLength: 28, periodDuration: 5, enabled: true },
  cycleLogs: Record<string, DailyCycleLog> = {}
): string[] => {
  const loggedStarts = new Set<string>();

  if (cycleSettings.lastPeriodStartDate) {
    loggedStarts.add(cycleSettings.lastPeriodStartDate);
  }

  // Find logged period days where previous day was not a period day
  const sortedLoggedDates = Object.keys(cycleLogs).sort();
  for (let i = 0; i < sortedLoggedDates.length; i++) {
    const dStr = sortedLoggedDates[i];
    const log = cycleLogs[dStr];
    if (log && log.isPeriodDay && log.flow !== 'none') {
      const prevDate = addDays(parseDate(dStr), -1);
      const prevStr = formatDate(prevDate);
      const prevLog = cycleLogs[prevStr];
      if (!prevLog || !prevLog.isPeriodDay || prevLog.flow === 'none') {
        loggedStarts.add(dStr);
      }
    }
  }

  // If no date set, default to 10 days ago so new users see an interactive populated preview
  if (loggedStarts.size === 0) {
    const defaultStart = formatDate(addDays(new Date(), -10));
    loggedStarts.add(defaultStart);
  }

  return Array.from(loggedStarts).sort();
};

/**
 * Get the most relevant cycle start anchor date for calculations
 */
export const getMostRecentCycleStart = (
  targetDate: Date,
  cycleSettings: CycleSettings = { cycleLength: 28, periodDuration: 5, enabled: true },
  cycleLogs: Record<string, DailyCycleLog> = {}
): Date => {
  const starts = getPeriodStartDates(cycleSettings, cycleLogs).map(parseDate);
  const cycleLength = cycleSettings.cycleLength || 28;

  // Filter starts on or before target date
  const pastStarts = starts.filter((s) => s.getTime() <= targetDate.getTime());
  if (pastStarts.length > 0) {
    const latestKnown = pastStarts[pastStarts.length - 1];
    // Project forward by cycleLength until closest cycle before targetDate
    let current = new Date(latestKnown);
    while (diffDays(targetDate, current) >= cycleLength) {
      current = addDays(current, cycleLength);
    }
    return current;
  }

  // If target date is before all known starts, project backwards
  let current = new Date(starts[0]);
  while (current.getTime() > targetDate.getTime()) {
    current = addDays(current, -cycleLength);
  }
  return current;
};

/**
 * Calculate full Flo-like cycle metrics and insights for any specific calendar date
 */
export const getDayCycleInfo = (
  dateStr: string,
  cycleSettings: CycleSettings = { cycleLength: 28, periodDuration: 5, enabled: true },
  cycleLogs: Record<string, DailyCycleLog> = {}
): DayCycleInfo => {
  const targetDate = parseDate(dateStr);
  const cycleLength = cycleSettings.cycleLength || 28;
  const periodDuration = cycleSettings.periodDuration || 5;

  const cycleStart = getMostRecentCycleStart(targetDate, cycleSettings, cycleLogs);
  const cycleDayNumber = (diffDays(targetDate, cycleStart) % cycleLength) + 1;
  const cycleDay = cycleDayNumber > 0 ? cycleDayNumber : cycleDayNumber + cycleLength;

  // Ovulation typically occurs ~14 days before next cycle start
  const ovulationDay = Math.max(1, cycleLength - 14);
  const fertileStartDay = Math.max(1, ovulationDay - 5);
  const fertileEndDay = Math.min(cycleLength, ovulationDay + 1);

  // Check actual user log for this day
  const userLog = cycleLogs[dateStr];
  const isDirectlyLoggedPeriod = !!userLog?.isPeriodDay && userLog.flow !== 'none';

  // Determine if it falls within the period window
  const isCalculatedPeriod = cycleDay >= 1 && cycleDay <= periodDuration;
  const isPeriod = isDirectlyLoggedPeriod || isCalculatedPeriod;
  const isPredictedPeriod = !isDirectlyLoggedPeriod && isCalculatedPeriod;

  const isOvulation = cycleDay === ovulationDay;
  const isFertile = cycleDay >= fertileStartDay && cycleDay <= fertileEndDay;

  // Determine Phase
  let phase: CyclePhase = 'follicular';
  let phaseName = 'Giai đoạn Nang Noãn (Follicular)';
  let phaseEmoji = '🌱';
  let phaseDesc = 'Cơ thể tái tạo năng lượng, hormone estrogen tăng dần mang lại sự tươi mới và làn da rạng rỡ.';
  let pregnancyChance: DayCycleInfo['pregnancyChance'] = 'Thấp';
  let chanceColor = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800';

  let healthInsight = 'Uống nhiều nước ấm, bổ sung vitamin C, protein và tập các bài giãn cơ nhẹ nhàng.';
  let partnerCareTip = 'Bạn gái đang có tâm trạng rất tích cực và tràn đầy năng lượng! Thích hợp cho những buổi hẹn hò cafe, xem phim hay dạo phố cùng nhau.';
  let partnerCareAction = 'Rủ cô ấy đi dạo & khen cô ấy thật xinh hôm nay ✨';

  if (isPeriod) {
    phase = 'menstrual';
    phaseName = 'Kỳ Kinh Nguyệt (Hành Kinh)';
    phaseEmoji = '🩸';
    phaseDesc = 'Niêm mạc tử cung bong ra, cơ thể cần được nghỉ ngơi, giữ ấm và chăm sóc nâng niu.';
    pregnancyChance = 'Rất thấp';
    chanceColor = 'text-rose-700 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800';
    healthInsight = 'Uống trà gừng ấm hoặc nước đậu đen, chườm ấm vùng bụng dưới và ngủ đủ 8 tiếng.';
    partnerCareTip = `Hôm nay là ngày thứ ${cycleDay} của kỳ kinh. Bạn gái có thể bị đau bụng, mỏi lưng hoặc dễ xúc động. Hãy chuẩn bị trà gừng ấm, chườm túi nóng và chiều chuộng cô ấy nhé!`;
    partnerCareAction = 'Gửi túi sưởi ấm & Trà gừng nóng ☕';
  } else if (isOvulation) {
    phase = 'ovulation';
    phaseName = 'Ngày Rụng Trứng Cao Điểm';
    phaseEmoji = '🌸';
    phaseDesc = 'Trứng rụng và sẵn sàng thụ tinh trong 12-24 giờ. Cảm xúc và hormone thăng hoa nhất trong tháng.';
    pregnancyChance = 'Rất cao (Đỉnh điểm)';
    chanceColor = 'text-purple-700 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800';
    healthInsight = 'Thời điểm rụng trứng tự nhiên. Ăn nhiều rau xanh đậm, quả bơ, hạnh nhân và duy trì tâm trạng vui vẻ.';
    partnerCareTip = 'Hôm nay là ngày rụng trứng, cảm xúc của hai bạn sẽ rất thăng hoa và gắn kết ngọt ngào.';
    partnerCareAction = 'Gửi nụ hôn & Ôm cô ấy thật chặt 💋';
  } else if (isFertile) {
    phase = 'fertile';
    phaseName = 'Cửa Sổ Thụ Thai (Fertile Window)';
    phaseEmoji = '✨';
    phaseDesc = 'Giai đoạn nang noãn phát triển đỉnh điểm, khả năng thụ thai cao trong chu kỳ.';
    pregnancyChance = cycleDay >= ovulationDay - 2 ? 'Cao' : 'Trung bình';
    chanceColor = 'text-amber-700 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800';
    healthInsight = 'Duy trì lối sống lành mạnh, bổ sung axit folic và hạn chế đồ uống có cồn/caffeine.';
    partnerCareTip = 'Giai đoạn thụ thai cao. Hãy luôn quan tâm đến cảm xúc và sức khỏe sinh sản của cả hai.';
    partnerCareAction = 'Chuẩn bị bữa ăn dinh dưỡng cho hai bạn 🥗';
  } else if (cycleDay > ovulationDay) {
    phase = 'luteal';
    phaseName = 'Giai Đoạn Hoàng Thể & Tiền Kinh (Luteal / PMS)';
    phaseEmoji = '🌙';
    phaseDesc = 'Nồng độ progesterone tăng, chuẩn bị cho chu kỳ mới. Có thể xuất hiện hội chứng tiền kinh nguyệt (PMS).';
    pregnancyChance = 'Thấp';
    chanceColor = 'text-indigo-700 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800';
    healthInsight = 'Hạn chế thức ăn quá mặn để tránh tích nước, ăn socola đen và uống trà hoa cúc thư giãn.';
    partnerCareTip = 'Giai đoạn tiền kinh nguyệt (PMS), cô ấy có thể hơi mệt mỏi hoặc nhạy cảm. Hãy lắng nghe kiên nhẫn và đừng tiếc những cái ôm vỗ về nhé!';
    partnerCareAction = 'Massage lưng nhẹ nhàng & Tặng socola ngọt ngào 🍫';
  }

  // Calculate days until next period
  const nextPeriodDate = addDays(cycleStart, cycleLength);
  const nextPeriodStartDate = formatDate(nextPeriodDate);
  const daysUntilNextPeriod = diffDays(nextPeriodDate, targetDate);
  const daysLate = daysUntilNextPeriod < 0 ? Math.abs(daysUntilNextPeriod) : 0;

  return {
    dateStr,
    isPeriod,
    isPredictedPeriod,
    isFertile,
    isOvulation,
    cycleDay,
    totalCycleDays: cycleLength,
    phase,
    phaseName,
    phaseEmoji,
    phaseDesc,
    pregnancyChance,
    chanceColor,
    daysUntilNextPeriod,
    daysLate,
    nextPeriodStartDate,
    healthInsight,
    partnerCareTip,
    partnerCareAction,
  };
};
