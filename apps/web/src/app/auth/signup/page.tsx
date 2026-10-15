'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerSchema } from '@campusconnect/types';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { ApiError } from '@/lib/apiClient';

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({ body: {
      email: values.get('email'), password: values.get('password'), displayName: values.get('displayName'),
    } });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Check your details.'); return; }
    setBusy(true); setError('');
    try {
      await signUp(parsed.data.body.email, parsed.data.body.password, parsed.data.body.displayName);
      router.push('/');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Unable to create your account.'); }
    finally { setBusy(false); }
  }
  return <section className="form-card">
    <span className="eyebrow">Make campus yours</span><h1>Create an account</h1><p>Join the people making things happen on campus.</p>
    <form onSubmit={submit}>
      <label className="form-field">Your name<input className="input" name="displayName" autoComplete="name" minLength={2} maxLength={60} required /></label>
      <label className="form-field">Email address<input className="input" name="email" type="email" autoComplete="email" required /></label>
      <label className="form-field">Password<div className="password-field"><input className="input" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72} required /><button className="icon-button password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Button className="button-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
    </form>
    <div className="helper-link">Already a member? <Link href="/auth/login">Sign in</Link></div>
  </section>;
}
