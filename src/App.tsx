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

  // Explicitly manage dark mode class on document and body without phone OS interference
  useEffect(() => {
    if (settings.isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [settings.isDarkMode]);

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
      className={`min-h-screen transition-colors duration-500 font-sans relative overflow-x-hidden bg-gradient-to-br ${
        currentTheme.bgGradient
      } ${settings.isDarkMode ? 'dark text-zinc-100' : 'text-zinc-900'}`}
    >
      {/* Dynamic Themed Atmospheric Ambient Glows */}
      <div
        className={`fixed top-[-100px] right-[-100px] w-96 h-96 ${currentTheme.bgAtmosphereOrb1} rounded-full blur-3xl opacity-75 pointer-events-none z-0 animate-pulse`}
        style={{ animationDuration: '9s' }}
      />
      <div
        className={`fixed bottom-[-60px] left-[-60px] w-80 h-80 ${currentTheme.bgAtmosphereOrb2} rounded-full blur-3xl opacity-75 pointer-events-none z-0 animate-pulse`}
        style={{ animationDuration: '11s' }}
      />
      <div
        className="fixed top-[45%] left-[-80px] w-64 h-64 rounded-full blur-3xl opacity-40 pointer-events-none z-0"
        style={{ backgroundColor: currentTheme.glowColor }}
      />

      {/* Romantic Particle Effects */}
      <FloatingHearts enabled={settings.floatingParticles} />

      {/* Real-time Heartbeat / Touch Pulse overlay */}
      <HeartbeatOverlay />

      {/* Couple Music Player Widget & Modal (3-Level display) */}
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
        <footer className="text-center py-6 text-xs text-zinc-500 dark:text-zinc-400 pb-20 sm:pb-8">
          <p
            className="font-serif italic text-sm tracking-wide font-medium flex items-center justify-center gap-2"
            style={{ color: currentTheme.primaryColor }}
          >
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
