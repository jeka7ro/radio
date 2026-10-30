import { useEffect } from 'react';
import { useRadioStore } from '../store/useRadioStore';
import { ThemeMode } from '../types/radio';

export function useTheme() {
  const theme = useRadioStore((state) => state.theme);
  const setTheme = useRadioStore((state) => state.setTheme);
  const language = useRadioStore((state) => state.language);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyScheme = (currentTheme: ThemeMode) => {
      const meta = document.querySelector('meta[name="color-scheme"]');
      const metaContent =
        currentTheme === 'system' ? 'light dark' : currentTheme;
      if (meta) {
        meta.setAttribute('content', metaContent);
      }

      try {
        if (currentTheme === 'system') {
          localStorage.removeItem('color-scheme');
        } else {
          localStorage.setItem('color-scheme', currentTheme);
        }
      } catch {
        // Ignore storage write errors
      }

      const isDark =
        currentTheme === 'dark' ||
        (currentTheme === 'system' && mediaQuery.matches);

      document.documentElement.classList.toggle('dark', isDark);
    };

    applyScheme(theme);

    const handleMediaChange = () => {
      if (useRadioStore.getState().theme === 'system') {
        applyScheme('system');
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'color-scheme') {
        const val = e.newValue;
        if (val === 'dark' || val === 'light') {
          setTheme(val);
        } else {
          setTheme('system');
        }
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [theme, setTheme]);

  return { theme, setTheme };
}

