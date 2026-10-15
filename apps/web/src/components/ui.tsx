'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <article className={`card ${className}`}>{children}</article>;
}

export function Badge({ children }: { children: ReactNode }) {
  const label = typeof children === 'string' ? children.toUpperCase() : '';
  const tone = label === 'ACTIVE' || label === 'COMPLETED' || label === 'RESOLVED'
    ? 'success'
    : label === 'ON_HOLD' || label === 'IDEA' || label === 'PENDING' || label === 'DRAFT'
      ? 'warning'
      : label === 'PUBLISHED' || label === 'STUDENT' || label === 'ADMIN'
        ? 'info'
        : label === 'CANCELLED' || label === 'DISMISSED' || label === 'DISABLED'
          ? 'error'
          : 'neutral';
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src
    ? <img className="avatar" src={src} alt={`${name}'s avatar`} loading="lazy" />
    : <span className="avatar avatar-fallback" aria-label={`${name}'s avatar`}>{name.trim().charAt(0).toUpperCase()}</span>;
}

export function LoadingSpinner({ label = 'Loading' }: { label?: string }) {
  return <span className="spinner-wrap" role="status"><span className="spinner" /><span>{label}</span></span>;
}

export function Pagination({
  page,
  total,
  limit,
  onChange,
}: {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return <nav className="pagination" aria-label="Pagination">
    <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
    <span>Page {page} of {pages}</span>
    <Button variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
  </nav>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>
      {children}
    </section>
  </div>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return <span className="tooltip" tabIndex={0} aria-label={label}><span className="tooltip-trigger">{children}</span><span role="tooltip">{label}</span></span>;
}
