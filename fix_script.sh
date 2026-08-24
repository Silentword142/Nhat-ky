sed -i 's/      localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(updatedPlaylist));/      sendYouTubeIframeCommand("unMute");\n    }\n  }, [volume, isMuted]);\n\n  \/\/ Old persistPlaylist was deleted\n/g' src/context/MusicContext.tsx
sed -i 's/    } catch (e) {//g' src/context/MusicContext.tsx
sed -i 's/      console.error('\''Failed to save playlist:'\'', e);//g' src/context/MusicContext.tsx
sed -i 's/    }//g' src/context/MusicContext.tsx
