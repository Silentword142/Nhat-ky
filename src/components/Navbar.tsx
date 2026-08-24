import React from 'react';
import { BookHeart, Image as ImageIcon, Mail, Hourglass, Settings } from 'lucide-react';
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
      {/* Desktop / Tablet Themed Pill Container */}
      <div className={`hidden sm:flex items-center justify-between p-2 rounded-full ${currentTheme.cardBg} border ${currentTheme.cardBorder} shadow-lg backdrop-blur-xl transition-all duration-300`}>
        <div className="flex items-center gap-2 w-full">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 relative cursor-pointer ${
                  isActive
                    ? `${currentTheme.activeTab} scale-102`
                    : 'text-zinc-600 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <Icon
                  className="w-4 h-4 transition-colors"
                  style={{ color: isActive ? undefined : currentTheme.primaryColor }}
                />
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
      <div className={`sm:hidden fixed bottom-0 inset-x-0 z-40 ${currentTheme.cardBg} backdrop-blur-2xl border-t ${currentTheme.cardBorder} px-3 py-2 flex items-center justify-around shadow-2xl safe-area-pb`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-2xl transition relative cursor-pointer ${
                isActive ? 'font-bold scale-105' : 'text-zinc-500 dark:text-zinc-400 font-medium'
              }`}
              style={{ color: isActive ? currentTheme.primaryColor : undefined }}
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
                <span
                  className="w-1.5 h-1.5 rounded-full mt-0.5"
                  style={{
                    backgroundColor: currentTheme.primaryColor,
                    boxShadow: `0 0 6px ${currentTheme.primaryColor}`,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
