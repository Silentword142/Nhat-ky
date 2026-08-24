export interface ThemeDefinition {
  id: 'sakura' | 'twilight' | 'lavender' | 'peach' | 'matcha' | 'mocha';
  name: string;
  emoji: string;
  description: string;
  previewBg: string;
  primaryColor: string;
  secondaryColor: string;
  bgGradient: string;
  cardBg: string;
  accentBadge: string;
  activeTab: string;
  heartColor: string;
  borderSubtle: string;
  glowColor: string;
}

export const THEMES: Record<string, ThemeDefinition> = {
  sakura: {
    id: 'sakura',
    name: 'Artistic Flair (Hoa Hồng)',
    emoji: '🌸',
    description: 'Nghệ thuật hoa hồng thanh lịch, pastel mềm mại & lãng mạn',
    previewBg: 'bg-[#FFD8E4]',
    primaryColor: '#FF758F',
    secondaryColor: '#FF9A9E',
    bgGradient: 'from-[#FFF5F7] via-[#FFF9FA] to-[#FFF0F4] dark:from-[#151019] dark:via-[#1c1522] dark:to-[#120d16]',
    cardBg: 'bg-white/85 dark:bg-[#1f1725]/85 backdrop-blur-md',
    accentBadge: 'bg-[#FFF5F7] text-[#FF758F] border border-[#FFE4E9] dark:bg-[#2b1e32] dark:text-[#FF9A9E] dark:border-[#3d2746]',
    activeTab: 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow-lg shadow-rose-200/60 dark:shadow-rose-950',
    heartColor: 'text-[#FF758F]',
    borderSubtle: 'border-[#FFE4E9] dark:border-[#38263e]',
    glowColor: 'rgba(255, 117, 143, 0.4)',
  },
  twilight: {
    id: 'twilight',
    name: 'Midnight Twilight',
    emoji: '🌙',
    description: 'Đêm sao lãng mạn, huyền ảo & êm dịu mắt',
    previewBg: 'bg-indigo-900',
    primaryColor: '#6366f1',
    secondaryColor: '#818cf8',
    bgGradient: 'from-slate-950 via-indigo-950/60 to-[#120f24] dark:from-black dark:via-slate-950 dark:to-zinc-950',
    cardBg: 'bg-slate-900/85 dark:bg-zinc-900/90 text-white backdrop-blur-md',
    accentBadge: 'bg-indigo-900/60 text-indigo-200 border border-indigo-700/40',
    activeTab: 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/40',
    heartColor: 'text-pink-400',
    borderSubtle: 'border-indigo-900/40 dark:border-zinc-800',
    glowColor: 'rgba(99, 102, 241, 0.4)',
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender Dream',
    emoji: '💜',
    description: 'Tím hoa oải hương mộng mơ, thanh khiết',
    previewBg: 'bg-[#E9D5FF]',
    primaryColor: '#a855f7',
    secondaryColor: '#c084fc',
    bgGradient: 'from-[#FAF5FF] via-[#F3E8FF]/40 to-[#EDE9FE] dark:from-[#160f22] dark:via-[#1e1330] dark:to-[#130b1c]',
    cardBg: 'bg-white/85 dark:bg-[#1e142e]/85 backdrop-blur-md',
    accentBadge: 'bg-[#FAF5FF] text-[#9333ea] border border-[#E9D5FF] dark:bg-[#2c1a45] dark:text-[#d8b4fe]',
    activeTab: 'bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-200 dark:shadow-purple-950',
    heartColor: 'text-purple-500',
    borderSubtle: 'border-[#F3E8FF] dark:border-[#382352]',
    glowColor: 'rgba(168, 85, 247, 0.4)',
  },
  peach: {
    id: 'peach',
    name: 'Peach Sunset',
    emoji: '🍑',
    description: 'Cam đào hoàng hôn ấm áp & tươi sáng',
    previewBg: 'bg-orange-100',
    primaryColor: '#f97316',
    secondaryColor: '#fb923c',
    bgGradient: 'from-[#FFF7ED] via-[#FFEDD5]/40 to-[#FEF2F2] dark:from-[#1b120d] dark:via-[#26170e] dark:to-[#140b07]',
    cardBg: 'bg-white/85 dark:bg-[#24150d]/85 backdrop-blur-md',
    accentBadge: 'bg-[#FFF7ED] text-[#ea580c] border border-[#FED7AA] dark:bg-[#331c11] dark:text-[#fdba74]',
    activeTab: 'bg-gradient-to-r from-orange-500 to-rose-400 text-white shadow-lg shadow-orange-200 dark:shadow-orange-950',
    heartColor: 'text-orange-500',
    borderSubtle: 'border-[#FFEDD5] dark:border-[#3f2316]',
    glowColor: 'rgba(249, 115, 22, 0.4)',
  },
  matcha: {
    id: 'matcha',
    name: 'Matcha Cozy',
    emoji: '🍵',
    description: 'Xanh bơ trà xanh thanh lịch, yên bình',
    previewBg: 'bg-emerald-100',
    primaryColor: '#10b981',
    secondaryColor: '#34d399',
    bgGradient: 'from-[#ECFDF5] via-[#D1FAE5]/40 to-[#F0FDF4] dark:from-[#0a1813] dark:via-[#0e241c] dark:to-[#08130f]',
    cardBg: 'bg-white/85 dark:bg-[#11241c]/85 backdrop-blur-md',
    accentBadge: 'bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] dark:bg-[#17382c] dark:text-[#6ee7b7]',
    activeTab: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200 dark:shadow-emerald-950',
    heartColor: 'text-emerald-500',
    borderSubtle: 'border-[#D1FAE5] dark:border-[#1d4435]',
    glowColor: 'rgba(16, 185, 129, 0.4)',
  },
  mocha: {
    id: 'mocha',
    name: 'Mocha Milk Tea',
    emoji: '🍫',
    description: 'Nâu trà sữa vintage ấm cúng & cổ điển',
    previewBg: 'bg-amber-100',
    primaryColor: '#b45309',
    secondaryColor: '#d97706',
    bgGradient: 'from-[#FFFBEB] via-[#FEF3C7]/40 to-[#FAF5FF] dark:from-[#1b150b] dark:via-[#261d0d] dark:to-[#141007]',
    cardBg: 'bg-white/85 dark:bg-[#241c0e]/85 backdrop-blur-md',
    accentBadge: 'bg-[#FFFBEB] text-[#b45309] border border-[#FDE68A] dark:bg-[#332612] dark:text-[#fcd34d]',
    activeTab: 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-200 dark:shadow-amber-950',
    heartColor: 'text-amber-600',
    borderSubtle: 'border-[#FEF3C7] dark:border-[#3f3016]',
    glowColor: 'rgba(180, 83, 9, 0.4)',
  },
};
