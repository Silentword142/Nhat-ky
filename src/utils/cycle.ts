import { DailyCycleLog, CycleSettings, PeriodRecord } from '../types';

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

export interface PredictedCycle {
  cycleIndex: number;
  startDate: string;
  endDate: string;
  ovulationDate: string;
  fertileStartDate: string;
  fertileEndDate: string;
  cycleLength: number;
  periodDuration: number;
}

// Date helpers
export const parseDate = (dStr: string) => {
  if (!dStr) return new Date();
  const [y, m, d] = dStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const diffDays = (d1: Date, d2: Date) => {
  const t1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const t2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
};

export const addDays = (d: Date, days: number) => {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
};

/**
 * Get all consolidated period records (combining settings history, lastPeriodStartDate, and logs)
 * Sorted chronologically from oldest to newest.
 */
export const getConsolidatedPeriodHistory = (
  cycleSettings: CycleSettings = { cycleLength: 28, periodDuration: 5, enabled: true },
  cycleLogs: Record<string, DailyCycleLog> = {}
): PeriodRecord[] => {
  const historyMap = new Map<string, PeriodRecord>();

  // 1. Existing explicit history records
  if (Array.isArray(cycleSettings.history)) {
    for (const item of cycleSettings.history) {
      if (item && item.startDate) {
        historyMap.set(item.startDate, {
          ...item,
          duration: item.duration || cycleSettings.periodDuration || 5,
        });
      }
    }
  }

  // 2. Current lastPeriodStartDate
  if (cycleSettings.lastPeriodStartDate) {
    if (!historyMap.has(cycleSettings.lastPeriodStartDate)) {
      historyMap.set(cycleSettings.lastPeriodStartDate, {
        id: `period_${cycleSettings.lastPeriodStartDate}`,
        startDate: cycleSettings.lastPeriodStartDate,
        duration: cycleSettings.periodDuration || 5,
        cycleLength: cycleSettings.cycleLength || 28,
        loggedAt: Date.now(),
      });
    }
  }

  // 3. Scan daily cycle logs for distinct period start dates
  const sortedLogDates = Object.keys(cycleLogs).sort();
  for (let i = 0; i < sortedLogDates.length; i++) {
    const dStr = sortedLogDates[i];
    const log = cycleLogs[dStr];
    if (log && log.isPeriodDay && log.flow !== 'none') {
      const prevDate = addDays(parseDate(dStr), -1);
      const prevStr = formatDate(prevDate);
      const prevLog = cycleLogs[prevStr];
      if (!prevLog || !prevLog.isPeriodDay || prevLog.flow === 'none') {
        if (!historyMap.has(dStr)) {
          // Count duration in logs
          let dur = 1;
          let checkDate = addDays(parseDate(dStr), 1);
          while (cycleLogs[formatDate(checkDate)]?.isPeriodDay && cycleLogs[formatDate(checkDate)]?.flow !== 'none') {
            dur++;
            checkDate = addDays(checkDate, 1);
          }
          historyMap.set(dStr, {
            id: `period_${dStr}`,
            startDate: dStr,
            duration: dur > 0 ? dur : (cycleSettings.periodDuration || 5),
            loggedAt: log.updatedAt || Date.now(),
          });
        }
      }
    }
  }

  // If completely empty, default to 10 days ago
  if (historyMap.size === 0) {
    const defaultStart = formatDate(addDays(new Date(), -10));
    historyMap.set(defaultStart, {
      id: `period_${defaultStart}`,
      startDate: defaultStart,
      duration: cycleSettings.periodDuration || 5,
      cycleLength: cycleSettings.cycleLength || 28,
      loggedAt: Date.now(),
    });
  }

  const sortedList = Array.from(historyMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Compute cycleLength intervals between consecutive periods
  for (let i = 0; i < sortedList.length - 1; i++) {
    const d1 = parseDate(sortedList[i].startDate);
    const d2 = parseDate(sortedList[i + 1].startDate);
    const interval = diffDays(d2, d1);
    if (interval > 0) {
      sortedList[i].cycleLength = interval;
    }
  }

  // For the latest period, use the configured cycleLength
  if (sortedList.length > 0) {
    const last = sortedList[sortedList.length - 1];
    if (!last.cycleLength) {
      last.cycleLength = cycleSettings.cycleLength || 28;
    }
  }

  return sortedList;
};

/**
 * Get all known period start dates from logs and settings, sorted chronologically
 */
export const getPeriodStartDates = (
  cycleSettings: CycleSettings = { cycleLength: 28, periodDuration: 5, enabled: true },
  cycleLogs: Record<string, DailyCycleLog> = {}
): string[] => {
  const history = getConsolidatedPeriodHistory(cycleSettings, cycleLogs);
  return history.map((h) => h.startDate);
};

/**
 * Proactively log the start of a new period without distorting or losing previous periods.
 * Returns the updated CycleSettings and DailyCycleLog map.
 */
export const logNewPeriodStart = (
  newStartDate: string,
  duration: number = 5,
  notes: string = '',
  currentSettings: CycleSettings,
  currentLogs: Record<string, DailyCycleLog> = {}
): { updatedSettings: CycleSettings; updatedLogs: Record<string, DailyCycleLog> } => {
  const existingHistory = getConsolidatedPeriodHistory(currentSettings, currentLogs);

  const cleanDuration = Math.max(1, Math.min(15, Number(duration) || currentSettings.periodDuration || 5));
  const newDateObj = parseDate(newStartDate);

  // New record
  const newRecord: PeriodRecord = {
    id: `period_${newStartDate}_${Date.now()}`,
    startDate: newStartDate,
    duration: cleanDuration,
    cycleLength: currentSettings.cycleLength || 28,
    notes: notes.trim() || undefined,
    loggedAt: Date.now(),
  };

  // Merge into history list without duplicates on the same start date
  const updatedHistoryMap = new Map<string, PeriodRecord>();
  for (const item of existingHistory) {
    if (item.startDate !== newStartDate) {
      updatedHistoryMap.set(item.startDate, item);
    }
  }
  updatedHistoryMap.set(newStartDate, newRecord);

  const sortedHistory = Array.from(updatedHistoryMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));

  // Re-calculate cycle intervals
  for (let i = 0; i < sortedHistory.length - 1; i++) {
    const d1 = parseDate(sortedHistory[i].startDate);
    const d2 = parseDate(sortedHistory[i + 1].startDate);
    const interval = diffDays(d2, d1);
    if (interval > 0) {
      sortedHistory[i].cycleLength = interval;
    }
  }

  // Determine latest period start date
  const latestRecord = sortedHistory[sortedHistory.length - 1];

  const updatedSettings: CycleSettings = {
    ...currentSettings,
    periodDuration: cleanDuration,
    lastPeriodStartDate: latestRecord.startDate,
    enabled: true,
    history: sortedHistory,
  };

  // Populate daily period logs for the bleeding duration of the new period
  const updatedLogs = { ...currentLogs };
  for (let d = 0; d < cleanDuration; d++) {
    const dateOfPeriod = formatDate(addDays(newDateObj, d));
    const prevEntry = updatedLogs[dateOfPeriod];
    updatedLogs[dateOfPeriod] = {
      date: dateOfPeriod,
      flow: d === 0 ? 'heavy' : d < 3 ? 'medium' : 'light',
      isPeriodDay: true,
      painLevel: prevEntry?.painLevel ?? (d === 0 ? 2 : 1),
      symptoms: prevEntry?.symptoms || (d === 0 ? ['cramps'] : []),
      mood: prevEntry?.mood || '',
      cervicalMucus: prevEntry?.cervicalMucus || 'dry',
      notes: d === 0 && notes ? notes : prevEntry?.notes,
      updatedAt: Date.now(),
    };
  }

  return { updatedSettings, updatedLogs };
};

/**
 * Remove a specific period record from history
 */
export const removePeriodFromHistory = (
  startDateToRemove: string,
  currentSettings: CycleSettings,
  currentLogs: Record<string, DailyCycleLog> = {}
): { updatedSettings: CycleSettings; updatedLogs: Record<string, DailyCycleLog> } => {
  const existingHistory = getConsolidatedPeriodHistory(currentSettings, currentLogs);
  const filtered = existingHistory.filter((h) => h.startDate !== startDateToRemove);

  const newLatest = filtered.length > 0 ? filtered[filtered.length - 1].startDate : formatDate(addDays(new Date(), -10));

  const updatedSettings: CycleSettings = {
    ...currentSettings,
    lastPeriodStartDate: newLatest,
    history: filtered,
  };

  return { updatedSettings, updatedLogs: currentLogs };
};

/**
 * Calculate future predicted cycles (e.g. next 3-6 cycles)
 */
export const getFutureCyclePredictions = (
  cycleSettings: CycleSettings = { cycleLength: 28, periodDuration: 5, enabled: true },
  cycleLogs: Record<string, DailyCycleLog> = {},
  count: number = 4
): PredictedCycle[] => {
  const history = getConsolidatedPeriodHistory(cycleSettings, cycleLogs);
  const latestRecord = history[history.length - 1];
  const baseStart = parseDate(latestRecord?.startDate || cycleSettings.lastPeriodStartDate || formatDate(new Date()));
  const cycleLength = cycleSettings.cycleLength || 28;
  const periodDuration = cycleSettings.periodDuration || 5;

  const predictions: PredictedCycle[] = [];
  let currentStart = new Date(baseStart);

  // If baseStart is in the past, advance until we reach current/next cycle
  const today = new Date();
  while (diffDays(today, currentStart) >= cycleLength) {
    currentStart = addDays(currentStart, cycleLength);
  }

  for (let i = 0; i < count; i++) {
    const cycleStart = addDays(currentStart, i * cycleLength);
    const cycleEnd = addDays(cycleStart, periodDuration - 1);
    const ovulationDay = Math.max(1, cycleLength - 14);
    const ovulationDate = addDays(cycleStart, ovulationDay - 1);
    const fertileStart = addDays(ovulationDate, -5);
    const fertileEnd = addDays(ovulationDate, 1);

    predictions.push({
      cycleIndex: i + 1,
      startDate: formatDate(cycleStart),
      endDate: formatDate(cycleEnd),
      ovulationDate: formatDate(ovulationDate),
      fertileStartDate: formatDate(fertileStart),
      fertileEndDate: formatDate(fertileEnd),
      cycleLength,
      periodDuration,
    });
  }

  return predictions;
};

/**
 * Get the most relevant cycle start anchor date and effective cycle length for a target date
 */
export const getMostRecentCycleStartInfo = (
  targetDate: Date,
  cycleSettings: CycleSettings = { cycleLength: 28, periodDuration: 5, enabled: true },
  cycleLogs: Record<string, DailyCycleLog> = {}
): { cycleStart: Date; effectiveCycleLength: number; effectivePeriodDuration: number } => {
  const history = getConsolidatedPeriodHistory(cycleSettings, cycleLogs);
  const defaultCycleLength = cycleSettings.cycleLength || 28;
  const defaultPeriodDuration = cycleSettings.periodDuration || 5;

  if (history.length === 0) {
    const def = addDays(new Date(), -10);
    return {
      cycleStart: def,
      effectiveCycleLength: defaultCycleLength,
      effectivePeriodDuration: defaultPeriodDuration,
    };
  }

  // Find where targetDate falls within historical segments
  for (let i = 0; i < history.length - 1; i++) {
    const startA = parseDate(history[i].startDate);
    const startB = parseDate(history[i + 1].startDate);

    if (targetDate.getTime() >= startA.getTime() && targetDate.getTime() < startB.getTime()) {
      const segCycleLength = history[i].cycleLength || diffDays(startB, startA) || defaultCycleLength;
      return {
        cycleStart: startA,
        effectiveCycleLength: segCycleLength,
        effectivePeriodDuration: history[i].duration || defaultPeriodDuration,
      };
    }
  }

  // Check latest historical record
  const latest = history[history.length - 1];
  const latestStart = parseDate(latest.startDate);

  if (targetDate.getTime() >= latestStart.getTime()) {
    // Project forward from latest start using current default cycle length
    let current = new Date(latestStart);
    while (diffDays(targetDate, current) >= defaultCycleLength) {
      current = addDays(current, defaultCycleLength);
    }
    return {
      cycleStart: current,
      effectiveCycleLength: defaultCycleLength,
      effectivePeriodDuration: defaultPeriodDuration,
    };
  }

  // If targetDate is before oldest historical record, project backwards
  const oldest = history[0];
  const oldestStart = parseDate(oldest.startDate);
  let current = new Date(oldestStart);
  while (current.getTime() > targetDate.getTime()) {
    current = addDays(current, -defaultCycleLength);
  }
  return {
    cycleStart: current,
    effectiveCycleLength: defaultCycleLength,
    effectivePeriodDuration: defaultPeriodDuration,
  };
};

/**
 * Get the cycle start anchor date for calculations
 */
export const getMostRecentCycleStart = (
  targetDate: Date,
  cycleSettings: CycleSettings = { cycleLength: 28, periodDuration: 5, enabled: true },
  cycleLogs: Record<string, DailyCycleLog> = {}
): Date => {
  return getMostRecentCycleStartInfo(targetDate, cycleSettings, cycleLogs).cycleStart;
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
  const { cycleStart, effectiveCycleLength: cycleLength, effectivePeriodDuration: periodDuration } =
    getMostRecentCycleStartInfo(targetDate, cycleSettings, cycleLogs);

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
