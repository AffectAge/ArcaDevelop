import { Building2, FlaskConical, Network, ScrollText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import type { WorldBase } from "@arcanorum/shared";
import { fetchContentEntries, setActiveTechnology, type ContentEntry } from "../lib/api";
import { useGameStore } from "../store/gameStore";
import { AppButton } from "./templates/AppButton";
import { AppModal, AppModalHeader } from "./templates/AppModal";
import { AppEmptyState, AppSection } from "./templates/AppSurface";
import { useUiText } from "../i18n/useUiText";
import type { UiTextKey } from "../i18n/uiText";

type Props = {
  open: boolean;
  token: string;
  countryId: string;
  worldBase: WorldBase | null;
  onClose: () => void;
};

type TechNodeData = Record<string, unknown> & {
  technologyId: string;
  label: string;
  description: string;
  color: string;
  logoUrl: string | null;
  costScience: number | null;
  status: "available" | "locked" | "researching" | "researched";
  progressPct: number;
  selected: boolean;
  related: boolean;
  dimmed: boolean;
  statusLabel: string;
  costText: string;
};

type TechNode = Node<TechNodeData, "technology">;

const elk = new ELK();

const STATUS_COLOR: Record<TechNodeData["status"], string> = {
  researched: "var(--arc-color-success-text)",
  researching: "var(--arc-color-gold)",
  available: "var(--arc-color-primary-top)",
  locked: "var(--arc-color-danger-text)",
};

const NODE_SIZE = {
  fixed: { width: 312, height: 118 },
};

function TechnologyNode({ data }: NodeProps<TechNode>) {
  const statusClass =
    data.status === "researched"
      ? "border-[var(--arc-color-success-border)]"
      : data.status === "researching"
        ? "border-[var(--arc-color-gold)]"
        : data.status === "available"
          ? "border-[var(--arc-color-primary-top)]"
          : "border-[var(--arc-color-danger-border)]";
  const selectedClass = data.selected ? "ring-1 ring-[var(--arc-color-gold)] shadow-[var(--arc-shadow-panel)]" : "";
  const dimmedClass = data.dimmed ? "opacity-35" : "opacity-100";

  return (
    <div
      className={`group relative h-[118px] w-[312px] cursor-pointer overflow-hidden rounded-md border bg-[var(--arc-color-panel)] p-3 pb-4 shadow-xl shadow-black/30 transition-[opacity,box-shadow,border-color,transform] duration-150 ease-out hover:-translate-y-0.5 hover:border-[var(--arc-color-gold-soft)] ${statusClass} ${selectedClass} ${dimmedClass}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!left-0 !top-[59px] !h-8 !w-2 !-translate-x-1/2 !-translate-y-1/2 !border-none !bg-transparent !opacity-0"
      />
      <div className="flex h-full items-start gap-3 pr-1">
        <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] shadow-inner">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <Network size={18} className="text-[var(--arc-color-text-muted)]" />
            )}
          </div>
          <div className="inline-flex max-w-full items-center gap-1 rounded border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-1 py-0.5 text-[10px] text-[var(--arc-color-text-soft)]">
            <FlaskConical size={10} className="shrink-0 text-[var(--arc-color-gold)]" />
            <span className="truncate">{data.costText}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--arc-color-text)]">{data.label}</div>
          <div className="mt-2 inline-flex rounded border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-0.5 text-[11px] text-[var(--arc-color-text-soft)]">
            {data.statusLabel}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-1 w-full overflow-hidden rounded-b bg-[var(--arc-overlay-30)]">
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, Math.max(0, data.progressPct))}%`,
            backgroundColor: STATUS_COLOR[data.status],
          }}
        />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!right-0 !top-[59px] !h-8 !w-2 !translate-x-1/2 !-translate-y-1/2 !border-none !bg-transparent !opacity-0"
      />
    </div>
  );
}

