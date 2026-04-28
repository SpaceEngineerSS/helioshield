// Context-driven i18n layer for global accessibility

import React, { createContext, useContext, useState } from 'react';

type Language = 'en' | 'tr' | 'es';

interface Dictionary {
  [key: string]: string;
}

const dictionaries: Record<Language, Dictionary> = {
  en: {
    "app.title": "HelioShield",
    "science.magnetic_reconnection": "Magnetic Reconnection",
    "science.plasma_density": "Plasma Density",
    "science.dynamic_pressure": "Dynamic Pressure (Pdyn)",
    "science.imf": "Interplanetary Magnetic Field (IMF)",
    "alert.severe_storm": "SEVERE STORM PROTOCOL",
    "status.offline": "Viewing Cached Scientific Data",
  },
  tr: {
    "app.title": "HelioShield",
    "science.magnetic_reconnection": "Manyetik Yeniden Bağlanma",
    "science.plasma_density": "Plazma Yoğunluğu",
    "science.dynamic_pressure": "Dinamik Basınç (Pdyn)",
    "science.imf": "Gezegenlerarası Manyetik Alan (IMF)",
    "alert.severe_storm": "ŞİDDETLİ FIRTINA PROTOKOLÜ",
    "status.offline": "Önbelleğe Alınmış Bilimsel Veriler Görüntüleniyor",
  },
  es: {
    "app.title": "HelioShield",
    "science.magnetic_reconnection": "Reconexión Magnética",
    "science.plasma_density": "Densidad del Plasma",
    "science.dynamic_pressure": "Presión Dinámica (Pdyn)",
    "science.imf": "Campo Magnético Interplanetario (IMF)",
    "alert.severe_storm": "PROTOCOLO DE TORMENTA SEVERA",
    "status.offline": "Viendo Datos Científicos en Caché",
  }
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return dictionaries[language][key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
