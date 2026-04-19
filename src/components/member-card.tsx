import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { getAvatarInitials } from "@/lib/avatar"
import { cn } from "@/lib/utils"

type MemberCardProps = {
  name: string
  meta?: string | null
  avatarUrl?: string | null
  initialsSource?: string | null
  badgeLabel?: string | null
  className?: string
  avatarClassName?: string
  muted?: boolean
}

export function MemberCard({
  name,
  meta,
  avatarUrl,
  initialsSource,
  badgeLabel,
  className,
  avatarClassName,
  muted = false,
}: MemberCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3",
        muted
          ? "border-border/50 bg-muted/10 opacity-75"
          : "border-border/60 bg-muted/15",
        className
      )}
    >
      <Avatar className={cn("size-10 rounded-xl", avatarClassName)}>
        <AvatarImage
          className="rounded-xl"
          src={avatarUrl ?? undefined}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <AvatarFallback className="rounded-xl">
          {getAvatarInitials(initialsSource || name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate font-medium">{name}</div>
          {badgeLabel ? (
            <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
              {badgeLabel}
            </Badge>
          ) : null}
        </div>
        {meta ? <div className="truncate text-xs text-muted-foreground">{meta}</div> : null}
      </div>
    </div>
  )
}
