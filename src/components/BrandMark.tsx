/** MemoFlow's shared, theme-aware note-and-flow mark. */
export function BrandMark({ className = "size-10" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground ${className}`}>
      <svg viewBox="0 0 32 32" fill="none" className="size-3/4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 7H10a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-5" />
        <path d="M11 12h7M11 17h5M11 21h4M20 11h7m-3-3 3 3-3 3" />
      </svg>
    </span>
  );
}