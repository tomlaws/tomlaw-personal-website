import { harbourTheme } from '../harbour-theme.mjs';

export function setHarbourBackdrop(night, root = document.documentElement) {
  const theme = harbourTheme(night);
  root.style.setProperty('--harbour-background', theme['--background']);
  root.style.colorScheme = theme.colorScheme;
}
