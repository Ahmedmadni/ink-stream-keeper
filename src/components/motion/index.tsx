import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Premium-restrained motion primitives.
 * All transitions <= 250ms and respect prefers-reduced-motion.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function PageFade({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function SectionExpand({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return open ? <div>{children}</div> : null;
  return (
    <motion.div
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: 0.22, ease: EASE }}
      style={{ overflow: "hidden" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * CardLift — subtle hover elevation on pointer devices.
 * Passes through motion props so you can compose it with children props.
 */
export function CardLift({ children, className, ...rest }: HTMLMotionProps<"div"> & { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : { y: -2 }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      transition={{ duration: 0.18, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export { useReducedMotion };