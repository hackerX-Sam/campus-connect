'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginSchema } from '@campusconnect/types';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/apiClient';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({ body: { email: values.get('email'), password: values.get('password') } });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check your details.'); return; }
    setBusy(true); setError('');
    try { await signIn(parsed.data.body.email, parsed.data.body.password); router.push('/'); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to sign in. Try again.'); }
    finally { setBusy(false); }
  }
  return <section className="form-card">
    <span className="eyebrow">Welcome back</span><h1>Sign in</h1><p>Pick up where your campus community left off.</p>
    <form onSubmit={submit}>
      <label className="form-field">Email address<input className="input" name="email" type="email" autoComplete="email" required /></label>
      <label className="form-field">Password<div className="password-field"><input className="input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required /><button className="icon-button password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button className="button-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
    </form>
    <div className="helper-link">New to CampusConnect? <Link href="/auth/signup">Create an account</Link></div>
  </section>;
}
