'use client';

const STORAGE_KEY = 'theme';

function applyTheme(theme: 'light' | 'dark') {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage indisponível (modo privado etc.) — tema muda na sessão, mas não persiste
  }
}

function handleToggle() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  applyTheme(isLight ? 'dark' : 'light');
}

export default function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label="Alternar entre modo claro e escuro"
      className="text-sm text-brass-strong hover:text-brass-strong-hover px-4 py-2 rounded-md border border-border hover:border-brass transition"
    >
      <span data-theme-label="to-light">Modo claro</span>
      <span data-theme-label="to-dark">Modo escuro</span>
    </button>
  );
}
