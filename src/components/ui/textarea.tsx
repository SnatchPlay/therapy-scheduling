import * as React from "react"
import { cn } from "cn"

// Поле для довгого тексту: ті самі межа, тло й фокус, що в Input (DESIGN.md, розділ 5).
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm text-card-foreground outline-offset-1 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
