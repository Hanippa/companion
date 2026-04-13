export type TrackNodeConnection = {
  id: string
  label: string
  node_id: string
}

export type TrackNode = {
  id: string
  title: string
  description?: string | null
  next_nodes: TrackNodeConnection[]
}

export type NormalizedTrackSchema = {
  title?: string | null
  description?: string | null
  start_node_id: string | null
  end_node_id: string | null
  nodes: TrackNode[]
}

type LegacyTrackTransition = {
  id?: string | null
  label?: string | null
  to_step?: string | null
}

type LegacyTrackStep = {
  id?: string | null
  title?: string | null
  description?: string | null
  transitions?: LegacyTrackTransition[] | null
}

type RawTrackNodeConnection = {
  id?: string | null
  label?: string | null
  node_id?: string | null
}

type RawTrackNode = {
  id?: string | null
  title?: string | null
  description?: string | null
  next_nodes?: RawTrackNodeConnection[] | null
}

type RawTrackSchema = {
  title?: string | null
  description?: string | null
  start_node_id?: string | null
  end_node_id?: string | null
  nodes?: RawTrackNode[] | null
  initial_step?: string | null
  steps?: LegacyTrackStep[] | null
}

function normalizeConnection(
  rawConnection: RawTrackNodeConnection | LegacyTrackTransition | null | undefined,
  fallbackIndex: number
): TrackNodeConnection | null {
  const connectionCandidate = rawConnection as
    | RawTrackNodeConnection
    | LegacyTrackTransition
    | null
    | undefined
  const nodeId =
    connectionCandidate && "node_id" in connectionCandidate
      ? connectionCandidate.node_id
      : connectionCandidate && "to_step" in connectionCandidate
        ? connectionCandidate.to_step
        : null

  if (!nodeId || !nodeId.trim()) {
    return null
  }

  const normalizedNodeId = nodeId.trim()
  const label = rawConnection?.label?.trim() || "המשך"
  const id = rawConnection?.id?.trim() || `${normalizedNodeId}-${fallbackIndex + 1}`

  return {
    id,
    label,
    node_id: normalizedNodeId,
  }
}

function normalizeNode(rawNode: RawTrackNode | LegacyTrackStep, nodeIndex: number): TrackNode | null {
  const nodeId = rawNode.id?.trim()
  if (!nodeId) {
    return null
  }

  const title = rawNode.title?.trim() || `צומת ${nodeIndex + 1}`
  const rawConnections =
    "next_nodes" in rawNode
      ? (rawNode.next_nodes ?? [])
      : "transitions" in rawNode
        ? (rawNode.transitions ?? [])
        : []

  return {
    id: nodeId,
    title,
    description: rawNode.description?.trim() || null,
    next_nodes: rawConnections
      .map((connection, connectionIndex) => normalizeConnection(connection, connectionIndex))
      .filter((connection): connection is TrackNodeConnection => Boolean(connection)),
  }
}

export function normalizeTrackSchema(rawSchema: unknown): NormalizedTrackSchema | null {
  if (!rawSchema || typeof rawSchema !== "object" || Array.isArray(rawSchema)) {
    return null
  }

  const schema = rawSchema as RawTrackSchema
  const rawNodes = (schema.nodes ?? schema.steps ?? [])
    .map((node, nodeIndex) => normalizeNode(node, nodeIndex))
    .filter((node): node is TrackNode => Boolean(node))

  if (rawNodes.length === 0) {
    return {
      title: schema.title?.trim() || null,
      description: schema.description?.trim() || null,
      start_node_id: null,
      end_node_id: null,
      nodes: [],
    }
  }

  const nodeIds = new Set(rawNodes.map((node) => node.id))
  const startNodeIdCandidate = schema.start_node_id?.trim() || schema.initial_step?.trim() || rawNodes[0].id
  const startNodeId = nodeIds.has(startNodeIdCandidate) ? startNodeIdCandidate : rawNodes[0].id
  const endNodeIdCandidate = schema.end_node_id?.trim() || null
  const endNodeId = endNodeIdCandidate && nodeIds.has(endNodeIdCandidate) ? endNodeIdCandidate : null

  return {
    title: schema.title?.trim() || null,
    description: schema.description?.trim() || null,
    start_node_id: startNodeId,
    end_node_id: endNodeId,
    nodes: rawNodes.map((node) => ({
      ...node,
      next_nodes: node.next_nodes.filter((connection) => nodeIds.has(connection.node_id)),
    })),
  }
}

export function getTrackNodeMap(schema: NormalizedTrackSchema | null) {
  return new Map((schema?.nodes ?? []).map((node) => [node.id, node] as const))
}

export function getTrackCurrentNode(
  schema: NormalizedTrackSchema | null,
  currentNodeId: string | null
) {
  const nodeMap = getTrackNodeMap(schema)

  if (currentNodeId && nodeMap.has(currentNodeId)) {
    return nodeMap.get(currentNodeId) ?? null
  }

  if (schema?.start_node_id && nodeMap.has(schema.start_node_id)) {
    return nodeMap.get(schema.start_node_id) ?? null
  }

  return schema?.nodes[0] ?? null
}
