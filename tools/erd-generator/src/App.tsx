import { Background, Controls, MarkerType, Node, ReactFlow, ReactFlowInstance } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";
import plantumlEncoder from "plantuml-encoder";
import { useEffect, useMemo, useRef, useState } from "react";
import { ERDGenerator } from "./components/ERDGenerator";
import { GraphTableNode, GraphTableNodeData } from "./components/GraphTableNode";
import { ERDEditorModel, ModelDiff, changedOnlyModel, cloneModel, diffModel, makeId, toDataverseSolution, toEditorModel, totalChangeCount } from "./models/editor";
import { DataverseSolution } from "./models/interfaces";
import { DataverseClient } from "./utils/DataverseClient";
import { GraphPositions, generateGridLayout, mergePositions } from "./utils/graphLayout";

declare global {
    interface Window {
        acquireVsCodeApi?: () => {
            postMessage: (message: any) => void;
        };
        mermaid?: {
            initialize: (config: any) => void;
            init: (config: any, element: HTMLElement | null) => Promise<void>;
            render: (id: string, text: string) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>;
        };
    }
}

interface Solution {
    uniqueName: string;
    displayName: string;
    version: string;
}

interface EditorSnapshot {
    model: ERDEditorModel;
    positions: GraphPositions;
}

interface PersistedSession {
    version: number;
    solutionUniqueName: string;
    baselineModel: ERDEditorModel | null;
    workingModel: ERDEditorModel;
    positions: GraphPositions;
    visualMode: VisualMode;
    edgeType: EdgeStyleType;
    hideAttributes: boolean;
    hideRelationshipNames: boolean;
    showChangedOnlyInGraph: boolean;
    showImpactMarkers: boolean;
    includeAttributes: boolean;
    includeRelationships: boolean;
    maxAttributesPerTable: number;
    exportSource: "working" | "baseline";
    exportChangedOnly: boolean;
    selectedTableId: string;
    relationshipTarget: string;
}

type OutputFormat = "flow" | "mermaid" | "plantuml" | "drawio";
type DiagramFormat = Exclude<OutputFormat, "flow">;
type VisualMode = "flow" | DiagramFormat;
type ExportMode = "text" | "visual" | "both";
type VisualExportType = "html" | "svg" | "png";
type EdgeStyleType = "step" | "smoothstep" | "bezier";
type TopbarFlyout = "display" | "canvas" | "session" | null;
type CanvasActionTab = "table" | "attribute" | "relationship";

const nodeTypes = { tableNode: GraphTableNode };

const ERROR_DISPLAY_DURATION_MS = 7000;
const IMPACT_MEDIUM_ATTRIBUTE_THRESHOLD = 8;
const IMPACT_HIGH_ATTRIBUTE_THRESHOLD = 18;
const GRAPH_NODE_MAX_VISIBLE_ATTRIBUTES = 9;
const SESSION_STORAGE_KEY = "pptb.erd.session.v1";
const SESSION_LIBRARY_KEY = "pptb.erd.sessions.v1";
const SESSION_SHARE_VERSION = 1;
const RESERVED_NAMES = new Set([
    "entity",
    "table",
    "attribute",
    "relationship",
    "select",
    "from",
    "where",
    "insert",
    "update",
    "delete",
    "order",
    "group",
    "join",
    "inner",
    "outer",
    "create",
    "drop",
    "alter",
    "having",
    "distinct",
    "union",
    "truncate",
]);
const getImpactLevel = (attributeCount: number): "low" | "medium" | "high" => {
    if (attributeCount > IMPACT_HIGH_ATTRIBUTE_THRESHOLD) return "high";
    if (attributeCount > IMPACT_MEDIUM_ATTRIBUTE_THRESHOLD) return "medium";
    return "low";
};

const isEdgeType = (value: string): value is EdgeStyleType => value === "step" || value === "smoothstep" || value === "bezier";
const isVisualMode = (value: string): value is VisualMode => value === "flow" || value === "mermaid" || value === "plantuml" || value === "drawio";

const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");

const parseDataUrl = (dataUrl: string): { mimeType: string; isBase64: boolean; data: string } | null => {
    if (!dataUrl.startsWith("data:")) return null;

    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex < 0) return null;

    const header = dataUrl.slice(5, commaIndex);
    const data = dataUrl.slice(commaIndex + 1);
    const headerParts = header.split(";").filter(Boolean);
    const isBase64 = headerParts.includes("base64");
    const mimeType = headerParts.find((part) => part !== "base64") || "text/plain;charset=utf-8";
    return {
        mimeType,
        isBase64,
        data,
    };
};

const decodeDataUrlText = (value: string): string => {
    const parsed = parseDataUrl(value);
    if (!parsed) return value;

    if (parsed.isBase64) {
        const binary = atob(parsed.data);
        return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    }

    return decodeURIComponent(parsed.data.replace(/\+/g, "%20"));
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
        return new Blob([dataUrl], { type: "text/plain;charset=utf-8" });
    }

    if (parsed.isBase64) {
        const binary = atob(parsed.data);
        return new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], { type: parsed.mimeType });
    }

    return new Blob([decodeURIComponent(parsed.data.replace(/\+/g, "%20"))], { type: parsed.mimeType });
};

