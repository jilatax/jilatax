export const APP_TABS = [
  { id: 'home', label: 'Home' },
  { id: 'about', label: 'About' },
  { id: 'me', label: 'Me' },
] as const;

export type AppTab = (typeof APP_TABS)[number]['id'];
