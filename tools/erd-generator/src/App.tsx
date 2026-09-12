import { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AppTopbar } from "./components/AppTopbar";
import { CanvasActionDock } from "./components/CanvasActionDock";
import { DiagramPreview } from "./components/DiagramPreview";
import { ExportPanel } from "./components/ExportPanel";
import { GraphCanvas } from "./components/GraphCanvas";
import { GraphTableNodeData } from "./components/GraphTableNode";
import { PublishConfirmModal } from "./components/PublishConfirmModal";
import { PublishResultModal } from "./components/PublishResultModal";
import { useAppActions } from "./hooks/useAppActions";
import {
    useEnvironmentInitialization,
    useGeneratedDiagrams,
    useGraphBootAnimation,
    useMermaidPreload,
    useRelationshipNameSuggestionSync,
    useSelectionSync,
    useSessionLibraryInit,
    useSolutionsLoader,
    useTopbarDismiss,
    useVisualSync,
} from "./hooks/useAppLifecycle";
import { ERDEditorModel, ModelDiff, diffModel, totalChangeCount } from "./models/editor";
import { GraphPositions } from "./utils/graphLayout";
import { ExportMode, OutputFormat, VisualExportType } from "./utils/visualExport";

declare global {
    interface Window {
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

type DiagramFormat = Exclude<OutputFormat, "flow">;
type VisualMode = "flow" | DiagramFormat;
type EdgeStyleType = "step" | "smoothstep" | "bezier";
type TopbarFlyout = "display" | "canvas" | "session" | null;
type CanvasActionTab = "table" | "attribute" | "relationship";

const ERROR_DISPLAY_DURATION_MS = 7000;
const SESSION_SHARE_VERSION = 1;

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
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<Node<GraphTableNodeData>, Edge> | null>(null);

    const [generatedDiagrams, setGeneratedDiagrams] = useState<Record<OutputFormat, string>>({
        flow: "",
        mermaid: "",
        plantuml: "",
        drawio: "",
    });

    const [mermaidReady, setMermaidReady] = useState<boolean>(false);
    const topbarRef = useRef<HTMLElement>(null);
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

    const ensureMermaid = useCallback(async (): Promise<void> => {
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
    }, []);

    const showError = useCallback(
        (message: string) => {
            setError(message);
            setTimeout(() => setError(""), ERROR_DISPLAY_DURATION_MS);
            if (isPPTB && window.toolboxAPI?.utils?.showNotification) {
                void window.toolboxAPI.utils.showNotification({
                    title: "Error",
                    body: message,
                    type: "error",
                });
            }
        },
        [isPPTB],
    );

    const {
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
    } = useAppActions({
        sessionShareVersion: SESSION_SHARE_VERSION,
        isPPTB,
        connectionUrl,
        accessToken,
        selectedSolution,
        baselineModel,
        workingModel,
        diff,
        positions,
        historyPast,
        historyFuture,
        selectedTable,
        selectedTableId,
        selectedRelationshipTargetTable,
        newTableLogicalName,
        newTableDisplayName,
        renameTableDisplayName,
        newAttributeLogicalName,
        newAttributeDisplayName,
        newAttributeType,
        relationshipName,
        relationshipNameTouched,
        relationshipTarget,
        relationshipType,
        changeCount,
        generatedDiagrams,
        selectedFormat,
        exportSource,
        exportChangedOnly,
        exportMode,
        visualExportType,
        visualMode,
        edgeType,
        hideAttributes,
        hideRelationshipNames,
        showChangedOnlyInGraph,
        showImpactMarkers,
        includeAttributes,
        includeRelationships,
        maxAttributesPerTable,
        reactFlowInstance,
        savedSessionNames,
        sessionNameInput,
        selectedSessionName,
        ensureMermaid,
        showError,
        setLoading,
        setBaselineModel,
        setWorkingModel,
        setPositions,
        setGraphBootTick,
        setSelectedTableId,
        setRelationshipTarget,
        setRenameTableDisplayName,
        setVisualMode,
        setEdgeType,
        setHideAttributes,
        setHideRelationshipNames,
        setShowChangedOnlyInGraph,
        setShowImpactMarkers,
        setIncludeAttributes,
        setIncludeRelationships,
        setMaxAttributesPerTable,
        setExportSource,
        setExportChangedOnly,
        setNewTableLogicalName,
        setNewTableDisplayName,
        setNewAttributeLogicalName,
        setNewAttributeDisplayName,
        setRelationshipName,
        setRelationshipNameTouched,
        setPublishing,
        setShowPublishConfirm,
        setPublishResult,
        setHistoryPast,
        setHistoryFuture,
        setSavedSessionNames,
        setSelectedSessionName,
        setSessionNameInput,
        setSelectedSolution,
    });

    useSelectionSync({
        workingModel,
        selectedTable,
        selectedTableId,
        setSelectedTableId,
        setRelationshipTarget,
    });

    useGraphBootAnimation(graphBootTick, setGraphEntryAnimating);

    useVisualSync({
        visualMode,
        selectedFormat,
        exportMode,
        visualExportType,
        availableVisualExportTypes,
        setSelectedFormat,
        setPreviewMode,
        setExportMode,
        setVisualExportType,
    });

    useTopbarDismiss(topbarRef, setOpenTopbarFlyout);

    useEnvironmentInitialization({
        setIsPPTB,
        setLoading,
        setConnectionUrl,
        setError,
    });

    useSolutionsLoader({
        connectionUrl,
        accessToken,
        isPPTB,
        showError,
        setSolutions,
    });

    useGeneratedDiagrams({
        workingModel,
        baselineModel,
        includeAttributes,
        includeRelationships,
        maxAttributesPerTable,
        exportSource,
        exportChangedOnly,
        positions,
        sessionShareVersion: SESSION_SHARE_VERSION,
        setGeneratedDiagrams,
    });

    useMermaidPreload(ensureMermaid, setMermaidReady);
    useSessionLibraryInit(setSavedSessionNames, setSelectedSessionName);
    useRelationshipNameSuggestionSync(relationshipNameSuggestion, relationshipNameTouched, relationshipName, setRelationshipName);

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

            <AppTopbar
                topbarRef={topbarRef}
                solutions={solutions}
                selectedSolution={selectedSolution}
                loading={loading}
                workingModel={!!workingModel}
                visualMode={visualMode}
                openTopbarFlyout={openTopbarFlyout}
                edgeType={edgeType}
                hideAttributes={hideAttributes}
                hideRelationshipNames={hideRelationshipNames}
                showChangedOnlyInGraph={showChangedOnlyInGraph}
                showImpactMarkers={showImpactMarkers}
                historyPastLength={historyPast.length}
                historyFutureLength={historyFuture.length}
                showExportPanel={showExportPanel}
                sessionNameInput={sessionNameInput}
                selectedSessionName={selectedSessionName}
                savedSessionNames={savedSessionNames}
                changeCount={changeCount}
                publishing={publishing}
                onSelectedSolutionChange={setSelectedSolution}
                onLoadSolution={handleLoadSolution}
                setOpenTopbarFlyout={setOpenTopbarFlyout}
                onVisualModeChange={setVisualMode}
                onEdgeTypeChange={setEdgeType}
                onHideAttributesChange={setHideAttributes}
                onHideRelationshipNamesChange={setHideRelationshipNames}
                onFitGraphToView={fitGraphToView}
                onResetView={handleResetView}
                onAutoLayout={handleAutoLayout}
                onShowChangedOnlyChange={setShowChangedOnlyInGraph}
                onShowImpactMarkersChange={setShowImpactMarkers}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onExportPanelToggle={() => setShowExportPanel((v) => !v)}
                onSessionNameInputChange={setSessionNameInput}
                onSelectedSessionNameChange={setSelectedSessionName}
                onSaveSession={handleSaveSession}
                onLoadSession={handleLoadSession}
                onShareSessionFile={handleShareSessionFile}
                onImportSessionClick={() => sessionFileInputRef.current?.click()}
                onPublishRequest={handlePublishRequest}
            />

            {/* ── WORKSPACE ────────────────────────────────────────────── */}
            <div className="workspace">
                <div className="workspace-canvas">
                    {visualMode === "flow" ? (
                        workingModel ? (
                            <GraphCanvas
                                workingModel={workingModel}
                                diff={diff}
                                positions={positions}
                                selectedTableId={selectedTableId}
                                visibleTableIds={visibleTableIds}
                                includeRelationships={includeRelationships}
                                hideRelationshipNames={hideRelationshipNames}
                                edgeType={edgeType}
                                showImpactMarkers={showImpactMarkers}
                                hideAttributes={hideAttributes}
                                graphEntryAnimating={graphEntryAnimating}
                                onReactFlowInit={setReactFlowInstance}
                                onTableSelect={(tableId, displayName) => {
                                    setSelectedTableId(tableId);
                                    setRenameTableDisplayName(displayName);
                                }}
                                onPushSnapshot={() => pushSnapshot(workingModel, positions)}
                                onPositionChange={(tableId, x, y) => {
                                    setPositions((prev) => ({
                                        ...prev,
                                        [tableId]: { x, y },
                                    }));
                                }}
                            />
                        ) : (
                            <div className="loading-mermaid">Load a solution to start graph editing.</div>
                        )
                    ) : (
                        <div className="preview-container">
                            <DiagramPreview format={visualMode} previewMode={previewMode} diagram={generatedDiagrams[visualMode]} mermaidReady={mermaidReady} ensureMermaid={ensureMermaid} />
                        </div>
                    )}

                    {workingModel && visualMode === "flow" && (
                        <CanvasActionDock
                            workingModel={workingModel}
                            publisherPrefixWithUnderscore={publisherPrefixWithUnderscore}
                            selectedTable={selectedTable}
                            showCanvasActionPanel={showCanvasActionPanel}
                            canvasActionTab={canvasActionTab}
                            newTableLogicalName={newTableLogicalName}
                            newTableDisplayName={newTableDisplayName}
                            renameTableDisplayName={renameTableDisplayName}
                            newAttributeLogicalName={newAttributeLogicalName}
                            newAttributeDisplayName={newAttributeDisplayName}
                            newAttributeType={newAttributeType}
                            relationshipName={relationshipName}
                            relationshipTarget={relationshipTarget}
                            relationshipType={relationshipType}
                            onTogglePanel={() => setShowCanvasActionPanel((open) => !open)}
                            onCanvasActionTabChange={setCanvasActionTab}
                            onNewTableLogicalNameChange={setNewTableLogicalName}
                            onNewTableDisplayNameChange={setNewTableDisplayName}
                            onRenameTableDisplayNameChange={setRenameTableDisplayName}
                            onNewAttributeLogicalNameChange={setNewAttributeLogicalName}
                            onNewAttributeDisplayNameChange={setNewAttributeDisplayName}
                            onNewAttributeTypeChange={setNewAttributeType}
                            onRelationshipNameChange={(value) => {
                                setRelationshipName(value);
                                setRelationshipNameTouched(true);
                            }}
                            onRelationshipTargetChange={setRelationshipTarget}
                            onRelationshipTypeChange={setRelationshipType}
                            onAddTable={handleAddTable}
                            onRenameTable={handleRenameTable}
                            onAddAttribute={handleAddAttribute}
                            onAddRelationship={handleAddRelationship}
                        />
                    )}
                </div>

                <ExportPanel
                    showExportPanel={showExportPanel}
                    workingModelExists={!!workingModel}
                    selectedFormat={selectedFormat}
                    exportSource={exportSource}
                    exportChangedOnly={exportChangedOnly}
                    exportMode={exportMode}
                    visualExportType={visualExportType}
                    includeAttributes={includeAttributes}
                    includeRelationships={includeRelationships}
                    maxAttributesPerTable={maxAttributesPerTable}
                    availableVisualExportTypes={availableVisualExportTypes}
                    onClose={() => setShowExportPanel(false)}
                    onExportSourceChange={setExportSource}
                    onExportChangedOnlyChange={setExportChangedOnly}
                    onSelectedFormatChange={setSelectedFormat}
                    onExportModeChange={setExportMode}
                    onVisualExportTypeChange={setVisualExportType}
                    onIncludeAttributesChange={setIncludeAttributes}
                    onIncludeRelationshipsChange={setIncludeRelationships}
                    onMaxAttributesPerTableChange={setMaxAttributesPerTable}
                    onDownload={handleDownload}
                    onCopy={handleCopyToClipboard}
                />
            </div>

            {/* ── MODALS ──────────────────────────────────────────────── */}
            <input ref={sessionFileInputRef} type="file" accept=".json,.flow,.flow.json" style={{ display: "none" }} onChange={handleImportSession} />

            {showPublishConfirm && <PublishConfirmModal changeCount={changeCount} publishReview={publishReview} onCancel={() => setShowPublishConfirm(false)} onConfirmPublish={handlePublish} />}

            {publishResult && <PublishResultModal publishResult={publishResult} onClose={() => setPublishResult(null)} />}
        </div>
    );
}

export default App;
