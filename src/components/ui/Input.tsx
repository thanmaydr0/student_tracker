import { forwardRef, type InputHTMLAttributes, type ElementType, useState } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  icon?: ElementType
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon: Icon, className, id, onFocus, onBlur, ...props }, ref) => {
    const [focused, setFocused] = useState(false)
    const hasValue = props.value !== undefined && props.value !== ''
    const isFloating = focused || hasValue

    const inputId = id || label.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        <div className="group relative">
          {/* Icon */}
          {Icon && (
            <div
              className={cn(
                'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200',
                focused ? 'text-brand-700' : 'text-brand-400',
                error && 'text-red-400'
              )}
            >
              <Icon size={18} strokeWidth={1.8} />
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'peer w-full rounded-xl border bg-white px-4 pb-2.5 pt-5 text-sm text-slate-800 outline-none transition-all duration-200',
              'placeholder-transparent',
              'focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10',
              Icon ? 'pl-11' : 'pl-4',
              error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                : 'border-brand-200 hover:border-brand-300',
              className
            )}
            placeholder={label}
            onFocus={(e) => {
              setFocused(true)
              onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              onBlur?.(e)
            }}
            {...props}
          />

          {/* Floating label */}
          <label
            htmlFor={inputId}
            className={cn(
              'pointer-events-none absolute transition-all duration-200',
              Icon ? 'left-11' : 'left-4',
              isFloating
                ? 'top-1.5 text-[11px] font-medium'
                : 'top-1/2 -translate-y-1/2 text-sm',
              focused && !error
                ? 'text-brand-600'
                : error
                  ? 'text-red-400'
                  : 'text-brand-400'
            )}
          >
            {label}
          </label>
        </div>

        {/* Error message */}
        {error && (
          <p className="mt-1.5 pl-1 text-xs font-medium text-red-500">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
