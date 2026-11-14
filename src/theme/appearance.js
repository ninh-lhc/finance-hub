export const APPEARANCE_KEY = 'finance-hub-appearance';

export function readAppearance() {
  try {
    return localStorage.getItem(APPEARANCE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyAppearance(appearance) {
  document.documentElement.classList.toggle('dark', appearance === 'dark');
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance);
  } catch {
    /* The choice still applies for this visit. */
  }
}
