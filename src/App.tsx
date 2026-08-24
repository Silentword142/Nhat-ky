import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CoupleProvider, useCouple } from './context/CoupleContext';
import { MusicProvider } from './context/MusicContext';
import { Header } from './components/Header';
import { Navbar, TabType } from './components/Navbar';
import { FloatingHearts } from './components/FloatingHearts';
import { HeartbeatOverlay } from './components/HeartbeatOverlay';
import { MusicPlayer } from './components/MusicPlayer';
import { DiaryView } from './views/DiaryView';
import { PhotoAlbumView } from './views/PhotoAlbumView';
import { HandwrittenCardView } from './views/HandwrittenCardView';
import { AnniversaryView } from './views/AnniversaryView';
import { SettingsView } from './views/SettingsView';
import { THEMES } from './utils/theme';
import { soundService } from './services/sound';

const MainAppContent: React.FC = () => {
  const { settings } = useCouple();
  const [activeTab, setActiveTab] = useState<TabType>('diary');
  const currentTheme = THEMES[settings.theme] || THEMES.sakura;

  // Initialize sound on first user gesture
  useEffect(() => {
    const handleFirstInteraction = () => {
      soundService.init();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  return (
    <div
      className={`min-h-screen transition-colors duration-500 font-sans relative overflow-x-hidden ${
        settings.isDarkMode ? 'dark bg-[#151019] text-[#f4effa]' : 'bg-[#FFF5F7] text-[#4A4A4A]'
      }`}
    >
      {/* Artistic Flair Atmospheric Ambient Glows */}
      <div className="fixed top-[-100px] right-[-100px] w-96 h-96 bg-[#FFD8E4] dark:bg-[#3d1a29]/40 rounded-full blur-3xl opacity-70 pointer-events-none z-0 animate-pulse" style={{ animationDuration: '9s' }} />
      <div className="fixed bottom-[-60px] left-[-60px] w-80 h-80 bg-[#E0F2FE] dark:bg-[#122b3b]/35 rounded-full blur-3xl opacity-70 pointer-events-none z-0 animate-pulse" style={{ animationDuration: '11s' }} />
      <div className="fixed top-[45%] left-[-80px] w-64 h-64 bg-[#F3E8FF] dark:bg-[#2c1740]/25 rounded-full blur-3xl opacity-50 pointer-events-none z-0" />

      {/* Romantic Particle Effects */}
      <FloatingHearts enabled={settings.floatingParticles} />

      {/* Real-time Heartbeat / Touch Pulse overlay */}
      <HeartbeatOverlay />

      {/* Couple Music Player Widget & Modal */}
      <MusicPlayer />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Header */}
        <Header />

        {/* Navigation Bar */}
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content Area with Smooth Page Transition */}
        <main className="flex-1 mt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {activeTab === 'diary' && <DiaryView />}
              {activeTab === 'photos' && <PhotoAlbumView />}
              {activeTab === 'cards' && <HandwrittenCardView />}
              {activeTab === 'anniversary' && <AnniversaryView />}
              {activeTab === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer info */}
        <footer className="text-center py-6 text-xs text-[#999] dark:text-zinc-500 pb-20 sm:pb-8">
          <p className="font-serif italic text-sm text-[#FF758F] dark:text-[#FF9A9E] tracking-wide font-medium flex items-center justify-center gap-2">
            <span>✨</span>
            <span>Love you to the Moon and back</span>
            <span>🌙</span>
          </p>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <CoupleProvider>
      <MusicProvider>
        <MainAppContent />
      </MusicProvider>
    </CoupleProvider>
  );
}
