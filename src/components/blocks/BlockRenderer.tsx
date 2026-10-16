import { Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import {
  orderedBlocks,
  getBlockEntry,
  type BlockComposition,
  type BlockRendererProps,
} from "@/lib/engine/blocks";
import { BlockChrome } from "./BlockChrome";
import { ensureBlockRegistry } from "./registry";

// Keep this as an explicit function call. A side-effect-only import is removed
// from production builds because package.json declares `sideEffects: false`.
ensureBlockRegistry();

/**
 * BlockRenderer — reads an ordered composition of blocks and renders
 * them via the registry. Heavy blocks defer mounting until they scroll
 * into view (IntersectionObserver).
 */
export function BlockRenderer<Ctx>({
  blocks,
  context,
}: {
  blocks: BlockComposition<Ctx>;
  context: Ctx;
}) {
  const list = orderedBlocks(blocks, context);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {list.map((block) => {
        const entry = getBlockEntry(block.type);
        if (!entry) {
          return (
            <BlockChrome key={block.id} block={block} title={`Block: ${block.type}`}>
              <p className="text-xs text-destructive">لا يوجد Renderer مسجّل لهذا النوع.</p>
            </BlockChrome>
          );
        }
        const title = block.title ?? entry.title;
        const Comp = entry.component as ComponentType<
          BlockRendererProps<Record<string, unknown>, Ctx>
        >;
        const isLazy = block.lazy ?? entry.defaultLazy;
        return (
          <BlockChrome key={block.id} block={block} title={title}>
            {isLazy ? (
              <LazyMount>
                <Suspense fallback={<div className="h-16 animate-pulse rounded-xl bg-muted/40" />}>
                  <Comp block={block} context={context} />
                </Suspense>
              </LazyMount>
            ) : (
              <Comp block={block} context={context} />
            )}
          </BlockChrome>
        );
      })}
    </div>
  );
}

function LazyMount({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    <div ref={ref}>
      {shown ? children : <div className="h-12 animate-pulse rounded-xl bg-muted/30" />}
    </div>
  );
}
