// The app speaks Portuguese or English, the person's choice (Configurações, or the first
// step of the introduction). Each process keeps the current language here; text that a
// person reads is written once in each, side by side, where it is used: L('Salvar', 'Save').
export type Lang = 'pt' | 'en'

let current: Lang = 'pt'

export const setLang = (lang: Lang): void => {
  current = lang
}
export const lang = (): Lang => current
export const L = (pt: string, en: string): string => (current === 'en' ? en : pt)
// For dates and numbers.
export const locale = (): string => (current === 'en' ? 'en-US' : 'pt-BR')
// The language the Mac is set to, for a new install.
export const langOf = (systemLocale: string | undefined): Lang => (!systemLocale || systemLocale.toLowerCase().startsWith('pt') ? 'pt' : 'en')
