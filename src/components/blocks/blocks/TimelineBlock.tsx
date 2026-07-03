import { DynamicTimeline, type TimelineEntry } from "@/components/dynamic/DynamicTimeline";
import type { BlockRendererProps } from "@/lib/engine/blocks";

export type TimelineBlockProps = { entries: TimelineEntry[] };

export function TimelineBlock({ block }: BlockRendererProps<TimelineBlockProps>) {
  return <DynamicTimeline entries={block.props.entries} />;
}
export default TimelineBlock;