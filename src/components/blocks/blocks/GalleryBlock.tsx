import { DynamicGallery } from "@/components/dynamic/DynamicGallery";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type GalleryBlockProps = { images: { url: string; alt?: string; id?: string }[] };

export function GalleryBlock({ block }: BlockRendererProps<GalleryBlockProps>) {
  return <DynamicGallery images={block.props.images} />;
}
export default GalleryBlock;