const readSessionLibrary = (): Record<string, PersistedSession> => {
    const raw = localStorage.getItem(SESSION_LIBRARY_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as Record<string, PersistedSession>;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

function App() {
    const [isPPTB, setIsPPTB] = useState<boolean>(false);
    const [connectionUrl, setConnectionUrl] = useState<string>("");
    const [accessToken, setAccessToken] = useState<string>("");
    const [solutions, setSolutions] = useState<Solution[]>([]);
    const [selectedSolution, setSelectedSolution] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    const [baselineModel, setBaselineModel] = useState<ERDEditorModel | null>(null);
    const [workingModel, setWorkingModel] = useState<ERDEditorModel | null>(null);
    const [positions, setPositions] = useState<GraphPositions>({});
    const [historyPast, setHistoryPast] = useState<EditorSnapshot[]>([]);
    const [historyFuture, setHistoryFuture] = useState<EditorSnapshot[]>([]);

    const [visualMode, setVisualMode] = useState<VisualMode>("flow");
    const [previewMode, setPreviewMode] = useState<"visual" | "text">("visual");
    const [selectedFormat, setSelectedFormat] = useState<OutputFormat>("mermaid");
    const [exportMode, setExportMode] = useState<ExportMode>("both");
    const [visualExportType, setVisualExportType] = useState<VisualExportType>("html");
    const [edgeType, setEdgeType] = useState<EdgeStyleType>("smoothstep");
    const [hideAttributes, setHideAttributes] = useState<boolean>(false);
    const [hideRelationshipNames, setHideRelationshipNames] = useState<boolean>(false);
    const [openTopbarFlyout, setOpenTopbarFlyout] = useState<TopbarFlyout>(null);

    const [includeAttributes, setIncludeAttributes] = useState<boolean>(true);
    const [includeRelationships, setIncludeRelationships] = useState<boolean>(true);
    const [maxAttributesPerTable, setMaxAttributesPerTable] = useState<number>(12);

    const [exportSource, setExportSource] = useState<"working" | "baseline">("working");
    const [exportChangedOnly, setExportChangedOnly] = useState<boolean>(false);

    const [showChangedOnlyInGraph, setShowChangedOnlyInGraph] = useState<boolean>(false);
    const [showImpactMarkers, setShowImpactMarkers] = useState<boolean>(true);

    const [selectedTableId, setSelectedTableId] = useState<string>("");
    const [newTableLogicalName, setNewTableLogicalName] = useState<string>("");
    const [newTableDisplayName, setNewTableDisplayName] = useState<string>("");
    const [renameTableDisplayName, setRenameTableDisplayName] = useState<string>("");
    const [newAttributeLogicalName, setNewAttributeLogicalName] = useState<string>("");
    const [newAttributeDisplayName, setNewAttributeDisplayName] = useState<string>("");
    const [newAttributeType, setNewAttributeType] = useState<string>("string");

    const [relationshipName, setRelationshipName] = useState<string>("");
    const [relationshipNameTouched, setRelationshipNameTouched] = useState<boolean>(false);
    const [relationshipTarget, setRelationshipTarget] = useState<string>("");
    const [relationshipType, setRelationshipType] = useState<"OneToMany" | "ManyToOne" | "ManyToMany">("ManyToOne");

    const [publishing, setPublishing] = useState<boolean>(false);
    const [showPublishConfirm, setShowPublishConfirm] = useState<boolean>(false);
    const [publishResult, setPublishResult] = useState<{ success: boolean; lines: string[] } | null>(null);

    const [showExportPanel, setShowExportPanel] = useState<boolean>(false);
    const [showCanvasActionPanel, setShowCanvasActionPanel] = useState<boolean>(false);
    const [canvasActionTab, setCanvasActionTab] = useState<CanvasActionTab>("table");
    const [graphEntryAnimating, setGraphEntryAnimating] = useState<boolean>(false);
    const [graphBootTick, setGraphBootTick] = useState<number>(0);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node<GraphTableNodeData>> | null>(null);

    const [generatedDiagrams, setGeneratedDiagrams] = useState<Record<OutputFormat, string>>({
        flow: "",
        mermaid: "",
        plantuml: "",
        drawio: "",
    });

    const [mermaidReady, setMermaidReady] = useState<boolean>(false);
    const topbarRef = useRef<HTMLElement | null>(null);
    const sessionFileInputRef = useRef<HTMLInputElement | null>(null);
    const [savedSessionNames, setSavedSessionNames] = useState<string[]>([]);
    const [sessionNameInput, setSessionNameInput] = useState<string>("");
    const [selectedSessionName, setSelectedSessionName] = useState<string>("");

    const diff: ModelDiff | null = useMemo(() => {
        if (!baselineModel || !workingModel) return null;
        return diffModel(baselineModel, workingModel);
    }, [baselineModel, workingModel]);

    const visibleTableIds = useMemo(() => {
        if (!workingModel) return new Set<string>();
        if (!showChangedOnlyInGraph || !diff) return new Set(workingModel.tables.map((table) => table.id));

        const ids = new Set<string>([...diff.newTableIds, ...diff.renamedTableIds]);
        for (const table of workingModel.tables) {
            if (table.attributes.some((attribute) => diff.newAttributeIds.has(attribute.id) || diff.renamedAttributeIds.has(attribute.id))) {
                ids.add(table.id);
            }
        }
        for (const rel of workingModel.relationships) {
            if (diff.newRelationshipIds.has(rel.id)) {
                ids.add(rel.fromTableId);
                ids.add(rel.toTableId);
            }
        }
        return ids;
    }, [workingModel, showChangedOnlyInGraph, diff]);

    const selectedTable = useMemo(() => workingModel?.tables.find((table) => table.id === selectedTableId) || null, [workingModel, selectedTableId]);
    const selectedRelationshipTargetTable = useMemo(() => workingModel?.tables.find((table) => table.id === relationshipTarget) || null, [workingModel, relationshipTarget]);
    const availableVisualExportTypes = useMemo<VisualExportType[]>(() => {
        if (selectedFormat === "drawio") return ["html"];
        return ["html", "svg", "png"];
    }, [selectedFormat]);

    const changeCount = diff ? totalChangeCount(diff) : 0;
    const publisherPrefixWithUnderscore = useMemo(() => {
        if (!workingModel?.publisherPrefix) return "";
        return `${workingModel.publisherPrefix.trim()}_`;
    }, [workingModel]);

    const publishReview = useMemo(() => {
        if (!diff || !workingModel) return null;

        const tableById = new Map(workingModel.tables.map((table) => [table.id, table]));
        const tableName = (id: string) => tableById.get(id)?.logicalName || id;

        const newTables = Array.from(diff.newTableIds).map((id) => tableName(id));
        const renamedTables = Array.from(diff.renamedTableIds).map((id) => tableName(id));

        const newAttributes: string[] = [];
        const renamedAttributes: string[] = [];
        for (const table of workingModel.tables) {
            for (const attribute of table.attributes) {
                if (diff.newAttributeIds.has(attribute.id)) {
                    newAttributes.push(`${table.logicalName}.${attribute.logicalName}`);
                }
                if (diff.renamedAttributeIds.has(attribute.id)) {
                    renamedAttributes.push(`${table.logicalName}.${attribute.logicalName}`);
                }
            }
        }

        const newRelationships = workingModel.relationships
            .filter((relationship) => diff.newRelationshipIds.has(relationship.id))
            .map((relationship) => `${tableName(relationship.fromTableId)} -> ${tableName(relationship.toTableId)} (${relationship.schemaName})`);

        return {
            newTables,
            renamedTables,
            newAttributes,
            renamedAttributes,
            newRelationships,
        };
    }, [diff, workingModel]);

    const getModelForExport = (): ERDEditorModel | null => {
        if (!workingModel || !baselineModel) return null;
        if (exportSource === "baseline") return baselineModel;
        if (!exportChangedOnly) return workingModel;
        return changedOnlyModel(baselineModel, workingModel);
    };

    const buildFlowExport = (model: ERDEditorModel) => {
        const tableIds = new Set(model.tables.map((table) => table.id));
        const exportedPositions: GraphPositions = {};
        for (const tableId of tableIds) {
            if (positions[tableId]) {
                exportedPositions[tableId] = positions[tableId];
            }
        }

        return {
            version: SESSION_SHARE_VERSION,
            exportedAt: new Date().toISOString(),
            source: exportSource,
            changedOnly: exportChangedOnly,
            model,
            positions: exportedPositions,
        };
    };

    const buildSessionPayload = (): PersistedSession | null => {
        if (!workingModel) return null;
        return {
            version: SESSION_SHARE_VERSION,
            solutionUniqueName: selectedSolution,
            baselineModel: baselineModel ? cloneModel(baselineModel) : null,
            workingModel: cloneModel(workingModel),
            positions: { ...positions },
            visualMode,
            edgeType,
            hideAttributes,
            hideRelationshipNames,
            showChangedOnlyInGraph,
            showImpactMarkers,
            includeAttributes,
            includeRelationships,
            maxAttributesPerTable,
            exportSource,
            exportChangedOnly,
            selectedTableId,
            relationshipTarget,
        };
    };

    const applySessionPayload = (payload: PersistedSession) => {
        if (!payload?.workingModel || !Array.isArray(payload.workingModel.tables) || !Array.isArray(payload.workingModel.relationships)) {
            throw new Error("Session is missing ERD model data.");
        }

        const restoredWorking = cloneModel(payload.workingModel);
        const restoredBaseline = payload.baselineModel ? cloneModel(payload.baselineModel) : null;
        const fallbackPositions = generateGridLayout(restoredWorking);
        const mergedPositions = mergePositions(fallbackPositions, payload.positions || {});

        setSelectedSolution(payload.solutionUniqueName || "");
        setBaselineModel(restoredBaseline);
        setWorkingModel(restoredWorking);
        setPositions(mergedPositions);
        setGraphBootTick((tick) => tick + 1);
        resetHistory();

        const firstTable = restoredWorking.tables[0];
        const safeSelectedTableId = restoredWorking.tables.some((table) => table.id === payload.selectedTableId) ? payload.selectedTableId : firstTable?.id || "";
        const safeTargetTableId = restoredWorking.tables.some((table) => table.id === payload.relationshipTarget)
            ? payload.relationshipTarget
            : restoredWorking.tables.find((table) => table.id !== safeSelectedTableId)?.id || safeSelectedTableId;

        setSelectedTableId(safeSelectedTableId);
        setRelationshipTarget(safeTargetTableId || "");
        setRenameTableDisplayName(restoredWorking.tables.find((table) => table.id === safeSelectedTableId)?.displayName || "");

        setVisualMode(isVisualMode(payload.visualMode) ? payload.visualMode : "flow");
        setEdgeType(isEdgeType(payload.edgeType) ? payload.edgeType : "smoothstep");
        setHideAttributes(!!payload.hideAttributes);
        setHideRelationshipNames(!!payload.hideRelationshipNames);
        setShowChangedOnlyInGraph(!!payload.showChangedOnlyInGraph);
        setShowImpactMarkers(payload.showImpactMarkers !== false);
        setIncludeAttributes(payload.includeAttributes !== false);
        setIncludeRelationships(payload.includeRelationships !== false);
        setMaxAttributesPerTable(Number.isFinite(payload.maxAttributesPerTable) ? Math.max(0, payload.maxAttributesPerTable) : 12);
        setExportSource(payload.exportSource === "baseline" ? "baseline" : "working");
        setExportChangedOnly(!!payload.exportChangedOnly);
    };

    const copyText = async (value: string) => {
        if (isPPTB) {
            await window.toolboxAPI.utils.copyToClipboard(value);
            return;
        }
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }

        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
    };

    useEffect(() => {
        if (!workingModel) return;
        if (!selectedTableId || !workingModel.tables.some((table) => table.id === selectedTableId)) {
            setSelectedTableId(workingModel.tables[0]?.id || "");
            return;
        }
    }, [workingModel, selectedTableId]);

    useEffect(() => {
        if (!workingModel || !selectedTable) return;
        const preferred = workingModel.tables.find((table) => table.id !== selectedTable.id)?.id || selectedTable.id;
        setRelationshipTarget((current) => (current && workingModel.tables.some((table) => table.id === current) ? current : preferred));
    }, [workingModel, selectedTable]);

    useEffect(() => {
        if (graphBootTick === 0) return;
        setGraphEntryAnimating(true);
        const timer = window.setTimeout(() => setGraphEntryAnimating(false), 900);
        return () => window.clearTimeout(timer);
    }, [graphBootTick]);

    useEffect(() => {
        if (visualMode === "flow") return;
        setSelectedFormat(visualMode);
        setPreviewMode("visual");
    }, [visualMode]);

    useEffect(() => {
        if (selectedFormat === "flow" && exportMode !== "visual") {
            setExportMode("visual");
        }
    }, [selectedFormat, exportMode]);

    useEffect(() => {
        if (!availableVisualExportTypes.includes(visualExportType)) {
            setVisualExportType(availableVisualExportTypes[0]);
        }
    }, [availableVisualExportTypes, visualExportType]);

    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            if (!topbarRef.current) return;
            if (!topbarRef.current.contains(event.target as Node)) {
                setOpenTopbarFlyout(null);
            }
        };
        document.addEventListener("mousedown", onDocumentClick);
        return () => document.removeEventListener("mousedown", onDocumentClick);
    }, []);

    useEffect(() => {
        const initializeEnvironment = async () => {
            if (typeof window.acquireVsCodeApi !== "undefined") {
                setIsPPTB(false);
                setLoading(true);

                const handleMessage = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === "setCredentials") {
                        setConnectionUrl(message.environmentUrl);
                        setAccessToken(message.accessToken);
                        setLoading(false);
                    }
                };

                window.addEventListener("message", handleMessage);
                return () => window.removeEventListener("message", handleMessage);
            }

            if (window.toolboxAPI) {
                setIsPPTB(true);
                try {
                    const activeConnection = await window.toolboxAPI.connections.getActiveConnection();
                    setConnectionUrl(activeConnection?.url || "");
                } catch (err) {
                    console.error("Failed to get active connection", err);
                }
                setLoading(false);
                return;
            }

            setError("Not running in supported environment (DVDT or PPTB)");
            setLoading(false);
        };

        initializeEnvironment();
    }, []);

    useEffect(() => {
        if (connectionUrl) {
            loadSolutions();
        }
    }, [connectionUrl]);

    useEffect(() => {
        const model = getModelForExport();
        if (!model) {
            setGeneratedDiagrams({ flow: "", mermaid: "", plantuml: "", drawio: "" });
            return;
        }

        const diagramSolution = toDataverseSolution(model);
        const generatorConfig = {
            includeAttributes,
            includeRelationships,
            maxAttributesPerTable,
        };

        setGeneratedDiagrams({
            flow: JSON.stringify(buildFlowExport(model), null, 2),
            mermaid: new ERDGenerator({ ...generatorConfig, format: "mermaid" }).generate(diagramSolution),
            plantuml: new ERDGenerator({ ...generatorConfig, format: "plantuml" }).generate(diagramSolution),
            drawio: new ERDGenerator({ ...generatorConfig, format: "drawio" }).generate(diagramSolution),
        });
    }, [workingModel, baselineModel, includeAttributes, includeRelationships, maxAttributesPerTable, exportSource, exportChangedOnly, positions]);

    useEffect(() => {
        const preloadMermaid = async () => {
            try {
                await ensureMermaid();
                setMermaidReady(true);
            } catch (err) {
                console.error("Failed to preload mermaid:", err);
            }
        };
        preloadMermaid();
    }, []);

    useEffect(() => {
        const library = readSessionLibrary();
        const names = Object.keys(library).sort((left, right) => left.localeCompare(right));
        setSavedSessionNames(names);
        setSelectedSessionName((current) => (current && names.includes(current) ? current : names[0] || ""));
    }, []);

    const ensureMermaid = async (): Promise<void> => {
        if (window.mermaid) return;
        const mod = await import("mermaid");
        const mermaid = mod.default ?? (mod as any);
        mermaid.initialize({
            startOnLoad: false,
            theme: "default",
            themeVariables: {
                primaryColor: "#0e639c",
                primaryTextColor: "#fff",
                primaryBorderColor: "#0a4f7c",
                lineColor: "#0e639c",
                secondaryColor: "#f3f4f6",
                tertiaryColor: "#e5e7eb",
            },
        });
        (window as any).mermaid = mermaid;
    };

    const loadSolutions = async () => {
        try {
            const client = new DataverseClient(
                {
                    environmentUrl: connectionUrl,
                    accessToken,
                },
                isPPTB,
            );
            const solutionList = await client.listSolutions();
            setSolutions(solutionList);
        } catch (err: any) {
            showError(`Failed to load solutions: ${err.message}`);
        }
    };

    const showError = (message: string) => {
        setError(message);
        setTimeout(() => setError(""), ERROR_DISPLAY_DURATION_MS);
        if (isPPTB && window.toolboxAPI?.utils?.showNotification) {
            void window.toolboxAPI.utils.showNotification({
                title: "Error",
                body: message,
                type: "error",
            });
        }
    };

    const pushSnapshot = (model: ERDEditorModel, nextPositions: GraphPositions) => {
        setHistoryPast((prev) => [...prev, { model: cloneModel(model), positions: { ...nextPositions } }]);
        setHistoryFuture([]);
    };

    const applyModelChange = (nextModel: ERDEditorModel, nextPositions: GraphPositions = positions) => {
        if (!workingModel) return;
        pushSnapshot(workingModel, positions);
        setWorkingModel(nextModel);
        setPositions(nextPositions);
        setPublishResult(null);
    };

    const resetHistory = () => {
        setHistoryPast([]);
        setHistoryFuture([]);
    };

    const validateLogicalName = (name: string, kind: "table" | "attribute") => {
        const trimmed = name.trim();
        if (!trimmed) return `${kind} logical name is required.`;
        if (!/^[a-z][a-z0-9_]*$/i.test(trimmed)) return `${kind} logical name must start with a letter and contain only alphanumeric/underscore.`;
        if (RESERVED_NAMES.has(trimmed.toLowerCase())) return `${kind} logical name '${trimmed}' is reserved.`;
        return "";
    };

    const ensurePublisherPrefix = (logicalName: string): string => {
        const trimmed = logicalName.trim();
        if (!workingModel) return trimmed;
        const prefix = (workingModel.publisherPrefix || "").trim().toLowerCase();
        if (!prefix) return trimmed;
        const expectedPrefix = `${prefix}_`;
        return trimmed.toLowerCase().startsWith(expectedPrefix) ? trimmed : `${expectedPrefix}${trimmed}`;
    };
    const stripPublisherPrefix = (logicalName: string): string => {
        if (!workingModel) return logicalName;
        const prefix = (workingModel.publisherPrefix || "").trim().toLowerCase();
        if (!prefix) return logicalName;
        const expectedPrefix = `${prefix}_`;
        return logicalName.toLowerCase().startsWith(expectedPrefix) ? logicalName.slice(expectedPrefix.length) : logicalName;
    };

    const buildRelationshipSchemaName = (fromLogicalName: string, toLogicalName: string, linkAttributeName: string, manualDraft: string): string => {
        const manual = manualDraft.trim();
        if (manual) {
            return ensurePublisherPrefix(manual);
        }

        const fromPart = stripPublisherPrefix(fromLogicalName);
        const toPart = stripPublisherPrefix(toLogicalName);
        const linkPart = stripPublisherPrefix(linkAttributeName);
        return ensurePublisherPrefix(`${fromPart}_${toPart}_${linkPart}`);
    };

    const relationshipNameSuggestion = useMemo(() => {
        if (!workingModel || !selectedTable) return "";
        const targetLogical = selectedRelationshipTargetTable?.logicalName || selectedTable.logicalName;
        const linkAttributeName = relationshipType === "ManyToMany" ? `${selectedTable.logicalName}id` : selectedRelationshipTargetTable?.primaryIdAttribute || `${selectedTable.logicalName}id`;
        return buildRelationshipSchemaName(selectedTable.logicalName, targetLogical, linkAttributeName, "");
    }, [workingModel, selectedTable, selectedRelationshipTargetTable, relationshipType]);

    useEffect(() => {
        if (!relationshipNameSuggestion) return;
        if (!relationshipNameTouched || !relationshipName.trim()) {
            setRelationshipName(relationshipNameSuggestion);
        }
    }, [relationshipNameSuggestion, relationshipNameTouched, relationshipName]);

    const handleLoadSolution = async () => {
        if (!selectedSolution) {
            showError("Please select a solution first.");
            return;
        }

        try {
            setLoading(true);
            const client = new DataverseClient({ environmentUrl: connectionUrl, accessToken }, isPPTB);
            const solution: DataverseSolution = await client.fetchSolution(selectedSolution);
            const editorModel = toEditorModel(solution);
            const defaultPositions = generateGridLayout(editorModel);

            setBaselineModel(editorModel);
            setWorkingModel(cloneModel(editorModel));
            setPositions(defaultPositions);
            setGraphBootTick((tick) => tick + 1);
            setSelectedTableId(editorModel.tables[0]?.id || "");
            setRelationshipTarget(editorModel.tables[1]?.id || editorModel.tables[0]?.id || "");
            setRenameTableDisplayName(editorModel.tables[0]?.displayName || "");
            resetHistory();

            if (isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "Interactive ERD loaded.",
                    type: "success",
                });
            }
        } catch (err: any) {
            showError(`Failed to load ERD: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleUndo = () => {
        if (!workingModel || historyPast.length === 0) return;
        const previous = historyPast[historyPast.length - 1];
        setHistoryPast((prev) => prev.slice(0, -1));
        setHistoryFuture((prev) => [{ model: cloneModel(workingModel), positions: { ...positions } }, ...prev]);
        setWorkingModel(cloneModel(previous.model));
        setPositions({ ...previous.positions });
    };

    const handleRedo = () => {
        if (!workingModel || historyFuture.length === 0) return;
        const next = historyFuture[0];
        setHistoryFuture((prev) => prev.slice(1));
        setHistoryPast((prev) => [...prev, { model: cloneModel(workingModel), positions: { ...positions } }]);
        setWorkingModel(cloneModel(next.model));
        setPositions({ ...next.positions });
    };

    const handleAddTable = () => {
        if (!workingModel) return;

        const tableLogicalName = ensurePublisherPrefix(newTableLogicalName);
        const tableDisplayName = newTableDisplayName.trim() || tableLogicalName;

        const tableError = validateLogicalName(tableLogicalName, "table");
        if (tableError) {
            showError(tableError);
            return;
        }

        if (workingModel.tables.some((table) => table.logicalName.toLowerCase() === tableLogicalName.toLowerCase())) {
            showError(`Table logical name '${tableLogicalName}' already exists.`);
            return;
        }

        const primaryId = `${tableLogicalName}id`;
        const primaryName = "name";
        const tableId = makeId("table");

        const nextModel = cloneModel(workingModel);
        nextModel.tables.push({
            id: tableId,
            logicalName: tableLogicalName,
            displayName: tableDisplayName,
            schemaName: tableLogicalName,
            primaryIdAttribute: primaryId,
            primaryNameAttribute: primaryName,
            tableType: "Standard",
            isIntersect: false,
            attributes: [
                {
                    id: makeId("attr"),
                    logicalName: primaryId,
                    displayName: `${tableDisplayName} Identifier`,
                    type: "guid",
                    isPrimaryId: true,
                    isPrimaryName: false,
                    isRequired: true,
                },
                {
                    id: makeId("attr"),
                    logicalName: primaryName,
                    displayName: `${tableDisplayName} Name`,
                    type: "string",
                    isPrimaryId: false,
                    isPrimaryName: true,
                    isRequired: true,
                },
            ],
        });

        const layout = mergePositions(positions, generateGridLayout(nextModel));
        applyModelChange(nextModel, layout);
        setNewTableLogicalName("");
        setNewTableDisplayName("");
        setSelectedTableId(tableId);
    };

    const handleRenameTable = () => {
        if (!workingModel || !selectedTable) return;
        const nextDisplayName = renameTableDisplayName.trim();
        if (!nextDisplayName) {
            showError("Table display name cannot be empty.");
            return;
        }

        const nextModel = cloneModel(workingModel);
        const table = nextModel.tables.find((t) => t.id === selectedTable.id);
        if (!table) return;
        table.displayName = nextDisplayName;
        applyModelChange(nextModel);
    };

    const handleAddAttribute = () => {
        if (!workingModel || !selectedTable) return;
        const logical = ensurePublisherPrefix(newAttributeLogicalName);
        const display = newAttributeDisplayName.trim() || logical;

        const attrError = validateLogicalName(logical, "attribute");
        if (attrError) {
            showError(attrError);
            return;
        }

        if (selectedTable.attributes.some((a) => a.logicalName.toLowerCase() === logical.toLowerCase())) {
            showError(`Attribute logical name '${logical}' already exists in table '${selectedTable.logicalName}'.`);
            return;
        }

        const nextModel = cloneModel(workingModel);
        const table = nextModel.tables.find((t) => t.id === selectedTable.id);
        if (!table) return;

        table.attributes.unshift({
            id: makeId("attr"),
            logicalName: logical,
            displayName: display,
            type: newAttributeType,
            isPrimaryId: false,
            isPrimaryName: false,
            isRequired: false,
        });

        applyModelChange(nextModel);
        setNewAttributeLogicalName("");
        setNewAttributeDisplayName("");
    };

    const handleAddRelationship = () => {
        if (!workingModel || !selectedTable) return;
        if (!relationshipTarget) {
            showError("Please choose a target table for the relationship.");
            return;
        }

        // Deliberate editor UX constraint: self-links for 1:N and N:1 are hidden to avoid overlapping edge UX.
        if (relationshipTarget === selectedTable.id && relationshipType !== "ManyToMany") {
            showError("Self-relationship is allowed only for Many-to-Many in this editor.");
            return;
        }

        const schemaName = relationshipName.trim();
        const targetTableForName = workingModel.tables.find((table) => table.id === relationshipTarget);
        const linkAttributeName = relationshipType === "ManyToMany" ? `${selectedTable.logicalName}id` : targetTableForName?.primaryIdAttribute || `${selectedTable.logicalName}id`;
        const normalizedSchemaName = buildRelationshipSchemaName(selectedTable.logicalName, targetTableForName?.logicalName || selectedTable.logicalName, linkAttributeName, schemaName);

        const duplicate = workingModel.relationships.some(
            (relationship) =>
                relationship.schemaName.toLowerCase() === normalizedSchemaName.toLowerCase() && relationship.fromTableId === selectedTable.id && relationship.toTableId === relationshipTarget,
        );

        if (duplicate) {
            showError(`Relationship '${normalizedSchemaName}' already exists between selected tables.`);
            return;
        }

        const nextModel = cloneModel(workingModel);
        const targetTable = nextModel.tables.find((table) => table.id === relationshipTarget);
        nextModel.relationships.push({
            id: makeId("rel"),
            schemaName: normalizedSchemaName,
            type: relationshipType,
            fromTableId: selectedTable.id,
            toTableId: relationshipTarget,
            lookupAttribute: relationshipType === "ManyToMany" ? undefined : targetTable?.primaryIdAttribute || `${selectedTable.logicalName}id`,
            intersectTable: relationshipType === "ManyToMany" ? `${selectedTable.logicalName}_${normalizedSchemaName}` : undefined,
        });
        applyModelChange(nextModel);
        setRelationshipName("");
        setRelationshipNameTouched(false);
    };

    const handlePublishRequest = () => {
        if (changeCount === 0) {
            showError("No changes to publish.");
            return;
        }
        setShowPublishConfirm(true);
    };

    const handlePublish = async () => {
        if (!workingModel || !baselineModel || !diff) return;

        setShowPublishConfirm(false);
        setPublishing(true);
        setPublishResult(null);

        try {
            const client = new DataverseClient({ environmentUrl: connectionUrl, accessToken }, isPPTB);
            const result = await client.publishModelChanges(baselineModel, workingModel, diff);
            const lines = result.results.map((item) => `${item.success ? "✅" : "❌"} ${item.name}: ${item.message}`);
            setPublishResult({ success: result.success, lines });

            if (result.success) {
                const refreshed = await client.fetchSolution(selectedSolution);
                const refreshedModel = toEditorModel(refreshed);
                setBaselineModel(refreshedModel);
                setWorkingModel(cloneModel(refreshedModel));
                setPositions(mergePositions(positions, generateGridLayout(refreshedModel)));
                setGraphBootTick((tick) => tick + 1);
                resetHistory();
            }
        } catch (err: any) {
            showError(`Publish failed: ${err.message}`);
        } finally {
            setPublishing(false);
        }
    };

    const fitGraphToView = () => {
        if (!reactFlowInstance) return;
        reactFlowInstance.fitView({ padding: 0.2, duration: 450 });
    };

    const handleResetView = () => {
        if (!reactFlowInstance) return;
        reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 260 });
    };

    const handleAutoLayout = () => {
        if (!workingModel) return;
        const nextPositions = mergePositions(positions, generateGridLayout(workingModel));
        setPositions(nextPositions);
        window.setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2, duration: 350 }), 0);
    };

    const saveFileWithFallback = async (fileName: string, contents: string, mimeType = "text/plain;charset=utf-8") => {
        const saveFileFn = window.toolboxAPI?.utils && (window.toolboxAPI.utils as any).saveFile;

        if (typeof saveFileFn === "function") {
            await saveFileFn(fileName, contents);
            return;
        }

        const blob = new Blob([contents], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const saveBlob = (fileName: string, blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const svgToPngBlob = async (svgMarkup: string): Promise<Blob> => {
        const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
        const objectUrl = URL.createObjectURL(svgBlob);

        try {
            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("Failed to convert SVG to PNG."));
                img.src = objectUrl;
            });

            const width = Math.max(1, Math.ceil(image.width || 1200));
            const height = Math.max(1, Math.ceil(image.height || 800));
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas 2D context unavailable.");
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0, width, height);

            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
            if (!blob) throw new Error("Failed to encode PNG.");
            return blob;
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    };

    const getFlowVisualExportArtifact = async (visualType: VisualExportType, baseName: string): Promise<{ fileName: string; contents?: string; mimeType?: string; blob?: Blob }> => {
        const canvasNode = document.querySelector(".graph-canvas") as HTMLElement | null;
        if (!canvasNode) throw new Error("Flow canvas not found for visual export.");

        const previousViewport = reactFlowInstance?.toObject().viewport;
        if (reactFlowInstance) {
            await reactFlowInstance.fitView({ padding: 0.2, duration: 0 });
            await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
        }

        const restoreViewport = async () => {
            if (!reactFlowInstance || !previousViewport) return;
            await reactFlowInstance.setViewport(previousViewport, { duration: 0 });
        };

        try {
            if (visualType === "html") {
                const svgDataUrl = await toSvg(canvasNode, { cacheBust: true, pixelRatio: 2, width: canvasNode.scrollWidth, height: canvasNode.scrollHeight });
                const svgMarkup = decodeDataUrlText(svgDataUrl);
                const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    body { margin: 0; padding: 16px; font-family: Segoe UI, sans-serif; background: #f8fafc; }
    .flow-export-surface { display: inline-block; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: auto; }
    .flow-export-surface svg { display: block; width: 100%; height: auto; }
  </style>
</head>
<body>
    <div class="flow-export-surface">${svgMarkup}</div>
</body>
</html>`;

                return {
                    fileName: `${baseName}.html`,
                    contents: html,
                    mimeType: "text/html;charset=utf-8",
                };
            }

            if (visualType === "svg") {
                const svgDataUrl = await toSvg(canvasNode, { cacheBust: true, pixelRatio: 2, width: canvasNode.scrollWidth, height: canvasNode.scrollHeight });
                const svgText = decodeDataUrlText(svgDataUrl);
                return {
                    fileName: `${baseName}.svg`,
                    contents: svgText,
                    mimeType: "image/svg+xml;charset=utf-8",
                };
            }

            const pngDataUrl = await toPng(canvasNode, { cacheBust: true, pixelRatio: 2, width: canvasNode.scrollWidth, height: canvasNode.scrollHeight });
            const blob = await dataUrlToBlob(pngDataUrl);
            return {
                fileName: `${baseName}.png`,
                blob,
            };
        } finally {
            await restoreViewport();
        }
    };

    const getVisualExportArtifact = async (
        format: OutputFormat,
        diagram: string,
        baseName: string,
        visualType: VisualExportType,
    ): Promise<{ fileName: string; contents?: string; mimeType?: string; blob?: Blob }> => {
        if (format === "flow") {
            return getFlowVisualExportArtifact(visualType, baseName);
        }

        if (format === "mermaid") {
            if (visualType === "svg" || visualType === "png") {
                await ensureMermaid();
                if (!window.mermaid) throw new Error("Mermaid renderer is unavailable.");
                const renderId = `export-mermaid-${Math.random().toString(36).slice(2)}`;
                const result = await window.mermaid.render(renderId, diagram);

                if (visualType === "svg") {
                    return {
                        fileName: `${baseName}.svg`,
                        contents: result.svg,
                        mimeType: "image/svg+xml;charset=utf-8",
                    };
                }

                const pngBlob = await svgToPngBlob(result.svg);
                return {
                    fileName: `${baseName}.png`,
                    blob: pngBlob,
                };
            }

            const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    body { margin: 0; padding: 16px; font-family: Segoe UI, sans-serif; background: #f8fafc; }
    .mermaid { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  </style>
</head>
<body>
  <div class="mermaid">${escapeHtml(diagram)}</div>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true, theme: "default" });
  </script>
</body>
</html>`;

            return {
                fileName: `${baseName}.html`,
                contents: html,
                mimeType: "text/html;charset=utf-8",
            };
        }

        if (format === "plantuml") {
            const encoded = plantumlEncoder.encode(diagram);

            if (visualType === "svg") {
                const response = await fetch(`https://www.plantuml.com/plantuml/svg/${encoded}`);
                if (!response.ok) throw new Error(`PlantUML HTTP ${response.status}`);
                const svg = await response.text();
                return {
                    fileName: `${baseName}.svg`,
                    contents: svg,
                    mimeType: "image/svg+xml;charset=utf-8",
                };
            }

            if (visualType === "png") {
                const response = await fetch(`https://www.plantuml.com/plantuml/png/${encoded}`);
                if (!response.ok) throw new Error(`PlantUML HTTP ${response.status}`);
                return {
                    fileName: `${baseName}.png`,
                    blob: await response.blob(),
                };
            }

            const imgUrl = `https://www.plantuml.com/plantuml/svg/${encoded}`;
            const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    body { margin: 0; padding: 16px; font-family: Segoe UI, sans-serif; background: #f8fafc; }
    .frame { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; overflow: auto; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="frame"><img src="${imgUrl}" alt="PlantUML Diagram" /></div>
</body>
</html>`;

            return {
                fileName: `${baseName}.html`,
                contents: html,
                mimeType: "text/html;charset=utf-8",
            };
        }

        if (visualType !== "html") {
            throw new Error("Draw.io visual export currently supports HTML only.");
        }

        const drawioUrl = `https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=ERD#R${encodeURIComponent(diagram)}`;
        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    html, body { margin: 0; height: 100%; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe src="${drawioUrl}" title="Draw.io Diagram"></iframe>
</body>
</html>`;

        return {
            fileName: `${baseName}.html`,
            contents: html,
            mimeType: "text/html;charset=utf-8",
        };
    };

    const handleDownload = async () => {
        const currentDiagram = generatedDiagrams[selectedFormat];
        if (!currentDiagram) return;

        const extensions: Record<OutputFormat, string> = {
            flow: "flow.json",
            mermaid: "mmd",
            plantuml: "puml",
            drawio: "drawio",
        };

        const sourceSuffix = exportSource === "baseline" ? "baseline" : exportChangedOnly ? "changed" : "working";
        const baseName = `${selectedSolution || "session"}-erd-${sourceSuffix}-${selectedFormat}`;
        const textFileName = `${baseName}.${extensions[selectedFormat]}`;
        const effectiveMode: ExportMode = selectedFormat === "flow" ? "visual" : exportMode;

        try {
            if (effectiveMode === "text") {
                await saveFileWithFallback(textFileName, currentDiagram, selectedFormat === "flow" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8");
            } else if (effectiveMode === "visual") {
                const visual = await getVisualExportArtifact(selectedFormat, currentDiagram, baseName, visualExportType);
                if (visual.blob) {
                    saveBlob(visual.fileName, visual.blob);
                } else {
                    await saveFileWithFallback(visual.fileName, visual.contents || "", visual.mimeType || "text/plain;charset=utf-8");
                }
            } else {
                await saveFileWithFallback(textFileName, currentDiagram, selectedFormat === "flow" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8");
                const visual = await getVisualExportArtifact(selectedFormat, currentDiagram, baseName, visualExportType);
                if (visual.blob) {
                    saveBlob(visual.fileName, visual.blob);
                } else {
                    await saveFileWithFallback(visual.fileName, visual.contents || "", visual.mimeType || "text/plain;charset=utf-8");
                }
            }

            if (isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "File download completed.",
                    type: "success",
                });
            }
        } catch (err: any) {
            showError(`Failed to save file: ${err.message}`);
        }
    };

    const handleCopyToClipboard = async () => {
        const currentDiagram = generatedDiagrams[selectedFormat];
        if (!currentDiagram) return;

        try {
            await copyText(currentDiagram);
            if (isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "Copied to clipboard.",
                    type: "success",
                });
            }
        } catch (err: any) {
            showError(`Failed to copy: ${err.message}`);
        }
    };

    const handleSaveSession = async () => {
        try {
            const payload = buildSessionPayload();
            if (!payload) {
                showError("Load or edit an ERD before saving a session.");
                return;
            }

            const sessionName = sessionNameInput.trim() || selectedSessionName.trim() || selectedSolution.trim() || "My Session";
            if (!sessionName) return;

            const library = readSessionLibrary();
            library[sessionName] = payload;
            localStorage.setItem(SESSION_LIBRARY_KEY, JSON.stringify(library));
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
            const names = Object.keys(library).sort((left, right) => left.localeCompare(right));
            setSavedSessionNames(names);
            setSelectedSessionName(sessionName);
            setSessionNameInput(sessionName);

            if (isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: `Session '${sessionName}' saved locally.`,
                    type: "success",
                });
            }
        } catch (err) {
            showError(`Failed to save session: ${(err as Error).message}`);
        }
    };

    const handleLoadSession = async () => {
        try {
            const library = readSessionLibrary();
            const names = Object.keys(library).sort((left, right) => left.localeCompare(right));
            if (names.length === 0) {
                showError("No saved session found.");
                return;
            }

            const pick = selectedSessionName.trim() || names[0];
            const payload = library[pick];
            if (!payload) {
                showError(`Session '${pick}' does not exist.`);
                return;
            }

            applySessionPayload(payload);
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
            setSavedSessionNames(names);
            setSelectedSessionName(pick);
            setSessionNameInput(pick);
            if (isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: `Session '${pick}' restored.`,
                    type: "success",
                });
            }
        } catch (err) {
            showError(`Failed to load session: ${(err as Error).message}`);
        }
    };

    const handleImportSession = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as Partial<PersistedSession> & { model?: ERDEditorModel; positions?: GraphPositions };

            if (parsed.workingModel) {
                applySessionPayload(parsed as PersistedSession);
            } else if (parsed.model) {
                const firstTableId = parsed.model.tables[0]?.id || "";
                const fallbackPayload: PersistedSession = {
                    version: SESSION_SHARE_VERSION,
                    solutionUniqueName: selectedSolution,
                    baselineModel: null,
                    workingModel: parsed.model,
                    positions: parsed.positions || {},
                    visualMode: "flow",
                    edgeType: "smoothstep",
                    hideAttributes: false,
                    hideRelationshipNames: false,
                    showChangedOnlyInGraph: false,
                    showImpactMarkers: true,
                    includeAttributes: true,
                    includeRelationships: true,
                    maxAttributesPerTable: 12,
                    exportSource: "working",
                    exportChangedOnly: false,
                    selectedTableId: firstTableId,
                    relationshipTarget: firstTableId,
                };
                applySessionPayload(fallbackPayload);
            } else {
                throw new Error("JSON is neither a session payload nor a flow export payload.");
            }
        } catch (err) {
            showError(`Failed to import session: ${(err as Error).message}`);
        } finally {
            event.target.value = "";
        }
    };

    const handleShareSessionFile = async () => {
        try {
            const payload = buildSessionPayload();
            if (!payload) {
                showError("Load or edit an ERD before sharing a session.");
                return;
            }

            const fileName = `${selectedSolution || "session"}-erd-session.json`;
            await saveFileWithFallback(fileName, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
            if (isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "Session file exported for sharing.",
                    type: "success",
                });
            }
        } catch (err) {
            showError(`Failed to share session: ${(err as Error).message}`);
        }
    };

    const renderPreview = (formatOverride?: OutputFormat) => {
        const activeFormat = formatOverride || selectedFormat;
        const currentDiagram = generatedDiagrams[activeFormat];
        if (!currentDiagram) return <div className="loading-mermaid">No diagram generated yet.</div>;

        if (previewMode === "text") {
            return <pre className="diagram-text">{currentDiagram}</pre>;
        }

        if (activeFormat === "mermaid") {
            if (!mermaidReady) return <div className="loading-mermaid">Loading mermaid renderer...</div>;
            return (
                <div
                    className="mermaid"
                    ref={(el) => {
                        (async () => {
                            if (!el) return;
                            try {
                                await ensureMermaid();
                                if (window.mermaid) {
                                    const renderId = `erd-mermaid-${Math.random().toString(36).slice(2)}`;
                                    const result = await window.mermaid.render(renderId, currentDiagram);
                                    el.innerHTML = result.svg;
                                    if (result.bindFunctions) {
                                        result.bindFunctions(el);
                                    }
                                }
                            } catch (err) {
                                console.error("Mermaid render error", err);
                                el.innerHTML = `<div class="loading-mermaid">Cannot render Mermaid. ${(err as Error).message}</div>`;
                            }
                        })();
                    }}
                />
            );
        }

        if (activeFormat === "plantuml") {
            return (
                <div
                    className="diagram-visual"
                    ref={(el) => {
                        (async () => {
                            if (!el) return;
                            try {
                                const encoded = plantumlEncoder.encode(currentDiagram);
                                const response = await fetch(`https://www.plantuml.com/plantuml/svg/${encoded}`);
                                if (!response.ok) throw new Error(`PlantUML HTTP ${response.status}`);
                                const svgText = await response.text();
                                const parser = new DOMParser();
                                const doc = parser.parseFromString(svgText, "image/svg+xml");
                                const svg = doc.querySelector("svg");
                                if (!svg) throw new Error("No SVG returned from PlantUML.");
                                svg.querySelectorAll("script").forEach((node) => node.remove());
                                svg.querySelectorAll("*").forEach((node) => {
                                    Array.from(node.attributes).forEach((attr) => {
                                        if (attr.name.toLowerCase().startsWith("on")) {
                                            node.removeAttribute(attr.name);
                                        }
                                    });
                                });
                                el.innerHTML = "";
                                el.appendChild(svg);
                            } catch (err) {
                                el.innerHTML = `<div class="loading-mermaid">Cannot render PlantUML. ${(err as Error).message}</div>`;
                            }
                        })();
                    }}
                />
            );
        }

        return (
            <div
                className="diagram-visual"
                ref={(el) => {
                    if (!el) return;
                    const iframe = document.createElement("iframe");
                    iframe.style.width = "100%";
                    iframe.style.height = "600px";
                    iframe.style.border = "1px solid var(--border-color)";
                    iframe.style.borderRadius = "6px";
                    iframe.src = `https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=ERD#R${encodeURIComponent(currentDiagram)}`;
                    el.innerHTML = "";
                    el.appendChild(iframe);
                }}
            />
        );
    };

    const renderGraph = () => {
        if (!workingModel) {
            return <div className="loading-mermaid">Load a solution to start graph editing.</div>;
        }

        const visibleTables = workingModel.tables.filter((table) => visibleTableIds.has(table.id));
        const visibleTableIdSet = new Set(visibleTables.map((table) => table.id));
        const visibleRelationships = includeRelationships
            ? workingModel.relationships
                  .filter((rel) => visibleTableIdSet.has(rel.fromTableId) && visibleTableIdSet.has(rel.toTableId))
                  .filter((rel) => rel.fromTableId !== rel.toTableId)
                  .filter((rel, index, all) => {
                      const key = [rel.schemaName, ...[rel.fromTableId, rel.toTableId].sort()].join("|");
                      return index === all.findIndex((candidate) => [candidate.schemaName, ...[candidate.fromTableId, candidate.toTableId].sort()].join("|") === key);
                  })
            : [];

        const nodes: Node<GraphTableNodeData>[] = visibleTables.map((table, index) => {
            const tablePosition = positions[table.id] || { x: 24, y: 24 };
            const isNewTable = !!diff?.newTableIds.has(table.id);
            const isRenamed = !!diff?.renamedTableIds.has(table.id);
            const hasAttributeChanges = table.attributes.some((attribute) => !!diff && (diff.newAttributeIds.has(attribute.id) || diff.renamedAttributeIds.has(attribute.id)));
            const impact = hasAttributeChanges || isNewTable || isRenamed ? getImpactLevel(table.attributes.length) : "none";

            return {
                id: table.id,
                type: "tableNode",
                position: tablePosition,
                selected: selectedTableId === table.id,
                data: {
                    table,
                    isNewTable,
                    isRenamed,
                    showImpactMarkers,
                    impact,
                    maxVisibleAttributes: GRAPH_NODE_MAX_VISIBLE_ATTRIBUTES,
                    hideAttributes,
                    customAttributeCount: table.attributes.filter((attribute) => attribute.logicalName.toLowerCase().startsWith(`${workingModel.publisherPrefix.toLowerCase()}_`)).length,
                    totalAttributeCount: table.attributes.length,
                    animateIn: graphEntryAnimating,
                    animationDelayMs: Math.min(450, index * 40),
                    newAttributeIds: diff?.newAttributeIds || new Set<string>(),
                    renamedAttributeIds: diff?.renamedAttributeIds || new Set<string>(),
                    onSelect: (tableId: string, displayName: string) => {
                        setSelectedTableId(tableId);
                        setRenameTableDisplayName(displayName);
                    },
                },
            };
        });

        const edges = visibleRelationships.map((relationship) => ({
            id: relationship.id,
            source: relationship.fromTableId,
            target: relationship.toTableId,
            label: hideRelationshipNames ? undefined : relationship.schemaName,
            animated: !!diff?.newRelationshipIds.has(relationship.id),
            type: edgeType,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { stroke: diff?.newRelationshipIds.has(relationship.id) ? "#2f89fc" : "#7f8ea3", strokeWidth: 1.7 },
            labelStyle: { fill: "#667085", fontSize: 11, fontWeight: 600 },
            labelBgStyle: { fill: "#ffffff", fillOpacity: 0.8 },
            labelBgPadding: [4, 2] as [number, number],
        }));

        return (
            <div className={`graph-canvas ${graphEntryAnimating ? "is-entering" : ""}`}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    defaultEdgeOptions={{ type: edgeType, markerEnd: { type: MarkerType.ArrowClosed } }}
                    onInit={setReactFlowInstance}
                    onNodeClick={(_, node) => {
                        const currentTable = workingModel.tables.find((table) => table.id === node.id);
                        if (!currentTable) return;
                        setSelectedTableId(node.id);
                        setRenameTableDisplayName(currentTable.displayName);
                    }}
                    onNodeDragStart={() => {
                        if (workingModel) pushSnapshot(workingModel, positions);
                    }}
                    onNodeDragStop={(_, node) => {
                        setPositions((prev) => ({
                            ...prev,
                            [node.id]: { x: node.position.x, y: node.position.y },
                        }));
                    }}
                    fitView
                    fitViewOptions={{ padding: 0.2 }}
                    connectionLineType={edgeType}
                    minZoom={0.25}
                    maxZoom={2.2}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background gap={20} size={1} color="rgba(108, 117, 125, 0.2)" />
                    <Controls showInteractive={false} />
                </ReactFlow>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="container">
                <div className="loading">Loading...</div>
            </div>
        );
    }

    return (
        <div className="container">
            {error && <div className="error-banner">{error}</div>}

            {/* ── TOP BAR ─────────────────────────────────────────────── */}
            <header className="topbar" ref={topbarRef}>
                <div className="topbar-section">
                    <select className="topbar-select" value={selectedSolution} onChange={(event) => setSelectedSolution(event.target.value)} disabled={solutions.length === 0}>
                        <option value="">Select solution…</option>
                        {solutions.map((solution) => (
                            <option key={solution.uniqueName} value={solution.uniqueName}>
                                {solution.displayName} ({solution.version})
                            </option>
                        ))}
                    </select>
                    <button className="btn btn-primary topbar-load-btn" onClick={handleLoadSolution} disabled={!selectedSolution || loading}>
                        Load ERD
                    </button>
                </div>

                <div className="topbar-divider" />

                <div className="topbar-flyout">
                    <button
                        className={`btn btn-tool ${openTopbarFlyout === "display" ? "is-active" : ""}`}
                        onClick={() => setOpenTopbarFlyout((current) => (current === "display" ? null : "display"))}
                    >
                        Display: {visualMode === "flow" ? "Flow" : visualMode === "drawio" ? "Draw.io" : visualMode === "plantuml" ? "PlantUML" : "Mermaid"} ▾
                    </button>
                    {openTopbarFlyout === "display" && (
                        <div className="topbar-flyout-menu">
                            <div className="topbar-flyout-section-title">Visual</div>
                            <button
                                className={`btn btn-tool ${visualMode === "flow" ? "is-active" : ""}`}
                                onClick={() => {
                                    setVisualMode("flow");
                                    setOpenTopbarFlyout(null);
                                }}
                            >
                                Flow
                            </button>
                            <button
                                className={`btn btn-tool ${visualMode === "mermaid" ? "is-active" : ""}`}
                                onClick={() => {
                                    setVisualMode("mermaid");
                                    setOpenTopbarFlyout(null);
                                }}
                            >
                                Mermaid
                            </button>
                            <button
                                className={`btn btn-tool ${visualMode === "drawio" ? "is-active" : ""}`}
                                onClick={() => {
                                    setVisualMode("drawio");
                                    setOpenTopbarFlyout(null);
                                }}
                            >
                                Draw.io
                            </button>
                            <button
                                className={`btn btn-tool ${visualMode === "plantuml" ? "is-active" : ""}`}
                                onClick={() => {
                                    setVisualMode("plantuml");
                                    setOpenTopbarFlyout(null);
                                }}
                            >
                                PlantUML
                            </button>

                            {visualMode === "flow" ? (
                                <>
                                    <div className="topbar-flyout-section-title">Edges</div>
                                    <button className={`btn btn-tool ${edgeType === "step" ? "is-active" : ""}`} onClick={() => setEdgeType("step")}>
                                        Step
                                    </button>
                                    <button className={`btn btn-tool ${edgeType === "smoothstep" ? "is-active" : ""}`} onClick={() => setEdgeType("smoothstep")}>
                                        Smooth-step
                                    </button>
                                    <button className={`btn btn-tool ${edgeType === "bezier" ? "is-active" : ""}`} onClick={() => setEdgeType("bezier")}>
                                        Bezier
                                    </button>

                                    <label className="topbar-toggle">
                                        <input type="checkbox" checked={hideAttributes} onChange={(event) => setHideAttributes(event.target.checked)} />
                                        <span>Hide attributes</span>
                                    </label>
                                    <label className="topbar-toggle">
                                        <input type="checkbox" checked={hideRelationshipNames} onChange={(event) => setHideRelationshipNames(event.target.checked)} />
                                        <span>Hide relationship name</span>
                                    </label>
                                </>
                            ) : (
                                <div className="topbar-flyout-note">Flow-only display options are hidden for this visual mode.</div>
                            )}
                        </div>
                    )}
                </div>

                {workingModel && (
                    <>
                        <div className="topbar-divider" />
                        <div className="topbar-flyout">
                            <button
                                className={`btn btn-tool ${openTopbarFlyout === "canvas" ? "is-active" : ""}`}
                                onClick={() => setOpenTopbarFlyout((current) => (current === "canvas" ? null : "canvas"))}
                                disabled={visualMode !== "flow"}
                                title={visualMode !== "flow" ? "Canvas options are available only in Flow mode" : "Canvas options"}
                            >
                                Canvas ▾
                            </button>
                            {openTopbarFlyout === "canvas" && (
                                <div className="topbar-flyout-menu topbar-flyout-menu-canvas">
                                    <button className="btn btn-tool" onClick={fitGraphToView} title="Fit graph to view">
                                        Fit
                                    </button>
                                    <button className="btn btn-tool" onClick={handleResetView} title="Reset view">
                                        Reset
                                    </button>
                                    <button className="btn btn-tool" onClick={handleAutoLayout} title="Auto-layout nodes">
                                        Auto-layout
                                    </button>
                                    <label className="topbar-toggle">
                                        <input type="checkbox" checked={showChangedOnlyInGraph} onChange={(event) => setShowChangedOnlyInGraph(event.target.checked)} />
                                        <span>Changed only</span>
                                    </label>
                                    <label className="topbar-toggle">
                                        <input type="checkbox" checked={showImpactMarkers} onChange={(event) => setShowImpactMarkers(event.target.checked)} />
                                        <span>Impact markers</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="topbar-divider" />
                        <div className="topbar-section">
                            <button className="btn btn-tool" onClick={handleUndo} disabled={historyPast.length === 0} title="Undo">
                                ↩
                            </button>
                            <button className="btn btn-tool" onClick={handleRedo} disabled={historyFuture.length === 0} title="Redo">
                                ↪
                            </button>
                        </div>

                        <div className="topbar-divider" />
                        <button className={`btn btn-tool ${showExportPanel ? "is-active" : ""}`} onClick={() => setShowExportPanel((v) => !v)} title="Toggle export panel">
                            Export
                        </button>
                    </>
                )}

                <div className="topbar-divider" />
                <div className="topbar-flyout">
                    <button
                        className={`btn btn-tool ${openTopbarFlyout === "session" ? "is-active" : ""}`}
                        onClick={() => setOpenTopbarFlyout((current) => (current === "session" ? null : "session"))}
                        title="Session actions"
                    >
                        Session ▾
                    </button>
                    {openTopbarFlyout === "session" && (
                        <div className="topbar-flyout-menu topbar-flyout-menu-canvas">
                            <div className="topbar-flyout-section-title">Session Name</div>
                            <input className="session-input" value={sessionNameInput} onChange={(event) => setSessionNameInput(event.target.value)} placeholder="Enter a name to save" />
                            <div className="topbar-flyout-section-title">Saved Sessions</div>
                            <select className="session-select" value={selectedSessionName} onChange={(event) => setSelectedSessionName(event.target.value)}>
                                <option value="">Select a saved session…</option>
                                {savedSessionNames.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                            <button className="btn btn-tool" onClick={handleSaveSession} disabled={!sessionNameInput.trim() && !selectedSessionName.trim() && !selectedSolution.trim()}>
                                Save Session
                            </button>
                            <button className="btn btn-tool" onClick={handleLoadSession} disabled={savedSessionNames.length === 0}>
                                Load Session
                            </button>
                            <button className="btn btn-tool" onClick={handleShareSessionFile} disabled={!workingModel}>
                                Share Session (JSON)
                            </button>
                            <button className="btn btn-tool" onClick={() => sessionFileInputRef.current?.click()}>
                                Import Session JSON
                            </button>
                            <div className="topbar-flyout-note">Saved sessions can be loaded directly without selecting a solution first.</div>
                        </div>
                    )}
                </div>

                <div className="topbar-spacer" />

                {workingModel && (
                    <div className="topbar-section">
                        {changeCount > 0 && (
                            <span className="change-pill has-changes">
                                {changeCount} {changeCount === 1 ? "change" : "changes"}
                            </span>
                        )}
                        <button className="btn btn-publish" onClick={handlePublishRequest} disabled={publishing || changeCount === 0}>
                            {publishing ? "Publishing…" : "↑ Publish"}
                        </button>
                    </div>
                )}
            </header>

            {/* ── WORKSPACE ────────────────────────────────────────────── */}
            <div className="workspace">
                <div className="workspace-canvas">
                    {visualMode === "flow" ? renderGraph() : <div className="preview-container">{renderPreview(visualMode)}</div>}

                    {/* Floating action dock: Add / Update */}
                    {workingModel && visualMode === "flow" && (
                        <>
                            <button className={`canvas-fab ${showCanvasActionPanel ? "is-open" : ""}`} onClick={() => setShowCanvasActionPanel((open) => !open)} title="Open add and update actions">
                                {showCanvasActionPanel ? "Close" : "Add / Update"}
                            </button>
                            {showCanvasActionPanel && (
                                <div className="canvas-action-dock">
                                    <div className="canvas-action-tabs">
                                        <button className={`tab-btn ${canvasActionTab === "table" ? "is-active" : ""}`} onClick={() => setCanvasActionTab("table")}>
                                            Table
                                        </button>
                                        <button className={`tab-btn ${canvasActionTab === "attribute" ? "is-active" : ""}`} onClick={() => setCanvasActionTab("attribute")} disabled={!selectedTable}>
                                            Attribute
                                        </button>
                                        <button
                                            className={`tab-btn ${canvasActionTab === "relationship" ? "is-active" : ""}`}
                                            onClick={() => setCanvasActionTab("relationship")}
                                            disabled={!selectedTable}
                                        >
                                            Relationship
                                        </button>
                                    </div>

                                    {canvasActionTab === "table" && (
                                        <div className="canvas-action-body">
                                            <div className="form-group">
                                                <label>Add table</label>
                                                <div className="prefix-inline">
                                                    <span className="prefix-chip">{publisherPrefixWithUnderscore || "prefix_"}</span>
                                                    <input value={newTableLogicalName} onChange={(event) => setNewTableLogicalName(event.target.value)} placeholder="table_suffix" />
                                                </div>
                                                <input value={newTableDisplayName} onChange={(event) => setNewTableDisplayName(event.target.value)} placeholder="Display Name (optional)" />
                                                <button className="btn btn-primary" onClick={handleAddTable}>
                                                    Add Table
                                                </button>
                                            </div>

                                            {selectedTable && (
                                                <div className="form-group">
                                                    <label>Rename selected table</label>
                                                    <input value={renameTableDisplayName} onChange={(event) => setRenameTableDisplayName(event.target.value)} placeholder="Table display name" />
                                                    <button className="btn btn-secondary" onClick={handleRenameTable}>
                                                        Update Name
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {canvasActionTab === "attribute" && selectedTable && (
                                        <div className="canvas-action-body">
                                            <div className="form-group">
                                                <label>
                                                    Add attribute to <span className="entity-focus-chip">{selectedTable.displayName}</span>
                                                </label>
                                                <div className="prefix-inline">
                                                    <span className="prefix-chip">{publisherPrefixWithUnderscore || "prefix_"}</span>
                                                    <input value={newAttributeLogicalName} onChange={(event) => setNewAttributeLogicalName(event.target.value)} placeholder="attribute_suffix" />
                                                </div>
                                                <input value={newAttributeDisplayName} onChange={(event) => setNewAttributeDisplayName(event.target.value)} placeholder="Display name" />
                                                <select value={newAttributeType} onChange={(event) => setNewAttributeType(event.target.value)}>
                                                    <option value="string">string</option>
                                                    <option value="int">int</option>
                                                    <option value="decimal">decimal</option>
                                                    <option value="datetime">datetime</option>
                                                    <option value="boolean">boolean</option>
                                                    <option value="lookup">lookup</option>
                                                </select>
                                                <button className="btn btn-primary" onClick={handleAddAttribute}>
                                                    Add Attribute
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {canvasActionTab === "relationship" && selectedTable && (
                                        <div className="canvas-action-body">
                                            <div className="form-group">
                                                <label>
                                                    Add relationship from <span className="entity-focus-chip">{selectedTable.displayName}</span>
                                                </label>
                                                <div className="prefix-inline">
                                                    <span className="prefix-chip">{publisherPrefixWithUnderscore || "prefix_"}</span>
                                                    <input
                                                        value={relationshipName}
                                                        onChange={(event) => {
                                                            setRelationshipName(event.target.value);
                                                            setRelationshipNameTouched(true);
                                                        }}
                                                        placeholder="relationship_suffix (optional)"
                                                    />
                                                </div>
                                                <select value={relationshipTarget} onChange={(event) => setRelationshipTarget(event.target.value)}>
                                                    {workingModel.tables.map((table) => (
                                                        <option key={table.id} value={table.id}>
                                                            {table.displayName}
                                                        </option>
                                                    ))}
                                                </select>
                                                <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as "OneToMany" | "ManyToOne" | "ManyToMany")}>
                                                    <option value="ManyToOne">ManyToOne</option>
                                                    <option value="OneToMany">OneToMany</option>
                                                    <option value="ManyToMany">ManyToMany</option>
                                                </select>
                                                <button className="btn btn-primary" onClick={handleAddRelationship}>
                                                    Add Relationship
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Export side panel */}
                {showExportPanel && workingModel && (
                    <aside className="export-panel">
                        <div className="panel-header">
                            <span>Export</span>
                            <button className="panel-close" onClick={() => setShowExportPanel(false)}>
                                ✕
                            </button>
                        </div>
                        <div className="panel-body">
                            <div className="form-group">
                                <label>Source</label>
                                <div className="format-selector">
                                    <button className={`format-btn ${exportSource === "working" ? "active" : ""}`} onClick={() => setExportSource("working")}>
                                        Working
                                    </button>
                                    <button className={`format-btn ${exportSource === "baseline" ? "active" : ""}`} onClick={() => setExportSource("baseline")}>
                                        Baseline
                                    </button>
                                </div>
                                <label className="option-item">
                                    <input type="checkbox" checked={exportChangedOnly} disabled={exportSource !== "working"} onChange={(event) => setExportChangedOnly(event.target.checked)} />
                                    <span className="inline-label">Changed only</span>
                                </label>
                            </div>

                            <div className="form-group">
                                <label>Diagram</label>
                                <div className="format-selector format-selector-grid">
                                    <button className={`format-btn ${selectedFormat === "flow" ? "active" : ""}`} onClick={() => setSelectedFormat("flow")}>
                                        Flow
                                    </button>
                                    <button className={`format-btn ${selectedFormat === "mermaid" ? "active" : ""}`} onClick={() => setSelectedFormat("mermaid")}>
                                        Mermaid
                                    </button>
                                    <button className={`format-btn ${selectedFormat === "plantuml" ? "active" : ""}`} onClick={() => setSelectedFormat("plantuml")}>
                                        PlantUML
                                    </button>
                                    <button className={`format-btn ${selectedFormat === "drawio" ? "active" : ""}`} onClick={() => setSelectedFormat("drawio")}>
                                        Draw.io
                                    </button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Format</label>
                                <div className="format-selector">
                                    <button className={`format-btn ${exportMode === "text" ? "active" : ""}`} onClick={() => setExportMode("text")} disabled={selectedFormat === "flow"}>
                                        Text
                                    </button>
                                    <button className={`format-btn ${exportMode === "visual" ? "active" : ""}`} onClick={() => setExportMode("visual")}>
                                        Visual
                                    </button>
                                    <button className={`format-btn ${exportMode === "both" ? "active" : ""}`} onClick={() => setExportMode("both")} disabled={selectedFormat === "flow"}>
                                        Both
                                    </button>
                                </div>
                                {selectedFormat === "flow" && <div className="muted-text">Flow exports are visual-only.</div>}
                            </div>

                            <div className="form-group">
                                <label>Visual Type</label>
                                <div className="format-selector">
                                    <button
                                        className={`format-btn ${visualExportType === "html" ? "active" : ""}`}
                                        onClick={() => setVisualExportType("html")}
                                        disabled={!availableVisualExportTypes.includes("html")}
                                    >
                                        HTML
                                    </button>
                                    <button
                                        className={`format-btn ${visualExportType === "svg" ? "active" : ""}`}
                                        onClick={() => setVisualExportType("svg")}
                                        disabled={!availableVisualExportTypes.includes("svg")}
                                    >
                                        SVG
                                    </button>
                                    <button
                                        className={`format-btn ${visualExportType === "png" ? "active" : ""}`}
                                        onClick={() => setVisualExportType("png")}
                                        disabled={!availableVisualExportTypes.includes("png")}
                                    >
                                        PNG
                                    </button>
                                </div>
                                {!availableVisualExportTypes.includes("svg") && !availableVisualExportTypes.includes("png") && (
                                    <div className="muted-text">This diagram supports HTML visual export only.</div>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Options</label>
                                <label className="option-item">
                                    <input type="checkbox" checked={includeAttributes} onChange={(event) => setIncludeAttributes(event.target.checked)} />
                                    <span className="inline-label">Include attributes</span>
                                </label>
                                <label className="option-item">
                                    <input type="checkbox" checked={includeRelationships} onChange={(event) => setIncludeRelationships(event.target.checked)} />
                                    <span className="inline-label">Include relationships</span>
                                </label>
                                <div className="option-item">
                                    <label htmlFor="maxAttributesInput" className="inline-label">
                                        Max attributes:
                                    </label>
                                    <input
                                        id="maxAttributesInput"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={maxAttributesPerTable}
                                        onChange={(event) => {
                                            const parsed = Number.parseInt(event.target.value, 10);
                                            if (!Number.isNaN(parsed) && parsed >= 0) setMaxAttributesPerTable(parsed);
                                        }}
                                        className="number-input"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <button className="btn btn-primary" onClick={handleDownload}>
                                    Download
                                </button>
                                <button className="btn btn-secondary" onClick={handleCopyToClipboard}>
                                    {selectedFormat === "flow" ? "Copy JSON" : "Copy to clipboard"}
                                </button>
                            </div>

                            <div className="form-group">
                                <label>Legend</label>
                                <div className="legend-grid">
                                    <span>
                                        <i className="legend-swatch new" /> New table/attribute
                                    </span>
                                    <span>
                                        <i className="legend-swatch renamed" /> Renamed
                                    </span>
                                    <span>
                                        <i className="legend-swatch rel" /> New relationship
                                    </span>
                                </div>
                            </div>
                        </div>
                    </aside>
                )}
            </div>

            {/* ── MODALS ──────────────────────────────────────────────── */}
            <input ref={sessionFileInputRef} type="file" accept=".json,.flow,.flow.json" style={{ display: "none" }} onChange={handleImportSession} />

            {/* Publish Confirm */}
            {showPublishConfirm && (
                <div className="modal-overlay">
                    <div className="modal-card modal-card-review">
                        <h3>Publish changes</h3>
                        <p>Review {changeCount} change(s) before publishing to Dataverse.</p>
                        {publishReview && (
                            <div className="publish-review">
                                {publishReview.newTables.length > 0 && (
                                    <div>
                                        <div className="publish-review-title">New tables ({publishReview.newTables.length})</div>
                                        {publishReview.newTables.map((item) => (
                                            <div key={`new-table-${item}`} className="publish-review-item">
                                                + {item}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {publishReview.renamedTables.length > 0 && (
                                    <div>
                                        <div className="publish-review-title">Renamed tables ({publishReview.renamedTables.length})</div>
                                        {publishReview.renamedTables.map((item) => (
                                            <div key={`renamed-table-${item}`} className="publish-review-item">
                                                ~ {item}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {publishReview.newAttributes.length > 0 && (
                                    <div>
                                        <div className="publish-review-title">New attributes ({publishReview.newAttributes.length})</div>
                                        {publishReview.newAttributes.map((item) => (
                                            <div key={`new-attr-${item}`} className="publish-review-item">
                                                + {item}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {publishReview.renamedAttributes.length > 0 && (
                                    <div>
                                        <div className="publish-review-title">Renamed attributes ({publishReview.renamedAttributes.length})</div>
                                        {publishReview.renamedAttributes.map((item) => (
                                            <div key={`renamed-attr-${item}`} className="publish-review-item">
                                                ~ {item}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {publishReview.newRelationships.length > 0 && (
                                    <div>
                                        <div className="publish-review-title">New relationships ({publishReview.newRelationships.length})</div>
                                        {publishReview.newRelationships.map((item) => (
                                            <div key={`new-rel-${item}`} className="publish-review-item">
                                                + {item}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="panel-row">
                            <button className="btn btn-secondary" onClick={() => setShowPublishConfirm(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handlePublish}>
                                Confirm Publish
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Publish Result */}
            {publishResult && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <h3>{publishResult.success ? "✅ Published successfully" : "⚠️ Published with errors"}</h3>
                        <div className={`publish-result ${publishResult.success ? "is-success" : "is-error"}`}>
                            {publishResult.lines.map((line, index) => (
                                <div key={`${line}-${index}`}>{line}</div>
                            ))}
                            {!publishResult.success && <div className="muted-text">Some operations failed. Review errors and re-run publish.</div>}
                        </div>
                        <button className="btn btn-primary" onClick={() => setPublishResult(null)}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
