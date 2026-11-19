import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** One accessible icon control shared by the writing workspace. */
export function ToolButton({ label, active, className, children, ...props }: ButtonProps & { label: string; active?: boolean }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant={active ? "default" : "ghost"} size="icon"
            aria-label={label} title={label}
            className={cn("size-11 shrink-0 rounded-lg shadow-none", !active && "text-muted-foreground", className)}
            {...props}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}