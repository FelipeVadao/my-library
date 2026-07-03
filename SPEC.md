# My Library — Spec do Projeto

> Nome do pacote: `registra-dashboard` · Nome do produto (visível ao usuário): **My Library**
> Documento gerado a partir do estado real do código em 2026-07-03. Reflete o que existe, não um roadmap aspiracional.

## 1. Visão geral

My Library é um app pessoal de catalogação de livros: o usuário escaneia o código de barras (ISBN) de um livro com a câmera do celular, o app busca os metadados automaticamente (título, autor, capa, sinopse etc.) e registra o livro na biblioteca pessoal do usuário. Um dashboard mostra estatísticas de leitura (metas, gêneros, avaliações, autores mais lidos).

O projeto é a segunda geração de uma ideia anterior ("Registra", um contador de produtos escaneados por operadores — daí o nome do pacote `registra-dashboard` e das colunas `operator_id` no banco). O fluxo de produtos escaneados foi completamente substituído pelo fluxo de biblioteca de livros; as tabelas antigas (`scans`, `sessions`) permanecem no banco por precaução, mas não são mais usadas pela aplicação.

**Usuário-alvo:** uso pessoal/individual (não multi-tenant, não há conceito de "biblioteca compartilhada" ou papéis de admin/operador distintos — cada usuário autenticado só vê os próprios livros).

## 2. Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16.2.9 (App Router) |
| UI | React 19.2.4 + TypeScript ^5 |
| Estilo | Tailwind CSS v4 (config CSS-first via `@theme`, sem `tailwind.config.js`) |
| Gráficos | Recharts 3.8 |
| Leitura de código de barras | `@zxing/browser` + `@zxing/library` (decodificação EAN-13/EAN-8 via câmera) |
| Backend / dados | Supabase (Postgres + Auth + Storage + Realtime) |
| Cliente Supabase | `@supabase/ssr` — clientes separados para browser, Server Components e middleware |
| Deploy | Vercel (`.vercel/` presente no projeto) |
| Lint | ESLint 9 + `eslint-config-next` |

Não há: Storybook, shadcn/ui, styled-components/CSS Modules, biblioteca de ícones, `next/image` (capas usam `<img>` puro por virem de 3 origens não previstas em `remotePatterns`).

## 3. Arquitetura de rotas

3 rotas no total, organização por rota em `app/` e organização flat por tipo em `components/`:

| Rota | Tipo | Proteção | Descrição |
|---|---|---|---|
| `/` | Server Component | Requer sessão (redireciona para `/scan` se anônimo) | Dashboard com métricas e gráficos |
| `/scan` | Client Component | Pública (mostra tela de login se sem sessão) | Scanner de ISBN + formulário de cadastro + login/signup/recuperação de senha |
| `/books` | Client Component | Requer sessão (gate no proxy) | Listagem, busca, exportação CSV e exclusão de livros |
| `/reset-password` | Client Component | Pública (valida token da URL) | Definição de nova senha vinda do link de e-mail |

### Gate de autenticação
`src/proxy.ts` (Next 16 renomeou `middleware.ts` → `proxy.ts`, função exportada deve se chamar `proxy`) delega para `src/lib/supabase/middleware.ts`. Rotas protegidas por prefixo: `/` (exato) e `/books` (prefixo). Sem sessão válida, redireciona para `/scan`.

## 4. Modelo de dados (Supabase / Postgres)

> Script executável e atualizado do schema atual (apenas o necessário hoje, sem histórico de migração): [`supabase/schema.sql`](./supabase/schema.sql).

### Tabela `public.books` (ativa)
```
id              uuid PK, default gen_random_uuid()
operator_id     uuid FK -> auth.users(id) ON DELETE CASCADE, NOT NULL   -- dono do registro
isbn            text (nullable)
title           text NOT NULL
author          text
publisher       text
published_year  integer
genre           text
synopsis        text
cover_url       text
copies          integer NOT NULL DEFAULT 1, CHECK (copies >= 1)
reading_status  text NOT NULL DEFAULT 'quero_ler', CHECK IN ('quero_ler','lendo','lido')
rating          smallint, CHECK (1..5)
finished_at     timestamptz
added_at        timestamptz NOT NULL DEFAULT now()
updated_at      timestamptz NOT NULL DEFAULT now()
```
Índices: `operator_id`, `isbn`, `reading_status`, `added_at DESC`, `genre`.

**RLS:** habilitado. Policies restringem INSERT/SELECT/UPDATE/DELETE a `auth.uid() = operator_id` — isolamento total entre usuários, sem exceção de "admin lê tudo".

**Realtime:** tabela `books` publicada em `supabase_realtime` (usada pelo contador ao vivo do dashboard).

### Storage — bucket `book-covers`
Bucket público para leitura (thumbnails sem signed URL). Escrita restrita à pasta do próprio operador via convenção de path `{operator_id}/{uuid}.jpg`. Usado como fallback para foto de capa quando as APIs de livro não retornam imagem.

