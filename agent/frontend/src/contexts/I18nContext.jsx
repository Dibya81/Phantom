import { createContext, useContext, useState } from 'react'
import en from '../i18n/en'
import hi from '../i18n/hi'
import kn from '../i18n/kn'

const LANGS = { en, hi, kn }
const I18nContext = createContext()

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('phantom-lang') || 'en')
  const t = LANGS[lang] || LANGS.en
  const changeLang = (l) => { setLang(l); localStorage.setItem('phantom-lang', l) }
  return <I18nContext.Provider value={{ t, lang, changeLang }}>{children}</I18nContext.Provider>
}

export const useI18n = () => useContext(I18nContext)
