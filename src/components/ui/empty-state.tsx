import * as React from "react"
import { cn } from "cn"

// Порожній список чи розклад: заголовок (що порожньо) і одне речення, що далі. Замість таблиці, не поруч із нею.
function EmptyState({
  title,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "title"> & { title: string }) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed border-input px-4 py-8 text-center text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <strong className="font-semibold text-foreground">{title}</strong>
      {children ? <span>{children}</span> : null}
    </div>
  )
}

export { EmptyState }