### Tabelas legadas (não usadas pelo app atual)
`public.sessions` e `public.scans` — do fluxo antigo de "produtos escaneados por operador". Mantidas no banco, não referenciadas em nenhum código ativo. Podem ser removidas manualmente (`DROP TABLE`) quando confirmado que os dados históricos não são mais necessários.

## 5. Funcionalidades

### 5.1 Autenticação
- Login, cadastro (signup) e "esqueci minha senha" — tudo na tela `/scan` (3 sub-modos: `login` / `signup` / `forgot`).
- Login e signup usam `fetch` direto contra o endpoint REST do Supabase Auth (`/auth/v1/token`, `/auth/v1/signup`) em vez do SDK `supabase-js`, para contornar um bug de encoding observado no SDK; a sessão obtida é então gravada via `supabase.auth.setSession()` para ir para cookies (SSR-aware) em vez de localStorage.
- Recuperação de senha: envia e-mail com link para `/reset-password?...`; a página processa o token da URL automaticamente (`detectSessionInUrl`) e permite definir nova senha (mínimo 6 caracteres).
- Confirmação de e-mail está desativada no projeto Supabase — signup já autentica direto quando a API retorna tokens.
- Logout limpa recursos de câmera (scanner + captura de capa) antes de encerrar a sessão.

### 5.2 Scanner de ISBN (`/scan`)
Máquina de estados: `loading → login | scanning → lookup → review → scanning`.

1. **`scanning`**: câmera ativa via `BrowserMultiFormatReader` (zxing), restrita aos formatos EAN-13/EAN-8. Ao detectar um código, para a captura e dispara a busca.
2. **`lookup`**: busca metadados do livro por ISBN (ver 5.3), com spinner de carregamento.
3. **`review`**: formulário pré-preenchido (ou vazio, com aviso, se não encontrado) para revisão/edição antes de salvar — título, autor, editora, ano, gênero, sinopse, capa, cópias, status de leitura, nota (1-5 estrelas, só se status = "lido"), data de conclusão.
   - Permite tirar foto da capa pela própria câmera (reutiliza o `<video>`, troca o decoder do zxing por um `getUserMedia` simples) quando a busca automática não retorna imagem. A foto é enviada para o bucket `book-covers`.
   - Também é possível pular o scanner e abrir o formulário direto ("Adicionar sem código de barras").
4. Ao salvar, o livro é colocado numa fila local (`localStorage`, ver 5.4) e uma tentativa de sync imediato é disparada.

Vibração tátil (`navigator.vibrate`) ao confirmar um registro, se suportado pelo dispositivo.

### 5.3 Lookup de metadados por ISBN (`src/lib/booksApi.ts`)
- Duas fontes consultadas **em paralelo** (não em sequência, para não somar as latências no pior caso): Google Books API (primária) e Open Library (fallback), com timeout de 12s cada (ajustado empiricamente — 6s cortava respostas legítimas da Open Library, observadas entre 1.7s e 9.1s).
- Resultado: o da Google Books se disponível, senão o da Open Library, senão `null` (usuário preenche manualmente).
- Chave da Google Books API é opcional (`NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY`); sem ela, funciona sem key (rate limit mais baixo) e ainda tem a Open Library como rede de segurança.
- Nenhum OCR é usado em nenhum lugar do app — apenas leitura de código de barras + APIs externas.

### 5.4 Fila offline-first (`src/lib/bookQueue.ts`)
- Livros escaneados são gravados primeiro em `localStorage` (chave `my_library_book_queue`), não diretamente no Supabase — o app funciona sem conexão.
- Sincronização:
  - Imediata após cada `handleSave`.
  - Automática a cada 15 segundos enquanto a sessão está ativa.
  - Manual via botão "Enviar" na tela de scanning.
- Sync usa `fetch` direto contra `POST {SUPABASE_URL}/rest/v1/books` com o `access_token` da sessão (mesmo padrão anti-bug do login), header `Prefer: resolution=merge-duplicates,return=minimal`. Em caso de sucesso, os itens sincronizados são removidos da fila local; em caso de erro, permanecem para nova tentativa.
- Contadores visíveis: total de livros na sessão atual do scanner e quantidade pendente de sync.

### 5.5 Dashboard (`/`)
Server Component, busca todos os livros do usuário autenticado (`getMetrics`) e deriva:

