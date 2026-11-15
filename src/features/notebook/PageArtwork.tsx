import { InkMark } from "./InkMark";
import { pageLayout, paperStyle } from "./page-layout";
import { safePageHtml } from "./rich-content";
import { stickerIcon } from "./sticker-packs";
import type { NotebookPage } from "./model";

/** Read-only sheet used by PDF and the vault. Same geometry/CSS as the editor. */
export function PageArtwork({ page, remoteImages = false }: { page: NotebookPage; remoteImages?: boolean }) {
  const layout = pageLayout(page);
  return <div className="notebook-sheet relative isolate overflow-hidden" data-notebook-paper={page.paper} dir="rtl"
    style={{ ...paperStyle(page), width: layout.width, height: layout.height, fontFamily: '"IBM Plex Sans Arabic",sans-serif' }}>
    {page.paper === "cornell" && <>
      <div className="absolute bottom-[15%] right-[28%] top-[8%] w-px bg-[#c8aeb5]"/>
      <div className="absolute bottom-[15%] inset-x-0 h-px bg-[#c8aeb5]"/>
    </>}
    <div className="notebook-content absolute z-10">
      <div className="prose-mf" dir="rtl" dangerouslySetInnerHTML={{ __html: safePageHtml(page.html, remoteImages) }}/>
    </div>
    <svg viewBox={`0 0 1000 ${1000 * layout.aspect}`} preserveAspectRatio="none" aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 size-full">
      {page.strokes.map((stroke) => <InkMark key={stroke.id} stroke={stroke} aspect={layout.aspect}/>)}
    </svg>
    {page.stickers.map((sticker) => {
      const Icon = stickerIcon(sticker.kind);
      return <span key={sticker.id} aria-label={"ملصق " + sticker.kind}
        className="absolute z-30 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-white"
        style={{ left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`, width: `${sticker.scale * 100}%`, aspectRatio: "1 / 1", backgroundColor: sticker.color }}>
        <Icon size="67%" strokeWidth={2.2}/>
      </span>;
    })}
  </div>;
}
