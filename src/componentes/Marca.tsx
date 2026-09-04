/** El rayado del truco: cuatro palitos y la diagonal que cierra los cinco. */
export function Marca({ className = 'h-6 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 86 26" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M4 3v20M14 3v20M24 3v20M34 3v20M2 22 36 4" />
        <path d="M52 3v20M62 3v20M72 3v20" />
      </g>
    </svg>
  )
}
