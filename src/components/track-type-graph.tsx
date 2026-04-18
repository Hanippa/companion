import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDown, Flag, Route, TimerReset, ZoomIn, ZoomOut } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { NormalizedTrackSchema, TrackNode } from "@/lib/track-schema"
import { cn } from "@/lib/utils"

type TrackTypeGraphProps = {
  schema: NormalizedTrackSchema | null
  className?: string
  highlightedNodeId?: string | null
  onNodeSelect?: (nodeId: string) => void
}

type PositionedLine = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

const getNodeDepths = (schema: NormalizedTrackSchema | null) => {
  if (!schema || schema.nodes.length === 0) return new Map<string, number>()

  const nodeMap = new Map(schema.nodes.map((node) => [node.id, node] as const))
  const depths = new Map<string, number>()
  const startNodeId = schema.start_node_id && nodeMap.has(schema.start_node_id)
    ? schema.start_node_id
    : schema.nodes[0].id

  const queue: Array<{ id: string; depth: number }> = [{ id: startNodeId, depth: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    const existingDepth = depths.get(current.id)
    if (existingDepth !== undefined && existingDepth <= current.depth) {
      continue
    }

    depths.set(current.id, current.depth)
    const node = nodeMap.get(current.id)
    if (!node) continue

    node.next_nodes.forEach((connection) => {
      if (nodeMap.has(connection.node_id)) {
        queue.push({ id: connection.node_id, depth: current.depth + 1 })
      }
    })
  }

  let fallbackDepth = Math.max(...depths.values(), -1) + 1
  schema.nodes.forEach((node) => {
    if (!depths.has(node.id)) {
      depths.set(node.id, fallbackDepth)
      fallbackDepth += 1
    }
  })

  return depths
}

function GraphNodeCard({
  node,
  isStart,
  isEnd,
  isHighlighted,
  registerRef,
  onSelect,
}: {
  node: TrackNode
  isStart: boolean
  isEnd: boolean
  isHighlighted: boolean
  registerRef: (element: HTMLDivElement | null) => void
  onSelect?: () => void
}) {
  return (
    <Card
      ref={registerRef}
      onClick={onSelect}
      className={cn(
        "relative border-border/70 shadow-none transition-colors",
        onSelect && "cursor-pointer hover:border-primary/35",
        isHighlighted && "border-primary/50 bg-primary/5"
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="font-medium leading-6">{node.title}</div>
            {node.description ? (
              <div className="text-sm leading-6 text-muted-foreground">
                {node.description}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {isStart ? (
              <Badge variant="default" className="rounded-full gap-1">
                <Flag className="size-3.5" />
                התחלה
              </Badge>
            ) : null}
            {isEnd ? (
              <Badge variant="secondary" className="rounded-full gap-1">
                <Route className="size-3.5" />
                סיום
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full gap-1">
            <TimerReset className="size-3.5" />
            SLA {typeof node.sla === "number" ? `${node.sla} דק׳` : "לא הוגדר"}
          </Badge>
          {typeof node.sla_modifier === "number" && node.sla_modifier > 0 ? (
            <Badge variant="secondary" className="rounded-full">
              +{node.sla_modifier} דק׳ modifier
            </Badge>
          ) : null}
        </div>

        {node.next_nodes.length > 0 ? (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="text-xs font-medium tracking-wide text-muted-foreground">
              המשכים אפשריים
            </div>
            <div className="flex flex-wrap gap-2">
              {node.next_nodes.map((connection) => (
                <Badge
                  key={connection.id}
                  variant="outline"
                  className="rounded-full gap-1.5 border-dashed"
                >
                  <ArrowDown className="size-3.5" />
                  {connection.label}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function TrackTypeGraph({
  schema,
  className,
  highlightedNodeId = null,
  onNodeSelect,
}: TrackTypeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())
  const [lines, setLines] = useState<PositionedLine[]>([])
  const [zoom, setZoom] = useState(1)

  const rows = useMemo(() => {
    if (!schema) return []

    const depths = getNodeDepths(schema)
    const grouped = new Map<number, TrackNode[]>()

    schema.nodes.forEach((node) => {
      const depth = depths.get(node.id) ?? 0
      grouped.set(depth, [...(grouped.get(depth) ?? []), node])
    })

    return Array.from(grouped.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([depth, nodes]) => ({
        depth,
        nodes: [...nodes].sort((left, right) => left.title.localeCompare(right.title, "he")),
      }))
  }, [schema])

  useEffect(() => {
    if (!schema || !containerRef.current) {
      setLines([])
      return
    }

    const computeLines = () => {
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const nextLines: PositionedLine[] = []

      schema.nodes.forEach((node) => {
        const source = nodeRefs.current.get(node.id)
        if (!source) return

        const sourceRect = source.getBoundingClientRect()
        const x1 = sourceRect.left + sourceRect.width / 2 - containerRect.left
        const y1 = sourceRect.bottom - containerRect.top

        node.next_nodes.forEach((connection) => {
          const target = nodeRefs.current.get(connection.node_id)
          if (!target) return

          const targetRect = target.getBoundingClientRect()
          nextLines.push({
            id: `${node.id}-${connection.id}-${connection.node_id}`,
            x1,
            y1,
            x2: targetRect.left + targetRect.width / 2 - containerRect.left,
            y2: targetRect.top - containerRect.top,
          })
        })
      })

      setLines(nextLines)
    }

    const frame = requestAnimationFrame(computeLines)
    const observer = new ResizeObserver(() => computeLines())

    if (containerRef.current) observer.observe(containerRef.current)
    nodeRefs.current.forEach((element) => observer.observe(element))
    window.addEventListener("resize", computeLines)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", computeLines)
    }
  }, [schema, rows])

  if (!schema || schema.nodes.length === 0) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground",
          className
        )}
      >
        עדיין לא הוגדרו צמתים לסוג המסלול הזה.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-x-auto rounded-2xl border border-border/70 bg-card p-4",
        className
      )}
    >
      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-2 py-1 shadow-sm">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => setZoom((current) => Math.max(0.7, Number((current - 0.1).toFixed(2))))}
          aria-label="הקטנת תצוגה"
        >
          <ZoomOut className="size-4" />
        </button>
        <div className="min-w-12 text-center text-xs font-medium">{Math.round(zoom * 100)}%</div>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => setZoom((current) => Math.min(1.6, Number((current + 0.1).toFixed(2))))}
          aria-label="הגדלת תצוגה"
        >
          <ZoomIn className="size-4" />
        </button>
      </div>

      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
        {lines.map((line) => (
          <line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-border"
          />
        ))}
      </svg>

      <div
        className="relative z-10 flex min-w-[56rem] origin-top-center flex-col gap-8 pt-12"
        dir="rtl"
        style={{ transform: `scale(${zoom})` }}
      >
        {rows.map((row, rowIndex) => (
          <div key={row.depth} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-medium tracking-[0.18em] text-muted-foreground">
                שכבה {rowIndex + 1}
              </div>
              <div className="text-xs text-muted-foreground">{row.nodes.length} צמתים</div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {row.nodes.map((node) => (
              <GraphNodeCard
                key={node.id}
                node={node}
                isStart={schema.start_node_id === node.id}
                isEnd={schema.end_node_id === node.id}
                isHighlighted={highlightedNodeId === node.id}
                onSelect={onNodeSelect ? () => onNodeSelect(node.id) : undefined}
                registerRef={(element) => {
                  if (element) {
                    nodeRefs.current.set(node.id, element)
                  } else {
                    nodeRefs.current.delete(node.id)
                  }
                }}
              />
            ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
