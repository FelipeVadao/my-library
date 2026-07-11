'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  function linkClassName(href: string) {
    return `text-sm font-medium transition ${
      isActive(href) ? 'text-brass-strong' : 'text-ink-muted hover:text-ink'
    }`;
  }

  return (
    <header className="border-b border-border bg-paper-card">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6">
          <span className="font-serif text-lg font-bold text-ink">My Library</span>
          {/* 5 links + branding don't fit a phone-width row — collapsed into the
              menu below md, shown inline from md up. */}
          <nav className="hidden md:flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? 'page' : undefined} className={linkClassName(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            className="md:hidden p-2 rounded-md text-ink-muted hover:text-ink hover:bg-tan transition"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="md:hidden border-t border-border px-6 py-3 flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={linkClassName(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
