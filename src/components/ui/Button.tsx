import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

/** §12.5 buttons: 36px height, 8px radius, 14px medium text. */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-hover active:bg-accent-active',
  secondary: 'border border-strong text-primary hover:bg-surface-2',
  ghost: 'text-secondary hover:bg-surface-2 hover:text-primary',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-control px-4 text-body font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  )
}
