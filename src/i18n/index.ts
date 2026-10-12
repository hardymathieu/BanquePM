import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { en } from './en';
import { type Format, formatter, type Locale } from './format';
import { fr, type Messages } from './fr';

export type { Locale, Messages, Format };

export type I18n = { t: Messages; f: Format };

export const i18nFor = (locale: Locale): I18n => ({ t: locale === 'en' ? en : fr, f: formatter(locale) });

export const I18nContext = createContext<I18n>(i18nFor('fr'));

export const useI18n = (): I18n => useContext(I18nContext);