| Widget | Componente | Métrica |
|---|---|---|
| Meta de leitura anual | `ScoreGauge` | Livros com status "lido" e `finished_at` no ano corrente vs. meta fixa (`YEARLY_READING_GOAL = 24`, hardcoded) |
| Funil de leitura | `ScanFunnel` | Contagem por status: quero_ler → lendo → lido |
| Contador em tempo real | `RealtimeCounter` | Livros adicionados hoje; incrementa via subscription Realtime (`postgres_changes` INSERT filtrado por `operator_id`) sem precisar recarregar a página |
| Cards de métrica | `MetricCard` | Total de exemplares (soma de `copies`), livros lidos, lendo agora |
| Distribuição de notas | `RatingDistributionChart` | Histograma 1★-5★ dos livros lidos |
| Livros adicionados por dia | `DailyChart` | Série temporal dos últimos 30 dias |
| Heatmap gênero × mês | `GenreMonthHeatmap` | Top 6 gêneros × últimos 6 meses |
| Distribuição por gênero | `GenreDonutChart` | Top 6 gêneros + agregado "Outros" |
| Alertas | `AlertsTable` | Livros com status "lendo" parados há ≥30 dias sem atualização (severidade "alta" ≥60 dias) |
| Recomendações | `RecommendationsList` | Heurísticas simples em texto: fila "quero ler" grande (≥5), gênero favorito, livros lidos sem nota, nenhum livro adicionado em 30 dias |
| Top autores | lista inline | Top 10 autores por contagem de livros |

Toda a agregação é feita em memória no servidor a cada request (`export const dynamic = 'force-dynamic'`) — sem cache, sem materialized views, sem paginação (assume volume pessoal, não escala para milhares de registros sem revisão).

### 5.6 Gestão de livros (`/books`)
- Tabela paginada (50 por página) com busca por título/autor (`ilike`, client-side query builder do Supabase).
- Exportação CSV de todos os resultados (respeitando o filtro de busca ativo, ignorando a paginação) — gerado no client via Blob/`URL.createObjectURL`.
- Exclusão individual (Server Action `deleteBook`) e exclusão em massa com confirmação de dois passos (Server Action `deleteAllBooks`).
- Exibe capa (thumbnail via `<img>`), status com badge colorido, nota em estrelas, data formatada em `pt-BR`.

## 6. Convenções de design (ver `FIGMA.md` para detalhes)

- **Sem design system formal ainda**: sem tokens, sem biblioteca de componentes, sem ícones. Qualquer trabalho de design (ex.: import do Figma) deve *originar* essas convenções, não mapear para algo existente.
- Tokens de cor/fonte vivem em `src/app/globals.css` via `@theme` (Tailwind v4 CSS-first), não em `tailwind.config.ts`.
- Componentes: `src/components/` flat, sem subpastas; function components, `'use client'` quando necessário, interface `Props` tipada, estilização 100% via `className` do Tailwind (sem `cva`/`clsx`).
- Fonte: Geist / Geist Mono via `next/font/google`.
- Idioma da interface: português brasileiro (pt-BR) em todos os textos, formatação de datas e números.
- Paleta visual: dark mode fixo (fundo escuro `bg-surface`/`bg-slate-900`, texto branco), independente da preferência do sistema — não é dark/light mode dinâmico apesar do CSS ter um bloco `prefers-color-scheme`.

## 7. Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anônima (client-side, RLS aplica isolamento) |
| `SUPABASE_SERVICE_ROLE_KEY` | Presente no `.env.example` | Não usada no código ativo hoje (RLS por `operator_id` cobre os casos atuais); reservada caso um acesso privilegiado no servidor seja necessário no futuro |
| `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` | Não | Sem ela, lookup usa só Open Library como fallback |

## 8. O que explicitamente NÃO existe hoje

Para deixar claro o escopo atual e evitar assumir funcionalidades que não foram implementadas:

- Sem multi-usuário compartilhado / biblioteca em grupo / papéis (admin vs. operador) — é 100% dados isolados por `operator_id`.
- Sem OCR de capa ou texto.
- Sem app mobile nativo — é PWA-like (manifest.json, ícones, `apple-web-app` meta tags) rodando em navegador mobile.
- Sem testes automatizados no repositório (nenhum arquivo `*.test.*` ou `*.spec.*` encontrado).
- Sem CI/CD configurado além do deploy Vercel padrão.
- Sem internacionalização — pt-BR fixo.
- Meta de leitura anual (`YEARLY_READING_GOAL = 24`) é uma constante hardcoded, não configurável pelo usuário na UI.

## 9. Pontos de atenção conhecidos (do próprio código)

- `next/image` deliberadamente não usado para capas — 3 origens de imagem não previstas (Google Books CDN, Open Library, Supabase Storage); revisar se compensar configurar `remotePatterns`.
- Login/signup/recover/sync usam `fetch` direto em vez do SDK `supabase-js` por causa de um bug de encoding observado — manter esse padrão ao tocar nesse código.
- Ícones: se um design especificar ícones, escolher **uma** abordagem (SVG inline ou `lucide-react`) e não misturar.
- Tabelas `scans`/`sessions` legadas seguem no banco; remover manualmente após confirmar que os dados antigos não são mais necessários.
