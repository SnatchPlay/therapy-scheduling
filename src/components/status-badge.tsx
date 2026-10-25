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
// Невідомий чи порожній статус не має «вільного» вигляду: слово лишається, а вигляд нейтральний, як «Past».
export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  const known = status !== null && Object.hasOwn(VARIANTS, status)
  return (
    <Badge variant={known ? VARIANTS[status as keyof typeof VARIANTS] : "past"} {...props}>
      {status ?? "Unknown"}
    </Badge>
  )
}
