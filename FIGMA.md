# Figma MCP Design System Rules — registra-dashboard

This doc tells the Figma MCP integration (and anyone implementing a Figma design here) how this codebase actually works, since **no formal design system exists yet** — there are no design tokens, no component library, and no icon system. Treat any Figma import as the chance to originate these, not to map onto existing ones.

## Stack
- Next.js 16.2.9 (App Router), React 19.2.4, TypeScript ^5
- Tailwind CSS **v4** via `@tailwindcss/postcss` — CSS-first config, **no `tailwind.config.js`**
- `@supabase/ssr` for real SSR auth: a browser client (`src/lib/supabase/client.ts`), a server client for Server Components/Server Actions (`src/lib/supabase/server.ts`), and `src/proxy.ts` + `src/lib/supabase/middleware.ts` for session refresh and gating `/` and `/books` behind login. This Next.js version renamed `middleware.ts` → `proxy.ts` (function must be named/exported `proxy`) — see `AGENTS.md`.
- `recharts` for charts, `@zxing/browser`/`@zxing/library` for ISBN barcode scanning on `/scan`, plus a small hand-rolled lookup against the Google Books API (primary) and Open Library (fallback) in `src/lib/booksApi.ts` — no OCR anywhere in this app.
- No Storybook, no shadcn/ui (`components.json` is absent), no styled-components/CSS Modules

## Design tokens
Tokens live in `src/app/globals.css` using Tailwind v4's `@theme` directive — NOT a `tailwind.config.ts`:
```css
@import "tailwindcss";
:root { --background: #ffffff; --foreground: #171717; }
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
@media (prefers-color-scheme: dark) {
  :root { --background: #0a0a0a; --foreground: #ededed; }
}
```
- Fonts: Geist / Geist Mono loaded via `next/font/google` in `src/app/layout.tsx`, exposed as CSS vars consumed by `@theme inline`.
- There is no typography scale, spacing scale, or shadow scale defined as tokens. Components use raw Tailwind utility defaults (`text-sm`, `text-3xl`, `rounded-xl`, `gap-1`, etc.) plus ad hoc hardcoded hex values (e.g. `#34d399`, `#1e293b` in `src/components/DailyChart.tsx`).
- **When bringing in colors/spacing/typography from a Figma file: extend the `@theme` block in `globals.css` with new `--color-*` / `--font-*` variables rather than hardcoding hex in components.** This is a new convention to establish, not an existing one to discover.

## Components
- Location: flat `src/components/` (no `ui/` subfolder, no atomic-design layering): `DailyChart.tsx`, `RatingDistributionChart.tsx`, `MetricCard.tsx`, `RealtimeCounter.tsx`, `ScoreGauge.tsx`, `ScanFunnel.tsx`, `GenreMonthHeatmap.tsx`, `GenreDonutChart.tsx`, `AlertsTable.tsx`, `RecommendationsList.tsx`.
- Pattern: function components, `'use client'` directive when needed, typed `Props` interface, Tailwind `className` strings (often built with template literals for conditional variants, no `cva`/`clsx` in use).
- Representative example (`src/components/MetricCard.tsx`):
```tsx
'use client';
interface Props { label: string; value: string | number; sub?: string; accent?: boolean; }
export default function MetricCard({ label, value, sub, accent }: Props) {
  return (
    <div className={`rounded-xl p-5 flex flex-col gap-1 ${accent ? 'bg-blue-600' : 'bg-slate-800'}`}>
      <span className="text-sm text-slate-400 font-medium">{label}</span>
      <span className="text-3xl font-bold text-white">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}
```
- When generating a new component from a Figma node, match this shape: single default export, `Props` interface, Tailwind-only styling, no external UI kit.

## Styling
- Pure Tailwind utility classes via `className`. No CSS Modules, no styled-components.
- Single global stylesheet (`src/app/globals.css`), imported once in `src/app/layout.tsx`. Don't create per-component stylesheets.
- Responsive design uses standard Tailwind breakpoint prefixes, e.g. `grid grid-cols-2 md:grid-cols-4 gap-4` (`src/app/page.tsx`), `hidden md:table-cell` (`src/app/books/page.tsx`).

## Icons
No icon library is installed (no `lucide-react`, `react-icons`, `heroicons`). `public/` only has unused default Next.js scaffold SVGs. **If a Figma design specifies icons, either export them as inline SVG components or add `lucide-react` — pick one and use it consistently; don't mix.**

## Assets
- Static assets live in `public/`: `icon-192.png`, `icon-512.png`, `manifest.json`; `favicon.ico` lives in `src/app/`.
- Referenced as URL strings (e.g. `manifest: "/manifest.json"` in `layout.tsx` metadata), not via `import`.
- `next/image` is **deliberately not used** for book covers (plain `<img>` instead): cover URLs come from three unpredictable origins at runtime (Google Books' image CDN, `covers.openlibrary.org`, and this project's own Supabase Storage bucket), and wiring up `images.remotePatterns` for all three was judged out of scope for a personal project. Revisit if this becomes worth the config.

## Project structure
```
registra-dashboard/
├── public/
├── src/
│   ├── proxy.ts       # auth gate — Next 16 renamed middleware.ts to this
│   ├── app/            # App Router routes: layout.tsx, globals.css, page.tsx, actions.ts
│   │                    # scan/page.tsx, books/page.tsx
│   ├── components/     # flat, type-based: charts, MetricCard, RealtimeCounter
│   └── lib/             # bookQueue.ts, booksApi.ts, supabase/ (client.ts, server.ts, middleware.ts, types.ts)
```
3 routes total: `/`, `/scan`, `/books`. Route-based organization at the `app/` level; flat type-based organization at the `components/` level — don't introduce feature folders without discussing it first. `src/lib/supabase/` and `src/proxy.ts` are a deliberate, discussed exception to that rule: they're the standard Supabase SSR client-separation pattern (browser/server/middleware clients each need different cookie handling), not an ad hoc feature folder.

## Figma MCP integration notes
- Before calling `use_figma`, follow the `/figma-use` skill.
- Since there's no `components.json`/Code Connect mapping yet, `get_code_connect_suggestions` will have nothing to match against — expect to generate fresh components rather than reuse mapped ones.
- When `get_variable_defs` returns Figma variables, map them into `@theme` CSS variables in `globals.css`, not inline styles.
