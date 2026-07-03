import type { ReactNode } from "react";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type CustomBlockProps = { render: () => ReactNode };

export function CustomBlock({ block }: BlockRendererProps<CustomBlockProps>) {
  return <>{block.props.render()}</>;
}