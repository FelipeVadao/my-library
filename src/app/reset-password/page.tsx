'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Status = 'checking' | 'ready' | 'invalid' | 'saving' | 'done';

export default function ResetPasswordPage() {
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  // O link do e-mail carrega o token na própria URL; o cliente SSR-aware
  // (detectSessionInUrl) já processa isso sozinho ao montar.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'ready' : 'invalid');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setStatus('ready');
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  async function handleSave() {
    if (password.length < 6) {
      setErr('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setErr('');
    setStatus('saving');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErr(error.message);
      setStatus('ready');
      return;
    }
    setStatus('done');
    setTimeout(() => router.push('/scan'), 1500);
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-6">
      <div className="lamp-glow w-full max-w-sm bg-paper-card rounded-lg p-8 border border-border shadow-[0_1px_3px_rgba(0,0,0,0.35)]">
        <h1 className="font-serif text-2xl font-bold text-ink text-center mb-1">Nova senha</h1>

        {status === 'checking' && (
          <p className="text-ink-muted text-sm text-center mt-6">Verificando link...</p>
        )}

        {status === 'invalid' && (
          <p className="text-oxblood-bright text-sm text-center mt-6">
            Link inválido ou expirado. Peça um novo link em &quot;Esqueci minha senha&quot;.
          </p>
        )}

        {(status === 'ready' || status === 'saving') && (
          <>
            <p className="text-ink-muted text-sm text-center mb-8">Escolha sua nova senha</p>
            <input
              type="password"
              placeholder="Nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full bg-paper border border-border rounded-md px-4 py-3 text-ink placeholder-ink-muted mb-4 focus:outline-none focus:border-brass-strong"
            />
            {err && <p className="text-oxblood-bright text-sm text-center mb-4">{err}</p>}
            <button
              onClick={handleSave}
              disabled={status === 'saving'}
              className="w-full bg-brass-strong hover:bg-brass-strong-hover disabled:opacity-50 text-on-accent font-semibold py-3 rounded-md transition"
            >
              {status === 'saving' ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </>
        )}

        {status === 'done' && (
          <p className="text-forest text-sm text-center mt-6">
            Senha atualizada! Redirecionando...
          </p>
        )}
      </div>
    </div>
  );
}
