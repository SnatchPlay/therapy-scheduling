import { Badge } from "@/components/ui/badge"

const VARIANTS = {
  Free: "free",
  Held: "held",
  Confirmed: "confirmed",
  Expired: "expired",
  Past: "past",
} as const

type StatusBadgeProps = Omit<React.ComponentProps<typeof Badge>, "variant" | "children"> & { status: string | null }

// Статус слота чи утримання з бази → Badge: слово завжди, знак і колір — з варіанта (DESIGN.md, розділ 2).
// Невідомий статус не має «вільного» вигляду: показуємо слово нейтральним «Past».
export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  const variant = status && status in VARIANTS ? VARIANTS[status as keyof typeof VARIANTS] : "past"
  return (
    <Badge variant={variant} {...props}>
      {status}
    </Badge>
  )
}
