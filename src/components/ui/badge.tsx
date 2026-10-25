import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const GLYPH =
  "before:size-2 before:shrink-0 before:rounded-full before:border-[1.5px] before:border-current before:content-['']"

// Статус — завжди слово + знак перед ним (DESIGN.md, розділ 2): зрозумілий і без кольору.
const badgeVariants = cva(
  `inline-flex h-5.5 w-fit shrink-0 items-center gap-2 rounded-sm border border-transparent px-2 text-xs font-medium whitespace-nowrap ${GLYPH}`,
  {
    variants: {
      variant: {
        free: "border-border bg-status-free text-status-free-foreground",
        held: "bg-status-held text-status-held-foreground before:bg-[linear-gradient(90deg,currentColor_50%,transparent_50%)]",
        confirmed: "bg-status-confirmed text-status-confirmed-foreground before:bg-current",
        expired: "bg-status-expired text-status-expired-foreground before:size-[7px] before:rotate-45 before:rounded-[1px]",
        past: "bg-status-past text-status-past-foreground before:h-0 before:w-2 before:rounded-none before:border-0 before:border-t-[1.5px]",
      },
    },
    defaultVariants: {
      variant: "free",
    },
  }
)

function Badge({
  className,
  variant = "free",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
