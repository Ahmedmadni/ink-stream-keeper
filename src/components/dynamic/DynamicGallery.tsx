/** Simple responsive image gallery — used by any type with image arrays. */
export function DynamicGallery({
  images, onRemove,
}: { images: { url: string; alt?: string; id?: string }[]; onRemove?: (id: string) => void }) {
  if (images.length === 0) {
    return <p className="rounded-2xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">لا توجد صور.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {images.map((img, idx) => (
        <div key={img.id ?? idx} className="group relative overflow-hidden rounded-2xl bg-card shadow-card">
          <img src={img.url} alt={img.alt ?? ""} className="aspect-square w-full object-cover" />
          {onRemove && img.id ? (
            <button type="button" onClick={() => onRemove(img.id!)}
              className="absolute top-1 left-1 rounded-full bg-destructive/90 px-2 py-0.5 text-[10px] font-bold text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100">
              حذف
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}