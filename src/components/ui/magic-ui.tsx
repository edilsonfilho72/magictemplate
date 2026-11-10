import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const variants = {
    primary: 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  };
  return <button type={type} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`} {...props} />;
}

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} resize-y leading-relaxed ${className}`} {...props} />;
}

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
    <div><h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">{description}</p></div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </header>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'loading'; children: ReactNode }) {
  const colors = { info: 'border-blue-100 bg-blue-50 text-blue-800', error: 'border-red-100 bg-red-50 text-red-800', success: 'border-emerald-100 bg-emerald-50 text-emerald-800', loading: 'border-slate-200 bg-slate-50 text-slate-600' };
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${colors[tone]}`}>
    {tone === 'loading' && <span aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 motion-reduce:animate-none" />}
    <div>{children}</div>
  </div>;
}

export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
    <span aria-hidden="true" className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600"><Icon name="template" /></span>
    <h3 className="text-base font-semibold text-slate-800">{title}</h3>
    <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
    {children && <div className="mt-5">{children}</div>}
  </div>;
}

export type IconName = 'message' | 'template' | 'settings' | 'plus' | 'upload' | 'search' | 'edit' | 'trash' | 'copy' | 'spark';

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    message: <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />,
    template: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h4" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    edit: <><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15v5Z" /></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></>,
  };
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>{paths[name]}</svg>;
}
