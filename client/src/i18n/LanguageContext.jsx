import React, { createContext, useContext, useState } from 'react';
import { translations } from './translations';

const LanguageContext = createContext({ language: 'en', setLanguage: () => {}, t: (key) => key });

const STORAGE_KEY = 'gvista_language';

function loadInitialLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(loadInitialLanguage);

  const setLanguage = (lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // best-effort persistence only
    }
  };

  // t(key) falls back to English, then to the raw key itself, so a missing
  // translation shows as visibly-wrong English text (catchable in review) rather
  // than a blank space or a crash.
  const t = (key) => translations[language]?.[key] || translations.en[key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
