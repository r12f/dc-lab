import type { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'primary' | 'danger' | 'ghost';

export function Button({ variant = 'default', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`btn btn-${variant} ${className ?? ''}`} {...rest} />;
}
