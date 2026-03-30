import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import en from "./resources/en";
import ar from "./resources/ar";

const STORAGE_KEY = "@app_language";

const languageDetector = {
  type: "languageDetector" as const,
  async: true,
  detect: async (cb: (lang: string) => void) => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        cb(saved);
        return;
      }
      const locale = Localization.getLocales?.()?.[0]?.languageCode ?? "en";
      cb(locale === "ar" ? "ar" : "en");
    } catch {
      cb("en");
    }
  },
  init: () => {},
  cacheUserLanguage: async (lang: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage failures
    }
  },
};

if (!i18n.isInitialized) {
  i18n
    .use(languageDetector)
    .use(initReactI18next)
    .init({
      compatibilityJSON: "v4",
      fallbackLng: "en",
      supportedLngs: ["en", "ar"],
      keySeparator: ".",
      returnNull: false,
      returnEmptyString: false,
      interpolation: { escapeValue: false },
      resources: {
        en: { translation: en },
        ar: { translation: ar },
      },
    });
}

export default i18n;