function buildGraph(technologies: ContentEntry[]) {
  const technologyIds = new Set(technologies.map((technology) => technology.id));
  const nodes: TechNode[] = technologies.map((technology) => ({
    id: technology.id,
    type: "technology",
    position: { x: 0, y: 0 },
    data: {
      technologyId: technology.id,
      label: technology.name,
      description: technology.description ?? "",
      color: /^#[0-9A-Fa-f]{6}$/.test(technology.color) ? technology.color : "#38bdf8",
      logoUrl: technology.logoUrl ?? null,
      costScience: typeof technology.costScience === "number" ? technology.costScience : null,
      status: (technology.prerequisiteTechnologyIds ?? []).length === 0 ? "available" : "locked",
      progressPct: 0,
      selected: false,
      related: false,
      dimmed: false,
      statusLabel: "",
      costText: "",
    },
  }));
  const edges: Edge[] = technologies.flatMap((technology) =>
    (technology.prerequisiteTechnologyIds ?? [])
      .filter((dependencyId) => technologyIds.has(dependencyId) && dependencyId !== technology.id)
      .map((dependencyId) => ({
        id: `${dependencyId}->${technology.id}`,
        source: dependencyId,
        target: technology.id,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#60a5fa", width: 18, height: 18 },
        style: { stroke: "#60a5fa", strokeWidth: 1.6 },
      })),
  );
  return { nodes, edges };
}

async function layoutGraph(nodes: TechNode[], edges: Edge[]): Promise<TechNode[]> {
  const graph = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "64",
      "elk.layered.spacing.nodeNodeBetweenLayers": "96",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    },
    children: nodes.map((node) => {
      return { id: node.id, width: NODE_SIZE.fixed.width, height: NODE_SIZE.fixed.height };
    }),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] })),
  });
  const byId = new Map(graph.children?.map((node) => [node.id, node]) ?? []);
  return nodes.map((node) => {
    const layout = byId.get(node.id);
    return {
      ...node,
      position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
    };
  });
}

