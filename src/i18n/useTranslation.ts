import { useRadioStore } from '../store/useRadioStore';
import { translations, formatTranslation } from './translations';

export function useTranslation() {
  const language = useRadioStore((state) => state.language);
  const setLanguage = useRadioStore((state) => state.setLanguage);
  const dict = translations[language] ?? translations.ro;

  return {
    t: dict,
    language,
    setLanguage,
    format: formatTranslation,
  };
}

