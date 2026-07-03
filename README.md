# My Library

App pessoal de catalogação de livros: escaneie o código de barras (ISBN) de um livro com a câmera do celular, os metadados são buscados automaticamente (título, autor, capa, sinopse etc.) e o livro é adicionado à sua biblioteca. Um dashboard mostra estatísticas de leitura — meta anual, funil de status, gêneros, avaliações, autores mais lidos.

> Uso pessoal/individual: não é multi-tenant, não há papéis de admin/operador — cada usuário autenticado só vê os próprios livros.

## Funcionalidades

- **Login / cadastro / recuperação de senha** via Supabase Auth.
- **Scanner de ISBN** pela câmera (`/scan`), com leitura de código de barras EAN-13/EAN-8.
- **Busca automática de metadados** por ISBN (Google Books + Open Library como fallback, consultadas em paralelo).
- **Fila offline-first**: livros escaneados são gravados primeiro em `localStorage` e sincronizados com o Supabase em segundo plano — funciona sem conexão.
- **Foto de capa pela câmera** quando a busca automática não retorna imagem.
- **Dashboard** (`/`) com meta de leitura anual, funil de status, contador em tempo real, distribuição de notas, série temporal, heatmap gênero × mês, alertas de livros parados e recomendações.
- **Gestão de livros** (`/books`): listagem paginada, busca, exportação CSV, exclusão individual ou em massa.
- PWA-like (manifest, ícones), interface 100% em português (pt-BR).

## Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + TypeScript |
| Estilo | Tailwind CSS v4 (config CSS-first via `@theme`) |
| Gráficos | Recharts |
| Leitura de código de barras | `@zxing/browser` + `@zxing/library` |
| Backend / dados | Supabase (Postgres + Auth + Storage + Realtime) |
| Deploy | Vercel |

## Como rodar localmente

Pré-requisitos: Node.js 20+, uma conta [Supabase](https://supabase.com) (gratuita) e um projeto criado nela.

```bash
git clone <url-do-repositorio>
cd registra-dashboard
npm install
```

Copie o arquivo de exemplo de variáveis de ambiente e preencha com as suas chaves:

```bash
cp .env.local.example .env.local
```

| Variável | Obrigatória | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave anônima (client-side, isolamento via RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Não | Reservada para uso futuro no servidor; não usada no código hoje |
| `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY` | Não | Sem ela, a busca de metadados usa só a Open Library |

No projeto Supabase, execute o schema em [`supabase/schema.sql`](./supabase/schema.sql) no SQL Editor — cria a tabela `books` (com RLS habilitado, restringindo acesso por `operator_id = auth.uid()`) e o bucket de Storage público `book-covers`. Documentação completa do modelo de dados em [`SPEC.md`](./SPEC.md#4-modelo-de-dados-supabase--postgres).

Depois, rode o servidor de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) — você será redirecionado para `/scan` até fazer login.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Sobe o build de produção |
| `npm run lint` | ESLint |

## Deploy

O projeto está preparado para deploy na [Vercel](https://vercel.com). Configure as mesmas variáveis de ambiente listadas acima no painel do projeto.

## Documentação

- [`SPEC.md`](./SPEC.md) — especificação técnica completa (arquitetura, modelo de dados, funcionalidades, pontos de atenção).
- [`FIGMA.md`](./FIGMA.md) — convenções de design e integração com Figma MCP.

## Status

Projeto pessoal em desenvolvimento ativo. Sem CI configurado além do deploy padrão da Vercel.
