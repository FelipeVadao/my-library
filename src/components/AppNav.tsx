'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const NAV_LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/books', label: 'Meus livros' },
  { href: '/scan', label: 'Scanner' },
  { href: '/assistant', label: 'Assistente' },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-paper-card">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-6">
          <span className="font-serif text-lg font-bold text-ink">My Library</span>
          <nav className="flex items-center gap-4">
            {NAV_LINKS.map((link) => {
              const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`text-sm font-medium transition ${
                    active ? 'text-brass-strong' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
