import { InkLayer } from "./InkMark";
import { pageLayout, paperStyle } from "./page-layout";
import { PaperGuides, paperTextStyle } from "./PaperGuides";
import { safePageHtml } from "./rich-content";
import { StickerArtwork, stickerStyle, ScienceAttribution } from "./StickerArtwork";
import type { NotebookPage } from "./model";

/** Read-only sheet used by PDF and the vault. Same geometry/CSS as the editor. */
export function PageArtwork({ page, remoteImages = false }: { page: NotebookPage; remoteImages?: boolean }) {
  const layout = pageLayout(page);
  return <div className="notebook-sheet relative isolate overflow-hidden" data-notebook-paper={page.paper} dir="rtl"
    style={{ ...paperStyle(page), ...paperTextStyle(page), width: layout.width, height: layout.height, fontFamily: '"IBM Plex Sans Arabic",sans-serif' }}>
    <PaperGuides page={page}/>
    <div className="notebook-content absolute z-10">
      <div className="prose-mf" dir="rtl" dangerouslySetInnerHTML={{ __html: safePageHtml(page.html, remoteImages) }}/>
    </div>
    <svg viewBox={`0 0 1000 ${1000 * layout.aspect}`} preserveAspectRatio="none" aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 size-full">
      <InkLayer strokes={page.strokes} aspect={layout.aspect}/>
    </svg>
    {page.stickers.map((sticker) => {
      return <span key={sticker.id} aria-label={"ملصق " + sticker.kind}
        className="absolute z-30 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-white"
        style={stickerStyle(sticker)}>
        <StickerArtwork sticker={sticker}/>
      </span>;
    })}
    <ScienceAttribution page={page}/>
  </div>;
}
