import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({ variant = 'primary', size = 'md', className, ...rest }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45';
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3.5 text-base',
  }[size];
  const variants = {
    primary:
      'bg-nebula text-white hover:bg-nebula-soft shadow-[0_8px_30px_-10px_#7c3aed]',
    ghost: 'text-dust hover:text-starlight hover:bg-white/6',
    outline: 'border border-ridge text-starlight hover:border-nebula-soft hover:bg-white/5',
    danger: 'border border-rose-400/35 text-rose-200 hover:bg-rose-500/15',
  }[variant];
  return <button className={cx(base, sizes, variants, className)} {...rest} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-dust">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-xl border border-ridge bg-black/25 px-3.5 py-2.5 text-starlight placeholder:text-faint transition-colors focus:border-nebula-soft focus:outline-none';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputBase, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputBase, 'resize-y leading-relaxed', className)} {...rest} />;
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('glass rounded-2xl', className)}>{children}</section>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        'inline-block size-4 animate-spin rounded-full border-2 border-white/25 border-t-white',
        className,
      )}
    />
  );
}

/** Aviso de erro em linha, com a voz da interface: direto e acionável. */
export function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) {
  const styles =
    tone === 'error'
      ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
      : 'border-cyan/25 bg-cyan/10 text-cyan';
  return (
    <p role="status" className={cx('rounded-xl border px-3.5 py-2.5 text-sm', styles)}>
      {children}
    </p>
  );
}