export function TechnologyModal({ open, token, countryId, worldBase, onClose }: Props) {
  const { locale, t } = useUiText();
  const [technologies, setTechnologies] = useState<ContentEntry[]>([]);
  const [buildings, setBuildings] = useState<ContentEntry[]>([]);
  const [laws, setLaws] = useState<ContentEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTechnologyId, setSavingTechnologyId] = useState<string | null>(null);
  const [selectedTechnologyId, setSelectedTechnologyId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<TechNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const updateCountryTechnology = useGameStore((state) => state.updateCountryTechnology);

  const nodeTypes = useMemo(() => ({ technology: TechnologyNode }), []);
  const technologyState = worldBase?.technologyByCountry?.[countryId] ?? null;
  const researchedIds = useMemo(() => new Set(technologyState?.researchedTechnologyIds ?? []), [technologyState?.researchedTechnologyIds]);
  const activeTechnologyIds = useMemo(() => {
    const activeIds =
      technologyState?.activeTechnologyIds && technologyState.activeTechnologyIds.length > 0
        ? technologyState.activeTechnologyIds
        : technologyState?.activeTechnologyId
          ? [technologyState.activeTechnologyId]
          : [];
    return new Set(activeIds);
  }, [technologyState?.activeTechnologyId, technologyState?.activeTechnologyIds]);
  const progressByTechnologyId = technologyState?.progressByTechnologyId ?? {};
  const technologyById = useMemo(() => new Map(technologies.map((technology) => [technology.id, technology] as const)), [technologies]);
  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building] as const)), [buildings]);
  const lawById = useMemo(() => new Map(laws.map((law) => [law.id, law] as const)), [laws]);
  const selectedTechnology = selectedTechnologyId ? technologyById.get(selectedTechnologyId) ?? null : null;
  const isTechnologyAvailable = (technology: ContentEntry) =>
    !researchedIds.has(technology.id) && (technology.prerequisiteTechnologyIds ?? []).every((technologyId) => researchedIds.has(technologyId));
  const getTechnologyStatus = (technologyId: string): TechNodeData["status"] => {
    const technology = technologyById.get(technologyId);
    if (researchedIds.has(technologyId)) return "researched";
    if (activeTechnologyIds.has(technologyId)) return "researching";
    if (technology && isTechnologyAvailable(technology)) return "available";
    return "locked";
  };
  const statusLabel = (status: TechNodeData["status"]): string => {
    const key: Record<TechNodeData["status"], UiTextKey> = {
      available: "technology.status.available",
      locked: "technology.status.locked",
      researched: "technology.status.researched",
      researching: "technology.status.researching",
    };
    return t(key[status]);
  };
  const handleResearchClick = async (technologyId: string, active: boolean) => {
    setSavingTechnologyId(technologyId);
    try {
      const result = await setActiveTechnology(token, countryId, technologyId, active);
      updateCountryTechnology(countryId, result.technology);
      toast.success(active ? t("technology.researchAdded") : t("technology.researchCanceled"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SET_ACTIVE_TECHNOLOGY_FAILED";
      if (msg === "TECHNOLOGY_NOT_AVAILABLE") toast.error(t("technology.notAvailable"));
      else toast.error(t("technology.updateFailed"));
    } finally {
      setSavingTechnologyId(null);
    }
  };
  const selectedChain = useMemo(() => {
    if (!selectedTechnologyId) return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
    const parentsByTarget = new Map<string, string[]>();
    const childrenBySource = new Map<string, string[]>();
    for (const edge of edges) {
      parentsByTarget.set(edge.target, [...(parentsByTarget.get(edge.target) ?? []), edge.source]);
      childrenBySource.set(edge.source, [...(childrenBySource.get(edge.source) ?? []), edge.target]);
    }
    const nodeIds = new Set<string>([selectedTechnologyId]);
    const edgeIds = new Set<string>();
    const walkParents = (nodeId: string) => {
      for (const parentId of parentsByTarget.get(nodeId) ?? []) {
        edgeIds.add(`${parentId}->${nodeId}`);
        if (nodeIds.has(parentId)) continue;
        nodeIds.add(parentId);
        walkParents(parentId);
      }
    };
    const walkChildren = (nodeId: string) => {
      for (const childId of childrenBySource.get(nodeId) ?? []) {
        edgeIds.add(`${nodeId}->${childId}`);
        if (nodeIds.has(childId)) continue;
        nodeIds.add(childId);
        walkChildren(childId);
      }
    };
    walkParents(selectedTechnologyId);
    walkChildren(selectedTechnologyId);
    return { nodeIds, edgeIds };
  }, [edges, selectedTechnologyId]);
  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const related = !selectedTechnologyId || selectedChain.nodeIds.has(node.id);
        const technology = technologyById.get(node.id);
        const cost = Math.max(1, Number(technology?.costScience ?? 100));
        const progress = Math.max(0, Number(progressByTechnologyId[node.id] ?? 0));
        const status = getTechnologyStatus(node.id);
        return {
          ...node,
          data: {
            ...node.data,
            status,
            progressPct: status === "researched" ? 100 : Number(((progress / cost) * 100).toFixed(1)),
            selected: node.id === selectedTechnologyId,
            related: selectedChain.nodeIds.has(node.id),
            dimmed: Boolean(selectedTechnologyId && !related),
            statusLabel: statusLabel(status),
            costText: typeof technology?.costScience === "number" ? technology.costScience.toLocaleString(locale) : "0",
          },
        };
      }),
    [activeTechnologyIds, locale, nodes, progressByTechnologyId, researchedIds, selectedChain.nodeIds, selectedTechnologyId, technologyById, t],
  );
  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const highlighted = !selectedTechnologyId || selectedChain.edgeIds.has(edge.id);
        const status = getTechnologyStatus(edge.target);
        const color = highlighted ? STATUS_COLOR[status] : "var(--arc-color-text-muted)";
        return {
          ...edge,
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
          style: {
            stroke: color,
            strokeWidth: highlighted ? 2.1 : 1.2,
            opacity: highlighted ? 0.95 : 0.24,
          },
        };
      }),
    [activeTechnologyIds, edges, researchedIds, selectedChain.edgeIds, selectedTechnologyId, technologyById],
  );
  const selectedTechnologyStatus = selectedTechnology ? getTechnologyStatus(selectedTechnology.id) : null;
  const selectedTechnologyCost = Math.max(1, Number(selectedTechnology?.costScience ?? 100));
  const selectedTechnologyProgress = selectedTechnology
    ? Math.max(0, Number(progressByTechnologyId[selectedTechnology.id] ?? 0))
    : 0;
  const selectedTechnologyProgressPct =
    selectedTechnologyStatus === "researched"
      ? 100
      : Number(((selectedTechnologyProgress / selectedTechnologyCost) * 100).toFixed(1));
  const selectedPrerequisites = useMemo(
    () => (selectedTechnology?.prerequisiteTechnologyIds ?? []).map((id) => technologyById.get(id)?.name ?? id),
    [selectedTechnology?.prerequisiteTechnologyIds, technologyById],
  );
  const selectedUnlockGroups = useMemo(() => {
    if (!selectedTechnology) return [];
    const groups = [
      {
        key: "buildings",
        title: t("technology.unlockBuildings"),
        fallback: Building2,
        items: (selectedTechnology.unlockBuildingIds ?? []).map((id) => ({
          id,
          name: buildingById.get(id)?.name ?? id,
          logoUrl: buildingById.get(id)?.logoUrl ?? null,
        })),
      },
      {
        key: "laws",
        title: t("technology.unlockLaws"),
        fallback: ScrollText,
        items: (selectedTechnology.unlockLawIds ?? []).map((id) => ({
          id,
          name: lawById.get(id)?.name ?? id,
          logoUrl: lawById.get(id)?.logoUrl ?? null,
        })),
      },
    ];
    return groups.filter((group) => group.items.length > 0);
  }, [buildingById, lawById, selectedTechnology, t]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchContentEntries("technologies"),
      fetchContentEntries("buildings"),
      fetchContentEntries("laws"),
    ])
      .then(([technologyItems, buildingItems, lawItems]) => {
        if (cancelled) return;
        setTechnologies(technologyItems);
        setBuildings(buildingItems);
        setLaws(lawItems);
        setSelectedTechnologyId((current) => (current && technologyItems.some((item) => item.id === current) ? current : null));
      })
      .catch(() => {
        if (!cancelled) toast.error(t("technology.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const { nodes: rawNodes, edges: rawEdges } = buildGraph(technologies);
    setEdges(rawEdges);
    layoutGraph(rawNodes, rawEdges)
      .then((layoutedNodes) => {
        if (!cancelled) setNodes(layoutedNodes);
      })
      .catch(() => {
        if (!cancelled) setNodes(rawNodes);
      });
    return () => {
      cancelled = true;
    };
  }, [open, setEdges, setNodes, technologies]);

  return open ? (
        <AppModal open={open} onClose={onClose} modalKey="technology" zIndexClassName="z-[175]" panelClassName="w-full overflow-hidden md:p-5">
              <AppModalHeader
                title={t("technology.title")}
                description={t("technology.nodeCount", { count: technologies.length.toLocaleString(locale) })}
                onClose={onClose}
                actions={
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] text-[var(--arc-color-gold)]">
                    <Network size={19} />
                  </div>
                }
              />

              <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <AppSection className="overflow-hidden bg-[var(--arc-color-panel-soft)] p-0">
                  {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--arc-color-text-soft)]">{t("technology.loading")}</div>
                  ) : technologies.length === 0 ? (
                    <AppEmptyState className="m-4">{t("technology.empty")}</AppEmptyState>
                  ) : (
                    <ReactFlow
                      nodes={renderedNodes}
                      edges={renderedEdges}
                      nodeTypes={nodeTypes}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onNodeClick={(_, node) => setSelectedTechnologyId(node.id)}
                      onPaneClick={() => setSelectedTechnologyId(null)}
                      fitView
                      fitViewOptions={{ padding: 0.2 }}
                      minZoom={0.2}
                      maxZoom={1.5}
                      proOptions={{ hideAttribution: true }}
                      className="technology-flow"
                    />
                  )}
                </AppSection>
                <AppSection className="overflow-hidden p-4">
                  {selectedTechnology ? (
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="flex items-start gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)]">
                          {selectedTechnology.logoUrl ? (
                            <img src={selectedTechnology.logoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                          ) : (
                            <Network size={20} className="text-[var(--arc-color-text-muted)]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-semibold leading-tight text-[var(--arc-color-text)]">{selectedTechnology.name}</div>
                          <div className="mt-1 text-xs text-[var(--arc-color-text-soft)]">
                            {selectedTechnologyStatus ? statusLabel(selectedTechnologyStatus) : t("technology.status.notSelected")}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-3">
                        <div className="mb-2 flex items-center justify-between text-xs text-[var(--arc-color-text-soft)]">
                          <span>{t("technology.progress")}</span>
                          <span>{Math.min(100, Math.max(0, selectedTechnologyProgressPct)).toLocaleString(locale)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--arc-overlay-30)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, Math.max(0, selectedTechnologyProgressPct))}%`,
                              backgroundColor: STATUS_COLOR[selectedTechnologyStatus ?? "locked"],
                            }}
                          />
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--arc-color-text-soft)]">
                          <FlaskConical size={12} className="text-[var(--arc-color-gold)]" />
                          {t("technology.scienceCost", { cost: selectedTechnologyCost.toLocaleString(locale) })}
                        </div>
                      </div>

                      <div className="arc-scrollbar mt-4 min-h-0 flex-1 space-y-4 overflow-auto pr-1">
                        <section>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">{t("technology.description")}</div>
                          <div className="text-sm leading-relaxed text-[var(--arc-color-text-soft)]">
                            {selectedTechnology.description || t("technology.descriptionMissing")}
                          </div>
                        </section>
                        <section>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">{t("technology.prerequisites")}</div>
                          {selectedPrerequisites.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-[var(--arc-color-gold-soft)] px-3 py-2 text-xs text-[var(--arc-color-text-muted)]">{t("technology.rootTechnology")}</div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {selectedPrerequisites.map((name) => (
                                <span key={name} className="rounded border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-1 text-xs text-[var(--arc-color-text-soft)]">
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </section>
                        <section>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">{t("technology.unlocks")}</div>
                          <div className="space-y-2 text-xs text-[var(--arc-color-text-soft)]">
                            {selectedUnlockGroups.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-[var(--arc-color-gold-soft)] px-3 py-2 text-[var(--arc-color-text-muted)]">{t("technology.unlocksEmpty")}</div>
                            ) : (
                              selectedUnlockGroups.map((group) => (
                                <div key={group.key} className="rounded-lg border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] p-2.5">
                                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--arc-color-text-muted)]">{group.title}</div>
                                  <div className="space-y-1.5">
                                    {group.items.map((item) => {
                                      const FallbackIcon = group.fallback;
                                      return (
                                        <div
                                          key={`${group.key}-${item.id}`}
                                          className="flex min-h-9 items-center gap-2 rounded border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)] px-2 py-1 text-[var(--arc-color-text-soft)]"
                                        >
                                          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-[var(--arc-color-gold-soft)] bg-[var(--arc-overlay-30)]">
                                            {item.logoUrl ? (
                                              <img src={item.logoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                                            ) : (
                                              <FallbackIcon size={14} className="text-[var(--arc-color-text-muted)]" />
                                            )}
                                          </div>
                                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </section>
                      </div>

                      {selectedTechnologyStatus !== "researched" ? (
                        <AppButton
                          type="button"
                          disabled={selectedTechnologyStatus === "locked" || savingTechnologyId === selectedTechnology.id}
                          onClick={() => void handleResearchClick(selectedTechnology.id, selectedTechnologyStatus !== "researching")}
                          variant={selectedTechnologyStatus === "researching" ? "danger" : "primary"}
                          className="mt-4 w-full"
                        >
                          {selectedTechnologyStatus === "researching" ? t("technology.cancelResearch") : t("technology.startResearch")}
                        </AppButton>
                      ) : null}
                    </div>
                  ) : (
                    <AppEmptyState className="flex h-full items-center justify-center px-4">
                      {t("technology.selectPrompt")}
                    </AppEmptyState>
                  )}
                </AppSection>
              </div>
        </AppModal>
  ) : null;
}
