import React from 'react';
import { BookHeart, Image as ImageIcon, Mail, Hourglass, Settings, Sparkles } from 'lucide-react';
import { useCouple } from '../context/CoupleContext';
import { THEMES } from '../utils/theme';
import { soundService } from '../services/sound';

export type TabType = 'diary' | 'photos' | 'cards' | 'anniversary' | 'settings';

interface NavbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { cards, settings } = useCouple();
  const currentTheme = THEMES[settings.theme] || THEMES.sakura;

  // Count unread cards
  const unreadCardsCount = cards.filter((c) => !c.isOpened && c.senderId !== 'user_1').length;

  const navItems = [
    { id: 'diary' as TabType, label: 'Nhật Ký', icon: BookHeart, emoji: '📖' },
    { id: 'photos' as TabType, label: 'Album Chung', icon: ImageIcon, emoji: '📸' },
    {
      id: 'cards' as TabType,
      label: 'Thiệp Tay',
      icon: Mail,
      emoji: '💌',
      badge: unreadCardsCount > 0 ? unreadCardsCount : undefined,
    },
    { id: 'anniversary' as TabType, label: 'Kỷ Niệm', icon: Hourglass, emoji: '⏳' },
    { id: 'settings' as TabType, label: 'Ghép Đôi', icon: Settings, emoji: '⚙️' },
  ];

  const handleTabClick = (tab: TabType) => {
    soundService.playPop();
    setActiveTab(tab);
  };

  return (
    <nav className="w-full max-w-5xl mx-auto px-3 sm:px-6 my-3">
      {/* Desktop / Tablet Artistic Pill Container */}
      <div className={`hidden sm:flex items-center justify-between p-2 rounded-full ${currentTheme.cardBg} border ${currentTheme.borderSubtle} shadow-md shadow-rose-100/30 dark:shadow-none`}>
        <div className="flex items-center gap-2 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 relative ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FF758F] to-[#FF9A9E] text-white shadow-lg shadow-rose-200/60 dark:shadow-rose-950 scale-102'
                    : 'text-[#666] dark:text-zinc-300 hover:bg-[#FFF5F7] dark:hover:bg-zinc-800/60 hover:text-[#FF758F]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#FF758F]'}`} />
                <span className="font-cute">{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-extrabold animate-bounce">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Floating Bottom Bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-[#FFE4E9] dark:border-zinc-800 px-3 py-2 flex items-center justify-around shadow-2xl safe-area-pb">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-2xl transition relative ${
                isActive ? 'text-[#FF758F] font-bold scale-105' : 'text-[#888] dark:text-zinc-400 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-bold animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none font-cute">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF758F] mt-0.5 shadow-[0_0_6px_#FF758F]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
