import type { HTMLAttributes } from "react";

import { TERMINATION_TYPE_COLORS, type TerminationType } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function TerminationTypeBadge({
  type,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { type: TerminationType }) {
  return (
    <span
      className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", className)}
      style={{
        color: TERMINATION_TYPE_COLORS[type],
        backgroundColor: `${TERMINATION_TYPE_COLORS[type]}18`,
      }}
      {...props}
    >
      {type}
    </span>
  );
}
