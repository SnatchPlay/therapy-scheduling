import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const alertVariants = cva(
  "relative grid w-full gap-0.5 rounded-lg border px-4 py-3 text-left text-sm",
  {
    variants: {
      variant: {
        default: "border-primary bg-card text-card-foreground",
        destructive:
          "border-destructive bg-card text-card-foreground *:data-[slot=alert-title]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// Роль за варіантом: помилка — alert, інформація — status; сторінка може перевизначити (повідомлення після redirect — alert).
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-semibold",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle }
