import i18n from "../i18n";
import { useTranslation } from "react-i18next";

export const useAppTranslation = () => {
  const { t } = useTranslation();

  const language = i18n.language?.startsWith("ar") ? "ar" : "en";
  const isRTL = i18n.dir(language) === "rtl";

  const setLanguage = async (lang: "en" | "ar") => {
    await i18n.changeLanguage(lang);
  };

  return { t, language, isRTL, setLanguage };
};
