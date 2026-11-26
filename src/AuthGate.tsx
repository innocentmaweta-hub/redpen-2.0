import { FormEvent, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import { supabase } from './lib/supabase';
import './auth.css';

const WORKSPACE_KEY = 'redpen-2.0-workspace-v1';

export default function AuthGate() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!alive) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError('');
      setNotice('');
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!session?.user) {
      localStorage.removeItem(WORKSPACE_KEY);
      setWorkspaceReady(false);
      return;
    }
    setWorkspaceReady(false);
    let channel: any = null;
    (async () => {
      const { data, error: loadError } = await supabase
        .from('workspace_snapshots')
        .select('data')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!alive) return;
      if (loadError) {
        setError(`Could not load your cloud workspace: ${loadError.message}`);
      } else if (data?.data) {
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data.data));
      } else {
        localStorage.removeItem(WORKSPACE_KEY);
      }
      setWorkspaceReady(true);
      channel = supabase.channel(`redpen-workspace-${session.user.id}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'workspace_snapshots',
          filter: `user_id=eq.${session.user.id}`,
        }, payload => {
          const incoming = JSON.stringify(payload.new.data);
          if (incoming && localStorage.getItem(WORKSPACE_KEY) !== incoming) {
            localStorage.setItem(WORKSPACE_KEY, incoming);
            window.dispatchEvent(new CustomEvent('redpen-cloud-workspace', { detail: payload.new.data }));
          }
        })
        .subscribe();
    })();
    return () => {
      alive = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [session?.user.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (authError) throw authError;
        if (!data.session) setNotice('Account created. Check your email for the confirmation link, then sign in.');
        else setNotice('Your RedPen account is ready.');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (resetError) setError(resetError.message);
    else setNotice('Password reset instructions have been sent if that email belongs to an account.');
    setBusy(false);
  };

  if (checking || (session && !workspaceReady)) {
    return <div className="auth-loading"><div className="auth-spinner" /><span>Preparing your secure RedPen workspace…</span></div>;
  }

  if (session) return <App user={session.user} />;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo"><img src="/favicon.png" alt="" /><span>RedPen</span></div>
        <span className="auth-eyebrow">YOUR ASSESSMENT WORKSPACE</span>
        <h1>{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p className="auth-intro">Sign in to securely access your workbooks, student assessments and grading records from any device.</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>Full name<input value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" required placeholder="Your name" /></label>}
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required placeholder="At least 8 characters" /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {notice && <div className="auth-notice" role="status">{notice}</div>}
          <button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
        {mode === 'signin' && <button className="auth-link" type="button" onClick={resetPassword} disabled={busy}>Forgot password?</button>}
        <div className="auth-switch">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          <button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice(''); }}>
            {mode === 'signin' ? 'Create account' : 'Sign in'}
          </button>
        </div>
        <div className="auth-security">Protected by Supabase authentication and private cloud storage.</div>
      </section>
    </main>
  );
}
