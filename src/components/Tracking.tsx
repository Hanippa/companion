export default function Tracking() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white/90 p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border/60 bg-background p-8 text-right shadow-none">
        <div className="space-y-2" dir="rtl">
          <div className="text-sm font-medium text-muted-foreground">זמן תיקון משוער</div>
          <div className="text-4xl font-semibold tracking-tight md:text-5xl">20/01/2026</div>
          <div className="text-sm leading-6 text-muted-foreground">
            רכיב זה נשמר כרגע כתצוגת placeholder פנימית עד שיוחלף בזרימת מעקב מלאה.
          </div>
        </div>
      </div>
    </div>
  )
}
