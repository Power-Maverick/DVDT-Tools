import { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { useCallback, useMemo } from "react";
import { GraphTableNodeData } from "../components/GraphTableNode";
import { ERDEditorModel, ERDEditorTable, ModelDiff, cloneModel, makeId, toEditorModel } from "../models/editor";
import { DataverseSolution } from "../models/interfaces";
import { DataverseClient } from "../utils/DataverseClient";
import { GraphPositions, generateGridLayout, mergePositions } from "../utils/graphLayout";
import { PersistedSession, readSessionLibrary, writeCurrentSession, writeSessionLibrary } from "../utils/sessionStore";
import { ExportMode, OutputFormat, VisualExportType, getDiagramVisualExportArtifact, saveBlob, saveTextWithFallback } from "../utils/visualExport";

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

type EdgeStyleType = "step" | "smoothstep" | "bezier";
type VisualMode = "flow" | "mermaid" | "plantuml" | "drawio";

interface EditorSnapshot {
    model: ERDEditorModel;
    positions: GraphPositions;
}

interface UseAppActionsParams {
    sessionShareVersion: number;
    isPPTB: boolean;
    connectionUrl: string;
    accessToken: string;
    selectedSolution: string;
    baselineModel: ERDEditorModel | null;
    workingModel: ERDEditorModel | null;
    diff: ModelDiff | null;
    positions: GraphPositions;
    historyPast: EditorSnapshot[];
    historyFuture: EditorSnapshot[];
    selectedTable: ERDEditorTable | null;
    selectedTableId: string;
    selectedRelationshipTargetTable: ERDEditorTable | null;
    newTableLogicalName: string;
    newTableDisplayName: string;
    renameTableDisplayName: string;
    newAttributeLogicalName: string;
    newAttributeDisplayName: string;
    newAttributeType: string;
    relationshipName: string;
    relationshipNameTouched: boolean;
    relationshipTarget: string;
    relationshipType: "OneToMany" | "ManyToOne" | "ManyToMany";
    changeCount: number;
    generatedDiagrams: Record<OutputFormat, string>;
    selectedFormat: OutputFormat;
    exportSource: "working" | "baseline";
    exportChangedOnly: boolean;
    exportMode: ExportMode;
    visualExportType: VisualExportType;
    visualMode: VisualMode;
    edgeType: EdgeStyleType;
    hideAttributes: boolean;
    hideRelationshipNames: boolean;
    showChangedOnlyInGraph: boolean;
    showImpactMarkers: boolean;
    includeAttributes: boolean;
    includeRelationships: boolean;
    maxAttributesPerTable: number;
    reactFlowInstance: ReactFlowInstance<Node<GraphTableNodeData>, Edge> | null;
    savedSessionNames: string[];
    sessionNameInput: string;
    selectedSessionName: string;
    ensureMermaid: () => Promise<void>;
    showError: (message: string) => void;
    setLoading: (value: boolean) => void;
    setBaselineModel: (value: ERDEditorModel | null) => void;
    setWorkingModel: (value: ERDEditorModel | null) => void;
    setPositions: (value: GraphPositions | ((prev: GraphPositions) => GraphPositions)) => void;
    setGraphBootTick: (updater: (prev: number) => number) => void;
    setSelectedTableId: (value: string) => void;
    setRelationshipTarget: (value: string) => void;
    setRenameTableDisplayName: (value: string) => void;
    setVisualMode: (value: VisualMode) => void;
    setEdgeType: (value: EdgeStyleType) => void;
    setHideAttributes: (value: boolean) => void;
    setHideRelationshipNames: (value: boolean) => void;
    setShowChangedOnlyInGraph: (value: boolean) => void;
    setShowImpactMarkers: (value: boolean) => void;
    setIncludeAttributes: (value: boolean) => void;
    setIncludeRelationships: (value: boolean) => void;
    setMaxAttributesPerTable: (value: number) => void;
    setExportSource: (value: "working" | "baseline") => void;
    setExportChangedOnly: (value: boolean) => void;
    setNewTableLogicalName: (value: string) => void;
    setNewTableDisplayName: (value: string) => void;
    setNewAttributeLogicalName: (value: string) => void;
    setNewAttributeDisplayName: (value: string) => void;
    setRelationshipName: (value: string) => void;
    setRelationshipNameTouched: (value: boolean) => void;
    setPublishing: (value: boolean) => void;
    setShowPublishConfirm: (value: boolean) => void;
    setPublishResult: (value: { success: boolean; lines: string[] } | null) => void;
    setHistoryPast: (value: EditorSnapshot[] | ((prev: EditorSnapshot[]) => EditorSnapshot[])) => void;
    setHistoryFuture: (value: EditorSnapshot[] | ((prev: EditorSnapshot[]) => EditorSnapshot[])) => void;
    setSavedSessionNames: (value: string[]) => void;
    setSelectedSessionName: (value: string) => void;
    setSessionNameInput: (value: string) => void;
    setSelectedSolution: (value: string) => void;
}

const isEdgeType = (value: string): value is EdgeStyleType => value === "step" || value === "smoothstep" || value === "bezier";
const isVisualMode = (value: string): value is VisualMode => value === "flow" || value === "mermaid" || value === "plantuml" || value === "drawio";

export function useAppActions(params: UseAppActionsParams) {
    const pushSnapshot = useCallback(
        (model: ERDEditorModel, nextPositions: GraphPositions) => {
            params.setHistoryPast((prev) => [...prev, { model: cloneModel(model), positions: { ...nextPositions } }]);
            params.setHistoryFuture([]);
        },
        [params],
    );

    const resetHistory = useCallback(() => {
        params.setHistoryPast([]);
        params.setHistoryFuture([]);
    }, [params]);

    const applyModelChange = useCallback(
        (nextModel: ERDEditorModel, nextPositions: GraphPositions = params.positions) => {
            if (!params.workingModel) return;
            pushSnapshot(params.workingModel, params.positions);
            params.setWorkingModel(nextModel);
            params.setPositions(nextPositions);
            params.setPublishResult(null);
        },
        [params, pushSnapshot],
    );

    const validateLogicalName = useCallback((name: string, kind: "table" | "attribute") => {
        const trimmed = name.trim();
        if (!trimmed) return `${kind} logical name is required.`;
        if (!/^[a-z][a-z0-9_]*$/i.test(trimmed)) return `${kind} logical name must start with a letter and contain only alphanumeric/underscore.`;
        if (RESERVED_NAMES.has(trimmed.toLowerCase())) return `${kind} logical name '${trimmed}' is reserved.`;
        return "";
    }, []);

    const ensurePublisherPrefix = useCallback(
        (logicalName: string): string => {
            const trimmed = logicalName.trim();
            if (!params.workingModel) return trimmed;
            const prefix = (params.workingModel.publisherPrefix || "").trim().toLowerCase();
            if (!prefix) return trimmed;
            const expectedPrefix = `${prefix}_`;
            return trimmed.toLowerCase().startsWith(expectedPrefix) ? trimmed : `${expectedPrefix}${trimmed}`;
        },
        [params.workingModel],
    );

    const stripPublisherPrefix = useCallback(
        (logicalName: string): string => {
            if (!params.workingModel) return logicalName;
            const prefix = (params.workingModel.publisherPrefix || "").trim().toLowerCase();
            if (!prefix) return logicalName;
            const expectedPrefix = `${prefix}_`;
            return logicalName.toLowerCase().startsWith(expectedPrefix) ? logicalName.slice(expectedPrefix.length) : logicalName;
        },
        [params.workingModel],
    );

    const buildRelationshipSchemaName = useCallback(
        (fromLogicalName: string, toLogicalName: string, linkAttributeName: string, manualDraft: string): string => {
            const manual = manualDraft.trim();
            if (manual) {
                return ensurePublisherPrefix(manual);
            }

            const fromPart = stripPublisherPrefix(fromLogicalName);
            const toPart = stripPublisherPrefix(toLogicalName);
            const linkPart = stripPublisherPrefix(linkAttributeName);
            return ensurePublisherPrefix(`${fromPart}_${toPart}_${linkPart}`);
        },
        [ensurePublisherPrefix, stripPublisherPrefix],
    );

    const relationshipNameSuggestion = useMemo(() => {
        if (!params.workingModel || !params.selectedTable) return "";
        const targetLogical = params.selectedRelationshipTargetTable?.logicalName || params.selectedTable.logicalName;
        const linkAttributeName =
            params.relationshipType === "ManyToMany" ? `${params.selectedTable.logicalName}id` : params.selectedRelationshipTargetTable?.primaryIdAttribute || `${params.selectedTable.logicalName}id`;
        return buildRelationshipSchemaName(params.selectedTable.logicalName, targetLogical, linkAttributeName, "");
    }, [params.workingModel, params.selectedTable, params.selectedRelationshipTargetTable, params.relationshipType, buildRelationshipSchemaName]);

    const copyText = useCallback(
        async (value: string) => {
            if (params.isPPTB) {
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
        },
        [params.isPPTB],
    );

    const buildSessionPayload = useCallback((): PersistedSession | null => {
        if (!params.workingModel) return null;
        return {
            version: params.sessionShareVersion,
            solutionUniqueName: params.selectedSolution,
            baselineModel: params.baselineModel ? cloneModel(params.baselineModel) : null,
            workingModel: cloneModel(params.workingModel),
            positions: { ...params.positions },
            visualMode: params.visualMode,
            edgeType: params.edgeType,
            hideAttributes: params.hideAttributes,
            hideRelationshipNames: params.hideRelationshipNames,
            showChangedOnlyInGraph: params.showChangedOnlyInGraph,
            showImpactMarkers: params.showImpactMarkers,
            includeAttributes: params.includeAttributes,
            includeRelationships: params.includeRelationships,
            maxAttributesPerTable: params.maxAttributesPerTable,
            exportSource: params.exportSource,
            exportChangedOnly: params.exportChangedOnly,
            selectedTableId: params.selectedTableId,
            relationshipTarget: params.relationshipTarget,
        };
    }, [params]);

    const applySessionPayload = useCallback(
        (payload: PersistedSession) => {
            if (!payload?.workingModel || !Array.isArray(payload.workingModel.tables) || !Array.isArray(payload.workingModel.relationships)) {
                throw new Error("Session is missing ERD model data.");
            }

            const restoredWorking = cloneModel(payload.workingModel);
            const restoredBaseline = payload.baselineModel ? cloneModel(payload.baselineModel) : null;
            const fallbackPositions = generateGridLayout(restoredWorking);
            const mergedPositions = mergePositions(fallbackPositions, payload.positions || {});

            params.setSelectedSolution(payload.solutionUniqueName || "");
            params.setBaselineModel(restoredBaseline);
            params.setWorkingModel(restoredWorking);
            params.setPositions(mergedPositions);
            params.setGraphBootTick((tick) => tick + 1);
            resetHistory();

            const firstTable = restoredWorking.tables[0];
            const safeSelectedTableId = restoredWorking.tables.some((table) => table.id === payload.selectedTableId) ? payload.selectedTableId : firstTable?.id || "";
            const safeTargetTableId = restoredWorking.tables.some((table) => table.id === payload.relationshipTarget)
                ? payload.relationshipTarget
                : restoredWorking.tables.find((table) => table.id !== safeSelectedTableId)?.id || safeSelectedTableId;

            params.setSelectedTableId(safeSelectedTableId);
            params.setRelationshipTarget(safeTargetTableId || "");
            params.setRenameTableDisplayName(restoredWorking.tables.find((table) => table.id === safeSelectedTableId)?.displayName || "");

            params.setVisualMode(isVisualMode(payload.visualMode) ? payload.visualMode : "flow");
            params.setEdgeType(isEdgeType(payload.edgeType) ? payload.edgeType : "smoothstep");
            params.setHideAttributes(!!payload.hideAttributes);
            params.setHideRelationshipNames(!!payload.hideRelationshipNames);
            params.setShowChangedOnlyInGraph(!!payload.showChangedOnlyInGraph);
            params.setShowImpactMarkers(payload.showImpactMarkers !== false);
            params.setIncludeAttributes(payload.includeAttributes !== false);
            params.setIncludeRelationships(payload.includeRelationships !== false);
            params.setMaxAttributesPerTable(Number.isFinite(payload.maxAttributesPerTable) ? Math.max(0, payload.maxAttributesPerTable) : 12);
            params.setExportSource(payload.exportSource === "baseline" ? "baseline" : "working");
            params.setExportChangedOnly(!!payload.exportChangedOnly);
        },
        [params, resetHistory],
    );

    const handleLoadSolution = useCallback(async () => {
        if (!params.selectedSolution) {
            params.showError("Please select a solution first.");
            return;
        }

        try {
            params.setLoading(true);
            const client = new DataverseClient({ environmentUrl: params.connectionUrl, accessToken: params.accessToken }, params.isPPTB);
            const solution: DataverseSolution = await client.fetchSolution(params.selectedSolution);
            const editorModel = toEditorModel(solution);
            const defaultPositions = generateGridLayout(editorModel);

            params.setBaselineModel(editorModel);
            params.setWorkingModel(cloneModel(editorModel));
            params.setPositions(defaultPositions);
            params.setGraphBootTick((tick) => tick + 1);
            params.setSelectedTableId(editorModel.tables[0]?.id || "");
            params.setRelationshipTarget(editorModel.tables[1]?.id || editorModel.tables[0]?.id || "");
            params.setRenameTableDisplayName(editorModel.tables[0]?.displayName || "");
            resetHistory();

            if (params.isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "Interactive ERD loaded.",
                    type: "success",
                });
            }
        } catch (err: any) {
            params.showError(`Failed to load ERD: ${err.message}`);
        } finally {
            params.setLoading(false);
        }
    }, [params, resetHistory]);

    const handleUndo = useCallback(() => {
        if (!params.workingModel || params.historyPast.length === 0) return;
        const previous = params.historyPast[params.historyPast.length - 1];
        params.setHistoryPast((prev) => prev.slice(0, -1));
        params.setHistoryFuture((prev) => [{ model: cloneModel(params.workingModel!), positions: { ...params.positions } }, ...prev]);
        params.setWorkingModel(cloneModel(previous.model));
        params.setPositions({ ...previous.positions });
    }, [params]);

    const handleRedo = useCallback(() => {
        if (!params.workingModel || params.historyFuture.length === 0) return;
        const next = params.historyFuture[0];
        params.setHistoryFuture((prev) => prev.slice(1));
        params.setHistoryPast((prev) => [...prev, { model: cloneModel(params.workingModel!), positions: { ...params.positions } }]);
        params.setWorkingModel(cloneModel(next.model));
        params.setPositions({ ...next.positions });
    }, [params]);

    const handleAddTable = useCallback(() => {
        if (!params.workingModel) return;

        const tableLogicalName = ensurePublisherPrefix(params.newTableLogicalName);
        const tableDisplayName = params.newTableDisplayName.trim() || tableLogicalName;

        const tableError = validateLogicalName(tableLogicalName, "table");
        if (tableError) {
            params.showError(tableError);
            return;
        }

        if (params.workingModel.tables.some((table) => table.logicalName.toLowerCase() === tableLogicalName.toLowerCase())) {
            params.showError(`Table logical name '${tableLogicalName}' already exists.`);
            return;
        }

        const primaryId = `${tableLogicalName}id`;
        const primaryName = "name";
        const tableId = makeId("table");

        const nextModel = cloneModel(params.workingModel);
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

        const layout = mergePositions(params.positions, generateGridLayout(nextModel));
        applyModelChange(nextModel, layout);
        params.setNewTableLogicalName("");
        params.setNewTableDisplayName("");
        params.setSelectedTableId(tableId);
    }, [params, applyModelChange, ensurePublisherPrefix, validateLogicalName]);

    const handleRenameTable = useCallback(() => {
        if (!params.workingModel || !params.selectedTable) return;
        const nextDisplayName = params.renameTableDisplayName.trim();
        if (!nextDisplayName) {
            params.showError("Table display name cannot be empty.");
            return;
        }

        const nextModel = cloneModel(params.workingModel);
        const table = nextModel.tables.find((t) => t.id === params.selectedTable!.id);
        if (!table) return;
        table.displayName = nextDisplayName;
        applyModelChange(nextModel);
    }, [params, applyModelChange]);

    const handleAddAttribute = useCallback(() => {
        if (!params.workingModel || !params.selectedTable) return;
        const logical = ensurePublisherPrefix(params.newAttributeLogicalName);
        const display = params.newAttributeDisplayName.trim() || logical;

        const attrError = validateLogicalName(logical, "attribute");
        if (attrError) {
            params.showError(attrError);
            return;
        }

        if (params.selectedTable.attributes.some((a) => a.logicalName.toLowerCase() === logical.toLowerCase())) {
            params.showError(`Attribute logical name '${logical}' already exists in table '${params.selectedTable.logicalName}'.`);
            return;
        }

        const nextModel = cloneModel(params.workingModel);
        const table = nextModel.tables.find((t) => t.id === params.selectedTable!.id);
        if (!table) return;

        table.attributes.unshift({
            id: makeId("attr"),
            logicalName: logical,
            displayName: display,
            type: params.newAttributeType,
            isPrimaryId: false,
            isPrimaryName: false,
            isRequired: false,
        });

        applyModelChange(nextModel);
        params.setNewAttributeLogicalName("");
        params.setNewAttributeDisplayName("");
    }, [params, applyModelChange, ensurePublisherPrefix, validateLogicalName]);

    const handleAddRelationship = useCallback(() => {
        if (!params.workingModel || !params.selectedTable) return;
        if (!params.relationshipTarget) {
            params.showError("Please choose a target table for the relationship.");
            return;
        }

        if (params.relationshipTarget === params.selectedTable.id && params.relationshipType !== "ManyToMany") {
            params.showError("Self-relationship is allowed only for Many-to-Many in this editor.");
            return;
        }

        const schemaName = params.relationshipName.trim();
        const targetTableForName = params.workingModel.tables.find((table) => table.id === params.relationshipTarget);
        const linkAttributeName =
            params.relationshipType === "ManyToMany" ? `${params.selectedTable.logicalName}id` : targetTableForName?.primaryIdAttribute || `${params.selectedTable.logicalName}id`;
        const normalizedSchemaName = buildRelationshipSchemaName(params.selectedTable.logicalName, targetTableForName?.logicalName || params.selectedTable.logicalName, linkAttributeName, schemaName);

        const duplicate = params.workingModel.relationships.some(
            (relationship) =>
                relationship.schemaName.toLowerCase() === normalizedSchemaName.toLowerCase() &&
                relationship.fromTableId === params.selectedTable!.id &&
                relationship.toTableId === params.relationshipTarget,
        );

        if (duplicate) {
            params.showError(`Relationship '${normalizedSchemaName}' already exists between selected tables.`);
            return;
        }

        const nextModel = cloneModel(params.workingModel);
        const targetTable = nextModel.tables.find((table) => table.id === params.relationshipTarget);
        nextModel.relationships.push({
            id: makeId("rel"),
            schemaName: normalizedSchemaName,
            type: params.relationshipType,
            fromTableId: params.selectedTable.id,
            toTableId: params.relationshipTarget,
            lookupAttribute: params.relationshipType === "ManyToMany" ? undefined : targetTable?.primaryIdAttribute || `${params.selectedTable.logicalName}id`,
            intersectTable: params.relationshipType === "ManyToMany" ? `${params.selectedTable.logicalName}_${normalizedSchemaName}` : undefined,
        });
        applyModelChange(nextModel);
        params.setRelationshipName("");
        params.setRelationshipNameTouched(false);
    }, [params, applyModelChange, buildRelationshipSchemaName]);

    const handlePublishRequest = useCallback(() => {
        if (params.changeCount === 0) {
            params.showError("No changes to publish.");
            return;
        }
        params.setShowPublishConfirm(true);
    }, [params]);

    const handlePublish = useCallback(async () => {
        if (!params.workingModel || !params.baselineModel || !params.diff) return;

        params.setShowPublishConfirm(false);
        params.setPublishing(true);
        params.setPublishResult(null);

        try {
            const client = new DataverseClient({ environmentUrl: params.connectionUrl, accessToken: params.accessToken }, params.isPPTB);
            const result = await client.publishModelChanges(params.baselineModel, params.workingModel, params.diff);
            const lines = result.results.map((item) => `${item.success ? "✅" : "❌"} ${item.name}: ${item.message}`);
            params.setPublishResult({ success: result.success, lines });

            if (result.success) {
                const refreshed = await client.fetchSolution(params.selectedSolution);
                const refreshedModel = toEditorModel(refreshed);
                params.setBaselineModel(refreshedModel);
                params.setWorkingModel(cloneModel(refreshedModel));
                params.setPositions(mergePositions(params.positions, generateGridLayout(refreshedModel)));
                params.setGraphBootTick((tick) => tick + 1);
                resetHistory();
            }
        } catch (err: any) {
            params.showError(`Publish failed: ${err.message}`);
        } finally {
            params.setPublishing(false);
        }
    }, [params, resetHistory]);

    const fitGraphToView = useCallback(() => {
        if (!params.reactFlowInstance) return;
        params.reactFlowInstance.fitView({ padding: 0.2, duration: 450 });
    }, [params.reactFlowInstance]);

    const handleResetView = useCallback(() => {
        if (!params.reactFlowInstance) return;
        params.reactFlowInstance.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 260 });
    }, [params.reactFlowInstance]);

    const handleAutoLayout = useCallback(() => {
        if (!params.workingModel) return;
        const nextPositions = mergePositions(params.positions, generateGridLayout(params.workingModel));
        params.setPositions(nextPositions);
        window.setTimeout(() => params.reactFlowInstance?.fitView({ padding: 0.2, duration: 350 }), 0);
    }, [params]);

    const handleDownload = useCallback(async () => {
        const currentDiagram = params.generatedDiagrams[params.selectedFormat];
        if (!currentDiagram) return;

        const extensions: Record<OutputFormat, string> = {
            flow: "flow.json",
            mermaid: "mmd",
            plantuml: "puml",
            drawio: "drawio",
        };

        const sourceSuffix = params.exportSource === "baseline" ? "baseline" : params.exportChangedOnly ? "changed" : "working";
        const baseName = `${params.selectedSolution || "session"}-erd-${sourceSuffix}-${params.selectedFormat}`;
        const textFileName = `${baseName}.${extensions[params.selectedFormat]}`;
        const effectiveMode: ExportMode = params.selectedFormat === "flow" ? "visual" : params.exportMode;
        const canvasNode = document.querySelector(".graph-canvas") as HTMLElement | null;

        try {
            if (effectiveMode === "text") {
                await saveTextWithFallback(textFileName, currentDiagram, params.selectedFormat === "flow" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8");
            } else if (effectiveMode === "visual") {
                if (params.selectedFormat === "mermaid" && (params.visualExportType === "svg" || params.visualExportType === "png")) {
                    await params.ensureMermaid();
                }
                const visual = await getDiagramVisualExportArtifact(params.selectedFormat, currentDiagram, baseName, params.visualExportType, canvasNode, params.reactFlowInstance);
                if (visual.blob) {
                    saveBlob(visual.fileName, visual.blob);
                } else {
                    await saveTextWithFallback(visual.fileName, visual.contents || "", visual.mimeType || "text/plain;charset=utf-8");
                }
            } else {
                await saveTextWithFallback(textFileName, currentDiagram, params.selectedFormat === "flow" ? "application/json;charset=utf-8" : "text/plain;charset=utf-8");
                if (params.selectedFormat === "mermaid" && (params.visualExportType === "svg" || params.visualExportType === "png")) {
                    await params.ensureMermaid();
                }
                const visual = await getDiagramVisualExportArtifact(params.selectedFormat, currentDiagram, baseName, params.visualExportType, canvasNode, params.reactFlowInstance);
                if (visual.blob) {
                    saveBlob(visual.fileName, visual.blob);
                } else {
                    await saveTextWithFallback(visual.fileName, visual.contents || "", visual.mimeType || "text/plain;charset=utf-8");
                }
            }

            if (params.isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "File download completed.",
                    type: "success",
                });
            }
        } catch (err: any) {
            params.showError(`Failed to save file: ${err.message}`);
        }
    }, [params]);

    const handleCopyToClipboard = useCallback(async () => {
        const currentDiagram = params.generatedDiagrams[params.selectedFormat];
        if (!currentDiagram) return;

        try {
            await copyText(currentDiagram);
            if (params.isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "Copied to clipboard.",
                    type: "success",
                });
            }
        } catch (err: any) {
            params.showError(`Failed to copy: ${err.message}`);
        }
    }, [params, copyText]);

    const handleSaveSession = useCallback(async () => {
        try {
            const payload = buildSessionPayload();
            if (!payload) {
                params.showError("Load or edit an ERD before saving a session.");
                return;
            }

            const sessionName = params.sessionNameInput.trim() || params.selectedSessionName.trim() || params.selectedSolution.trim() || "My Session";
            if (!sessionName) return;

            const library = readSessionLibrary();
            library[sessionName] = payload;
            writeSessionLibrary(library);
            writeCurrentSession(payload);
            const names = Object.keys(library).sort((left, right) => left.localeCompare(right));
            params.setSavedSessionNames(names);
            params.setSelectedSessionName(sessionName);
            params.setSessionNameInput(sessionName);

            if (params.isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: `Session '${sessionName}' saved locally.`,
                    type: "success",
                });
            }
        } catch (err) {
            params.showError(`Failed to save session: ${(err as Error).message}`);
        }
    }, [params, buildSessionPayload]);

    const handleLoadSession = useCallback(async () => {
        try {
            const library = readSessionLibrary();
            const names = Object.keys(library).sort((left, right) => left.localeCompare(right));
            if (names.length === 0) {
                params.showError("No saved session found.");
                return;
            }

            const pick = params.selectedSessionName.trim() || names[0];
            const payload = library[pick];
            if (!payload) {
                params.showError(`Session '${pick}' does not exist.`);
                return;
            }

            applySessionPayload(payload);
            writeCurrentSession(payload);
            params.setSavedSessionNames(names);
            params.setSelectedSessionName(pick);
            params.setSessionNameInput(pick);
            if (params.isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: `Session '${pick}' restored.`,
                    type: "success",
                });
            }
        } catch (err) {
            params.showError(`Failed to load session: ${(err as Error).message}`);
        }
    }, [params, applySessionPayload]);

    const handleImportSession = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
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
                        version: params.sessionShareVersion,
                        solutionUniqueName: params.selectedSolution,
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
                params.showError(`Failed to import session: ${(err as Error).message}`);
            } finally {
                event.target.value = "";
            }
        },
        [params, applySessionPayload],
    );

    const handleShareSessionFile = useCallback(async () => {
        try {
            const payload = buildSessionPayload();
            if (!payload) {
                params.showError("Load or edit an ERD before sharing a session.");
                return;
            }

            const fileName = `${params.selectedSolution || "session"}-erd-session.json`;
            await saveTextWithFallback(fileName, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
            if (params.isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "Session file exported for sharing.",
                    type: "success",
                });
            }
        } catch (err) {
            params.showError(`Failed to share session: ${(err as Error).message}`);
        }
    }, [params, buildSessionPayload]);

    return {
        relationshipNameSuggestion,
        pushSnapshot,
        handleLoadSolution,
        handleUndo,
        handleRedo,
        handleAddTable,
        handleRenameTable,
        handleAddAttribute,
        handleAddRelationship,
        handlePublishRequest,
        handlePublish,
        fitGraphToView,
        handleResetView,
        handleAutoLayout,
        handleDownload,
        handleCopyToClipboard,
        handleSaveSession,
        handleLoadSession,
        handleImportSession,
        handleShareSessionFile,
    };
}
