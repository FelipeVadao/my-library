'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Star, ArrowLeft, Loader2 } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import type { IScannerControls } from '@zxing/browser';
import { createClient } from '@/lib/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import { enqueue, getAll, removeByIds, pendingCount, type QueuedBook } from '@/lib/bookQueue';
import { lookupIsbn } from '@/lib/booksApi';
import type { ReadingStatus } from '@/lib/supabase/types';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

// ── helpers ──────────────────────────────────────────────────────────────────

function randomId() {
  return crypto.randomUUID();
}

// Uses direct fetch + session.access_token to bypass supabase-js token refresh issues
async function syncQueue(session: Session): Promise<{ synced: number; error: string | null }> {
  if (!navigator.onLine) return { synced: 0, error: 'Sem conexão com a internet' };
  const pending = getAll();
  if (pending.length === 0) return { synced: 0, error: null };

  try {
    const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
    const sbKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

    const res = await fetch(`${sbUrl}/rest/v1/books`, {
      method: 'POST',
      headers: {
        'apikey': sbKey,
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(pending),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({})) as { message?: string; error?: string };
      return { synced: 0, error: `Erro ${res.status}: ${errData.message || errData.error || 'Falha ao salvar'}` };
    }
    removeByIds(pending.map((b) => b.id));
    return { synced: pending.length, error: null };
  } catch (err) {
    return { synced: 0, error: err instanceof Error ? err.message : 'Erro de conexão' };
  }
}

const EMPTY_FORM = {
  isbn: '',
  title: '',
  author: '',
  publisher: '',
  publishedYear: '',
  genre: '',
  synopsis: '',
  coverUrl: '',
  copies: '1',
  readingStatus: 'quero_ler' as ReadingStatus,
  rating: 0,
  finishedYear: '',
  pageCount: '',
  language: '',
};

// ── component ────────────────────────────────────────────────────────────────

type View = 'loading' | 'login' | 'scanning' | 'lookup' | 'review';

export default function ScanPage() {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient>(() => createClient());

  const [view, setView]           = useState<View>('loading');
  const [session, setSession]     = useState<Session | null>(null);
  const [authMode, setAuthMode]   = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loginErr, setLoginErr]   = useState('');
  const [authMsg, setAuthMsg]     = useState('');
  const [logging, setLogging]     = useState(false);

  const [bookCount, setBookCount] = useState(0);
  const [pending, setPending]     = useState(0);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState('');
  const [cameraErr, setCameraErr] = useState('');
  const [lookupNotFound, setLookupNotFound] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [capturingCover, setCapturingCover] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const controlsRef    = useRef<IScannerControls | null>(null);
  const coverStreamRef = useRef<MediaStream | null>(null);
  const processingRef  = useRef(false);

  // auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setView(data.session ? 'scanning' : 'login');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setView(s ? 'scanning' : 'login');
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const handleIsbnDetected = useCallback(async (isbn: string) => {
    setView('lookup');
    setLookupNotFound(false);
    const result = await lookupIsbn(isbn);
    if (result) {
      setForm({
        isbn,
        title: result.title,
        author: result.author ?? '',
        publisher: result.publisher ?? '',
        publishedYear: result.publishedYear ? String(result.publishedYear) : '',
        genre: result.genre ?? '',
        synopsis: result.synopsis ?? '',
        coverUrl: result.coverUrl ?? '',
        copies: '1',
        readingStatus: 'quero_ler',
        rating: 0,
        finishedYear: '',
        pageCount: result.pageCount ? String(result.pageCount) : '',
        language: result.language ?? '',
      });
    } else {
      setLookupNotFound(true);
      setForm({ ...EMPTY_FORM, isbn });
    }
    setView('review');
  }, []);

  // barcode scanning while on the 'scanning' view
  useEffect(() => {
    if (view !== 'scanning' || !videoRef.current) return;
    let cancelled = false;
    setCameraErr('');
    processingRef.current = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);
    const codeReader = new BrowserMultiFormatReader(hints);

    codeReader
      .decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (!result || processingRef.current || cancelled) return;
        processingRef.current = true;
        controlsRef.current?.stop();
        controlsRef.current = null;
        handleIsbnDetected(result.getText());
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCameraErr(err instanceof Error ? err.message : 'Erro ao acessar câmera');
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [view, handleIsbnDetected]);

  const handleManualEntry = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setLookupNotFound(false);
    setForm(EMPTY_FORM);
    setView('review');
  }, []);

  const handleCancelReview = useCallback(() => {
    setForm(EMPTY_FORM);
    setLookupNotFound(false);
    setView('scanning');
  }, []);

  // cover photo capture — reuses the same <video> element, but with a plain
  // getUserMedia stream instead of the zxing barcode decoder
  const handleStartCoverCapture = useCallback(async () => {
    setCapturingCover(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      coverStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setCameraErr(err instanceof Error ? err.message : 'Erro ao acessar câmera');
      setCapturingCover(false);
    }
  }, []);

  const handleCancelCoverCapture = useCallback(() => {
    coverStreamRef.current?.getTracks().forEach((t) => t.stop());
    coverStreamRef.current = null;
    setCapturingCover(false);
  }, []);

  const handleCaptureCoverPhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !session) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    coverStreamRef.current?.getTracks().forEach((t) => t.stop());
    coverStreamRef.current = null;
    setCapturingCover(false);
    setUploadingCover(true);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setUploadingCover(false);
        return;
      }
      const path = `${session.user.id}/${randomId()}.jpg`;
      const { error } = await supabase.storage
        .from('book-covers')
        .upload(path, blob, { contentType: 'image/jpeg' });

      if (!error) {
        const { data } = supabase.storage.from('book-covers').getPublicUrl(path);
        setForm((f) => ({ ...f, coverUrl: data.publicUrl }));
      }
      setUploadingCover(false);
    }, 'image/jpeg', 0.85);
  }, [session, supabase]);

  const handleSave = useCallback(() => {
    const title = form.title.trim();
    if (!title || !session) return;

    const book: QueuedBook = {
      id: randomId(),
      isbn: form.isbn.trim() || null,
      title,
      author: form.author.trim() || null,
      publisher: form.publisher.trim() || null,
      published_year: form.publishedYear ? Number(form.publishedYear) : null,
      genre: form.genre.trim() || null,
      synopsis: form.synopsis.trim() || null,
      cover_url: form.coverUrl || null,
      copies: Number(form.copies) || 1,
      reading_status: form.readingStatus,
      rating: form.readingStatus === 'lido' && form.rating > 0 ? form.rating : null,
      finished_at: form.readingStatus === 'lido' && form.finishedYear
        ? new Date(Number(form.finishedYear), 0, 1).toISOString()
        : null,
      favorite: false,
      started_at: null,
      page_count: form.pageCount ? Number(form.pageCount) : null,
      current_page: null,
      language: form.language.trim() || null,
      added_at: new Date().toISOString(),
      operator_id: session.user.id,
    };

    enqueue(book);
    setBookCount((c) => c + 1);
    setPending(pendingCount());

    if (navigator.vibrate) navigator.vibrate(80);

    syncQueue(session).then(({ synced, error }) => {
      setPending(pendingCount());
      if (error) setSyncMsg(`Erro ao enviar: ${error}`);
      else if (synced > 0) setSyncMsg('');
    });

    setForm(EMPTY_FORM);
    setLookupNotFound(false);
    setView('scanning');
  }, [form, session]);

  // periodic sync every 15s
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => {
      syncQueue(session).then(({ synced, error }) => {
        setPending(pendingCount());
        if (error) setSyncMsg(`Erro ao enviar: ${error}`);
        else if (synced > 0) setSyncMsg('');
      });
    }, 15000);
    return () => clearInterval(id);
  }, [session]);

  // ── login ──
  async function handleLogin() {
    setLoginErr('');
    setLogging(true);
    try {
      const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
      const sbKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

      const authRes = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': sbKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const authData = await authRes.json() as {
        access_token?: string;
        refresh_token?: string;
        user?: { id: string };
        error?: string;
        error_description?: string;
        msg?: string;
      };

      if (!authRes.ok) {
        setLoginErr(authData.error_description || authData.error || authData.msg || `Erro ${authRes.status}`);
        setLogging(false);
        return;
      }

      const { access_token, refresh_token } = authData;
      if (!access_token || !refresh_token) {
        setLoginErr('Resposta inválida do servidor');
        setLogging(false);
        return;
      }

      // Grava a sessão no cliente SSR-aware (vai para cookie, não localStorage)
      const { error: sessionErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionErr) setLoginErr(sessionErr.message);
      else router.push('/');
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : 'Erro de conexão');
    }
    setLogging(false);
  }

  // ── cadastro ──
  // Mesmo padrão de fetch direto do login (evita o bug de encoding do supabase-js)
  async function handleSignup() {
    setLoginErr('');
    setAuthMsg('');
    setLogging(true);
    try {
      const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
      const sbKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

      const res = await fetch(`${sbUrl}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'apikey': sbKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json() as {
        access_token?: string;
        refresh_token?: string;
        error?: string;
        error_description?: string;
        msg?: string;
      };

      if (!res.ok) {
        setLoginErr(data.error_description || data.error || data.msg || `Erro ${res.status}`);
        setLogging(false);
        return;
      }

      if (data.access_token && data.refresh_token) {
        // confirmação de e-mail desativada no projeto — já entra direto
        const { error: sessionErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionErr) setLoginErr(sessionErr.message);
        else router.push('/');
      } else {
        setAuthMsg('Conta criada! Confira seu e-mail para confirmar antes de entrar.');
        setAuthMode('login');
        setPassword('');
      }
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : 'Erro de conexão');
    }
    setLogging(false);
  }

  // ── recuperação de senha ──
  async function handleForgotPassword() {
    setLoginErr('');
    setAuthMsg('');
    setLogging(true);
    try {
      const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
      const sbKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
      const redirectTo = `${window.location.origin}/reset-password`;

      const res = await fetch(`${sbUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: 'POST',
        headers: { 'apikey': sbKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error_description?: string; error?: string; msg?: string };
        setLoginErr(data.error_description || data.error || data.msg || `Erro ${res.status}`);
        setLogging(false);
        return;
      }

      setAuthMsg('Se esse e-mail estiver cadastrado, enviamos um link para redefinir a senha.');
      setAuthMode('login');
    } catch (err) {
      setLoginErr(err instanceof Error ? err.message : 'Erro de conexão');
    }
    setLogging(false);
  }

  async function handleManualSync() {
    if (!session || syncing) return;
    setSyncing(true);
    setSyncMsg('');
    const { synced, error } = await syncQueue(session);
    setPending(pendingCount());
    if (error) setSyncMsg(`Erro ao enviar: ${error}`);
    else setSyncMsg(synced > 0 ? `${synced} livro(s) enviado(s)!` : 'Nada pendente');
    setSyncing(false);
  }

  async function handleLogout() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    coverStreamRef.current?.getTracks().forEach((t) => t.stop());
    coverStreamRef.current = null;
    await supabase.auth.signOut();
  }

  // ── render ──
  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brass-strong" />
      </div>
    );
  }

  if (view === 'login') {
    const titles = { login: 'My Library', signup: 'Criar conta', forgot: 'Recuperar senha' };
    const subtitles = {
      login: 'Escaneie o ISBN dos seus livros',
      signup: 'Comece a montar sua biblioteca',
      forgot: 'Enviamos um link para redefinir sua senha',
    };

    function switchMode(mode: 'login' | 'signup' | 'forgot') {
      setAuthMode(mode);
      setLoginErr('');
      setAuthMsg('');
    }

    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6">
        <div className="lamp-glow w-full max-w-sm bg-paper-card rounded-lg p-8 border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
          <h1 className="font-serif text-2xl font-bold text-ink text-center mb-1">{titles[authMode]}</h1>
          <p className="text-ink-muted text-sm text-center mb-8">{subtitles[authMode]}</p>

          <label htmlFor="login-email" className="sr-only">E-mail</label>
          <input
            id="login-email"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && authMode === 'forgot' && handleForgotPassword()}
            className="w-full bg-paper border border-border rounded-md px-4 py-3 text-ink placeholder-ink-muted mb-3 focus:outline-none focus:border-brass-strong"
          />

          {authMode !== 'forgot' && (
            <>
            <label htmlFor="login-password" className="sr-only">Senha</label>
            <input
              id="login-password"
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (authMode === 'signup' ? handleSignup() : handleLogin())}
              className="w-full bg-paper border border-border rounded-md px-4 py-3 text-ink placeholder-ink-muted mb-4 focus:outline-none focus:border-brass-strong"
            />
            </>
          )}

          {authMsg && (
            <p className="text-forest text-sm text-center mb-4">{authMsg}</p>
          )}
          {loginErr && (
            <p className="text-oxblood-bright text-sm text-center mb-4">{loginErr}</p>
          )}

          {authMode === 'login' && (
            <button
              onClick={handleLogin}
              disabled={logging}
              className="w-full bg-brass-strong hover:bg-brass-strong-hover disabled:opacity-50 text-on-accent font-semibold py-3 rounded-md transition"
            >
              {logging ? 'Entrando...' : 'Entrar'}
            </button>
          )}
          {authMode === 'signup' && (
            <button
              onClick={handleSignup}
              disabled={logging}
              className="w-full bg-brass-strong hover:bg-brass-strong-hover disabled:opacity-50 text-on-accent font-semibold py-3 rounded-md transition"
            >
              {logging ? 'Criando...' : 'Criar conta'}
            </button>
          )}
          {authMode === 'forgot' && (
            <button
              onClick={handleForgotPassword}
              disabled={logging}
              className="w-full bg-brass-strong hover:bg-brass-strong-hover disabled:opacity-50 text-on-accent font-semibold py-3 rounded-md transition"
            >
              {logging ? (
                <span className="inline-flex items-center gap-2 justify-center"><Loader2 size={14} className="animate-spin" />Enviando...</span>
              ) : 'Enviar link de recuperação'}
            </button>
          )}

          <div className="flex items-center justify-between mt-4 text-xs">
            {authMode === 'login' ? (
              <>
                <button onClick={() => switchMode('signup')} className="text-brass-strong hover:text-brass-strong-hover transition">
                  Criar conta
                </button>
                <button onClick={() => switchMode('forgot')} className="text-ink-muted hover:text-ink transition">
                  Esqueci minha senha
                </button>
              </>
            ) : (
              <button onClick={() => switchMode('login')} className="flex items-center gap-1 text-brass-strong hover:text-brass-strong-hover transition">
                <ArrowLeft size={14} aria-hidden="true" /> Voltar ao login
              </button>
            )}
          </div>
        </div>

        <Link href="/" className="mt-6 flex items-center gap-1 text-ink-muted hover:text-ink text-sm transition">
          <ArrowLeft size={14} aria-hidden="true" /> Voltar ao Dashboard
        </Link>

        <div className="mt-4">
          <ThemeToggle />
        </div>
      </div>
    );
  }

  const showCamera = view === 'scanning' || capturingCover;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* header */}
      <div className="bg-paper-card px-4 pt-12 pb-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-1 text-brass-strong text-sm font-medium shrink-0">
          <ArrowLeft size={16} aria-hidden="true" /> Dashboard
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-ink font-bold text-base leading-tight">Scanner</h1>
          <p className="text-ink-muted text-xs truncate">{session?.user.email}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="bg-brass-strong text-on-accent text-xs font-semibold px-3 py-1 rounded-full">
            {bookCount} livros
          </span>
          {pending > 0 && (
            <span className="bg-brass text-on-accent text-xs font-semibold px-3 py-1 rounded-full">
              {pending} pend.
            </span>
          )}
        </div>
      </div>

      {/* camera */}
      <div className="relative flex-1 bg-black">
        <video
          ref={videoRef}
          autoPlay
          className={`w-full h-full object-cover ${showCamera ? '' : 'hidden'}`}
          style={{ minHeight: showCamera ? '40vh' : undefined }}
          playsInline
          muted
        />

        {view === 'scanning' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {cameraErr ? (
              <div className="bg-oxblood/90 rounded-lg px-6 py-5 max-w-xs text-center mx-4 pointer-events-auto">
                <p className="text-ink font-semibold mb-2">Câmera indisponível</p>
                <p className="text-ink/90 text-sm mb-2">{cameraErr}</p>
                <p className="text-ink/65 text-xs">Permita o acesso à câmera nas configurações do navegador e recarregue a página.</p>
              </div>
            ) : (
              <div className="w-64 h-40 relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brass rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brass rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brass rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brass rounded-br-lg" />
              </div>
            )}
          </div>
        )}

        {view === 'lookup' && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
            <Loader2 size={40} className="animate-spin text-brass" />
            <span className="text-ink text-sm font-medium">Buscando informações do livro...</span>
          </div>
        )}

        {capturingCover && (
          <div className="absolute bottom-4 left-4 right-4 flex gap-3">
            <button
              onClick={handleCancelCoverCapture}
              className="flex-1 py-3 rounded-md font-semibold text-sm bg-tan hover:bg-border text-ink transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleCaptureCoverPhoto}
              className="flex-1 py-3 rounded-md font-semibold text-sm bg-brass-strong hover:bg-brass-strong-hover text-on-accent transition"
            >
              Capturar
            </button>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="bg-paper-card px-4 pt-3 pb-8 overflow-y-auto">
        {view === 'review' ? (
          <div className="mb-3 bg-paper-card rounded-lg p-4 space-y-3">
            {lookupNotFound && (
              <p className="text-brass-strong text-xs">
                Livro não encontrado automaticamente — preencha os dados manualmente.
              </p>
            )}

            {form.coverUrl && !capturingCover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.coverUrl}
                alt={form.title ? `Capa de ${form.title}` : 'Capa do livro'}
                className="h-32 rounded-lg mx-auto"
              />
            )}

            <div>
              <label htmlFor="scan-isbn" className="block text-ink-muted text-xs mb-1">ISBN</label>
              <input
                id="scan-isbn"
                type="text"
                value={form.isbn}
                onChange={(e) => setForm((f) => ({ ...f, isbn: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>

            <div>
              <label htmlFor="scan-title" className="block text-ink-muted text-xs mb-1">Título</label>
              <input
                id="scan-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>

            <div>
              <label htmlFor="scan-author" className="block text-ink-muted text-xs mb-1">Autor</label>
              <input
                id="scan-author"
                type="text"
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="scan-publisher" className="block text-ink-muted text-xs mb-1">Editora</label>
                <input
                  id="scan-publisher"
                  type="text"
                  value={form.publisher}
                  onChange={(e) => setForm((f) => ({ ...f, publisher: e.target.value }))}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                />
              </div>
              <div>
                <label htmlFor="scan-published-year" className="block text-ink-muted text-xs mb-1">Ano</label>
                <input
                  id="scan-published-year"
                  type="number"
                  value={form.publishedYear}
                  onChange={(e) => setForm((f) => ({ ...f, publishedYear: e.target.value }))}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                />
              </div>
            </div>

            <div>
              <label htmlFor="scan-genre" className="block text-ink-muted text-xs mb-1">Gênero</label>
              <input
                id="scan-genre"
                type="text"
                value={form.genre}
                onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>

            <div>
              <label htmlFor="scan-synopsis" className="block text-ink-muted text-xs mb-1">Sinopse</label>
              <textarea
                id="scan-synopsis"
                value={form.synopsis}
                onChange={(e) => setForm((f) => ({ ...f, synopsis: e.target.value }))}
                rows={2}
                className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="scan-page-count" className="block text-ink-muted text-xs mb-1">Páginas</label>
                <input
                  id="scan-page-count"
                  type="number"
                  min={1}
                  value={form.pageCount}
                  onChange={(e) => setForm((f) => ({ ...f, pageCount: e.target.value }))}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                />
              </div>
              <div>
                <label htmlFor="scan-language" className="block text-ink-muted text-xs mb-1">Idioma</label>
                <input
                  id="scan-language"
                  type="text"
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                />
              </div>
            </div>

            {!form.coverUrl && !capturingCover && (
              <button
                onClick={handleStartCoverCapture}
                disabled={uploadingCover}
                className="w-full py-2 rounded-md text-sm font-semibold bg-tan hover:bg-border disabled:opacity-40 text-ink transition"
              >
                {uploadingCover ? (
                  <span className="inline-flex items-center gap-2 justify-center"><Loader2 size={14} className="animate-spin" />Enviando foto...</span>
                ) : 'Tirar foto da capa'}
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="scan-copies" className="block text-ink-muted text-xs mb-1">Cópias</label>
                <input
                  id="scan-copies"
                  type="number"
                  min={1}
                  value={form.copies}
                  onChange={(e) => setForm((f) => ({ ...f, copies: e.target.value }))}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                />
              </div>
              <div>
                <label htmlFor="scan-reading-status" className="block text-ink-muted text-xs mb-1">Status de leitura</label>
                <select
                  id="scan-reading-status"
                  value={form.readingStatus}
                  onChange={(e) => {
                    const next = e.target.value as ReadingStatus;
                    setForm((f) => ({
                      ...f,
                      readingStatus: next,
                      finishedYear: next === 'lido' && !f.finishedYear ? String(new Date().getFullYear()) : f.finishedYear,
                    }));
                  }}
                  className="w-full bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                >
                  <option value="quero_ler">Quero ler</option>
                  <option value="lendo">Lendo</option>
                  <option value="lido">Lido</option>
                </select>
              </div>
            </div>

            {form.readingStatus === 'lido' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-ink-muted text-xs mb-1">Nota</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, rating: n }))}
                        aria-label={`Avaliar com ${n} estrela(s)`}
                        className={n <= form.rating ? 'text-brass-strong' : 'text-border'}
                      >
                        <Star size={22} fill={n <= form.rating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="scan-finished-year" className="block text-ink-muted text-xs mb-1">Ano de leitura</label>
                  <div className="flex gap-2 items-center">
                    <input
                      id="scan-finished-year"
                      type="number"
                      value={form.finishedYear}
                      onChange={(e) => setForm((f) => ({ ...f, finishedYear: e.target.value }))}
                      className="flex-1 bg-paper border border-border rounded-md px-3 py-2 text-ink focus:outline-none focus:border-brass-strong"
                    />
                    {form.finishedYear && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, finishedYear: '' }))}
                        className="shrink-0 text-xs text-ink-muted hover:text-ink bg-tan hover:bg-border px-2 py-2 rounded-md transition"
                      >
                        Não sei
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-ink-muted mt-1">Preenchido automaticamente com o ano atual.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCancelReview}
                className="flex-1 py-3 rounded-md font-semibold text-sm bg-tan hover:bg-border text-ink transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={!form.title.trim()}
                className="flex-1 py-3 rounded-md font-semibold text-sm bg-forest hover:bg-forest-hover disabled:opacity-40 text-on-accent transition"
              >
                Confirmar e salvar
              </button>
            </div>
          </div>
        ) : view === 'scanning' ? (
          <>
            {syncMsg && (
              <p className={`text-xs text-center mb-3 ${syncMsg.startsWith('Erro') ? 'text-oxblood-bright' : 'text-forest'}`}>
                {syncMsg}
              </p>
            )}

            <button
              onClick={handleManualEntry}
              className="w-full mb-3 py-3 rounded-md font-semibold text-sm bg-tan hover:bg-border text-ink transition"
            >
              Adicionar sem código de barras
            </button>

            <div className="flex gap-3 mb-3">
              <button
                onClick={handleManualSync}
                disabled={syncing || pending === 0}
                className="flex-1 py-3 rounded-md font-semibold text-sm bg-tan hover:bg-border disabled:opacity-40 text-ink transition"
              >
                {syncing ? (
                  <span className="inline-flex items-center gap-2 justify-center"><Loader2 size={14} className="animate-spin" />Enviando...</span>
                ) : pending > 0 ? `Enviar (${pending})` : 'Enviar'}
              </button>
              <Link
                href="/books"
                className="flex-1 py-3 rounded-md font-semibold text-sm bg-tan hover:bg-border text-ink transition text-center"
              >
                Meus livros
              </Link>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-2 rounded-md text-sm font-semibold bg-paper hover:bg-tan text-ink-muted transition"
            >
              Sair
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
