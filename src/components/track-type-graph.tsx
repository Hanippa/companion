import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Flag, Route } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { NormalizedTrackSchema, TrackNode } from "@/lib/track-schema"
import { cn } from "@/lib/utils"

type TrackTypeGraphProps = {
  schema: NormalizedTrackSchema | null
  className?: string
  highlightedNodeId?: string | null
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
}: {
  node: TrackNode
  isStart: boolean
  isEnd: boolean
  isHighlighted: boolean
  registerRef: (element: HTMLDivElement | null) => void
}) {
  return (
    <Card
      ref={registerRef}
      className={cn(
        "relative border-border/70 shadow-none transition-colors",
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
                  <ArrowLeft className="size-3.5" />
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
}: TrackTypeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())
  const [lines, setLines] = useState<PositionedLine[]>([])

  const columns = useMemo(() => {
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
        const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top

        node.next_nodes.forEach((connection) => {
          const target = nodeRefs.current.get(connection.node_id)
          if (!target) return

          const targetRect = target.getBoundingClientRect()
          nextLines.push({
            id: `${node.id}-${connection.id}-${connection.node_id}`,
            x1,
            y1,
            x2: targetRect.left + targetRect.width / 2 - containerRect.left,
            y2: targetRect.top + targetRect.height / 2 - containerRect.top,
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
  }, [schema, columns])

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

      <div className="relative z-10 flex min-w-max gap-4" dir="ltr">
        {columns.map((column) => (
          <div key={column.depth} className="flex w-80 shrink-0 flex-col gap-4">
            {column.nodes.map((node) => (
              <GraphNodeCard
                key={node.id}
                node={node}
                isStart={schema.start_node_id === node.id}
                isEnd={schema.end_node_id === node.id}
                isHighlighted={highlightedNodeId === node.id}
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
        ))}
      </div>
    </div>
  )
}
