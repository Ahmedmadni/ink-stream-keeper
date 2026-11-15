import { memo } from "react";
import type { CSSProperties } from "react";
import type { NotebookPage, PageSticker } from "./model";
import { stickerIcon } from "./sticker-packs";

export function stickerStyle(sticker: PageSticker): CSSProperties {
  const cutout = sticker.presentation === "cutout" || (sticker.presentation === undefined && sticker.kind.startsWith("sci-"));
  return {
    left: sticker.x * 100 + "%", top: sticker.y * 100 + "%", width: sticker.scale * 100 + "%",
    aspectRatio: "1 / 1", backgroundColor: cutout ? "transparent" : sticker.color,
    color: cutout ? sticker.color : "#ffffff", borderColor: cutout ? "transparent" : "#ffffff",
    transform: `rotate(${sticker.rotation ?? 0}deg)`,
    boxShadow: cutout ? "none" : undefined,
    filter: cutout ? "drop-shadow(0 2px 2px rgba(20,40,70,.18))" : undefined,
  };
}
export const StickerArtwork = memo(function StickerArtwork({ sticker }: { sticker: PageSticker }) {
  const Icon = stickerIcon(sticker.kind);
  const cutout = sticker.presentation === "cutout" || (sticker.presentation === undefined && sticker.kind.startsWith("sci-"));
  return <Icon size={cutout ? "94%" : "67%"} strokeWidth={2.2}/>;
});
export function ScienceAttribution({ page }: { page: NotebookPage }) {
  if (!page.stickers.some((s) => s.kind.startsWith("sci-"))) return null;
  return <p dir="ltr" className="pointer-events-none absolute bottom-[1%] inset-x-[6%] z-40 rounded bg-white/90 px-1 text-left text-[8px] leading-3 text-[#607188]"
    data-sticker-attribution="scisvg">SciSVG — Saveena Solanki · CC BY 4.0 · github.com/SaveenaSolanki/SciSVG · Resized / rotated</p>;
}
