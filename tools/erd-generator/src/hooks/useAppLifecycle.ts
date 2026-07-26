import { Dispatch, RefObject, SetStateAction, useEffect } from "react";
import { ERDGenerator } from "../components/ERDGenerator";
import { ERDEditorModel, ERDEditorTable, changedOnlyModel, toDataverseSolution } from "../models/editor";
import { DataverseClient } from "../utils/DataverseClient";
import { GraphPositions } from "../utils/graphLayout";
import { readSessionLibrary } from "../utils/sessionStore";
import { OutputFormat, VisualExportType } from "../utils/visualExport";

type VisualMode = "flow" | Exclude<OutputFormat, "flow">;
type ExportMode = "text" | "visual" | "both";
type TopbarFlyout = "display" | "canvas" | "session" | null;

interface GeneratedDiagramState {
    flow: string;
    mermaid: string;
    plantuml: string;
    drawio: string;
}

interface UseSelectionSyncParams {
    workingModel: ERDEditorModel | null;
    selectedTable: ERDEditorTable | null;
    selectedTableId: string;
    setSelectedTableId: Dispatch<SetStateAction<string>>;
    setRelationshipTarget: Dispatch<SetStateAction<string>>;
}

export function useSelectionSync(params: UseSelectionSyncParams) {
    useEffect(() => {
        if (!params.workingModel) return;
        if (!params.selectedTableId || !params.workingModel.tables.some((table) => table.id === params.selectedTableId)) {
            params.setSelectedTableId(params.workingModel.tables[0]?.id || "");
        }
    }, [params.workingModel, params.selectedTableId, params.setSelectedTableId]);

    useEffect(() => {
        if (!params.workingModel || !params.selectedTable) return;
        const preferred = params.workingModel.tables.find((table) => table.id !== params.selectedTable!.id)?.id || params.selectedTable.id;
        params.setRelationshipTarget((current) => (current && params.workingModel!.tables.some((table) => table.id === current) ? current : preferred));
    }, [params.workingModel, params.selectedTable, params.setRelationshipTarget]);
}

export function useGraphBootAnimation(graphBootTick: number, setGraphEntryAnimating: Dispatch<SetStateAction<boolean>>) {
    useEffect(() => {
        if (graphBootTick === 0) return;
        setGraphEntryAnimating(true);
        const timer = window.setTimeout(() => setGraphEntryAnimating(false), 900);
        return () => window.clearTimeout(timer);
    }, [graphBootTick, setGraphEntryAnimating]);
}

interface UseVisualSyncParams {
    visualMode: VisualMode;
    selectedFormat: OutputFormat;
    exportMode: ExportMode;
    visualExportType: VisualExportType;
    availableVisualExportTypes: VisualExportType[];
    setSelectedFormat: Dispatch<SetStateAction<OutputFormat>>;
    setPreviewMode: Dispatch<SetStateAction<"visual" | "text">>;
    setExportMode: Dispatch<SetStateAction<ExportMode>>;
    setVisualExportType: Dispatch<SetStateAction<VisualExportType>>;
}

export function useVisualSync(params: UseVisualSyncParams) {
    useEffect(() => {
        if (params.visualMode === "flow") return;
        params.setSelectedFormat(params.visualMode);
        params.setPreviewMode("visual");
    }, [params.visualMode, params.setSelectedFormat, params.setPreviewMode]);

    useEffect(() => {
        if (params.selectedFormat === "flow" && params.exportMode !== "visual") {
            params.setExportMode("visual");
        }
    }, [params.selectedFormat, params.exportMode, params.setExportMode]);

    useEffect(() => {
        if (!params.availableVisualExportTypes.includes(params.visualExportType)) {
            params.setVisualExportType(params.availableVisualExportTypes[0]);
        }
    }, [params.availableVisualExportTypes, params.visualExportType, params.setVisualExportType]);
}

export function useTopbarDismiss(topbarRef: RefObject<HTMLElement | null>, setOpenTopbarFlyout: Dispatch<SetStateAction<TopbarFlyout>>) {
    useEffect(() => {
        const onDocumentClick = (event: MouseEvent) => {
            if (!topbarRef.current) return;
            if (!topbarRef.current.contains(event.target as Node)) {
                setOpenTopbarFlyout(null);
            }
        };
        document.addEventListener("mousedown", onDocumentClick);
        return () => document.removeEventListener("mousedown", onDocumentClick);
    }, [topbarRef, setOpenTopbarFlyout]);
}

interface UseEnvironmentInitParams {
    setIsPPTB: Dispatch<SetStateAction<boolean>>;
    setLoading: Dispatch<SetStateAction<boolean>>;
    setConnectionUrl: Dispatch<SetStateAction<string>>;
    setAccessToken: Dispatch<SetStateAction<string>>;
    setError: Dispatch<SetStateAction<string>>;
}

export function useEnvironmentInitialization(params: UseEnvironmentInitParams) {
    useEffect(() => {
        let cleanup: (() => void) | null = null;

        const initializeEnvironment = async () => {
            if (typeof window.acquireVsCodeApi !== "undefined") {
                params.setIsPPTB(false);
                params.setLoading(true);

                const handleMessage = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === "setCredentials") {
                        params.setConnectionUrl(message.environmentUrl);
                        params.setAccessToken(message.accessToken);
                        params.setLoading(false);
                    }
                };

                window.addEventListener("message", handleMessage);
                cleanup = () => window.removeEventListener("message", handleMessage);
                return;
            }

            if (window.toolboxAPI) {
                params.setIsPPTB(true);
                try {
                    const activeConnection = await window.toolboxAPI.connections.getActiveConnection();
                    params.setConnectionUrl(activeConnection?.url || "");
                } catch (err) {
                    console.error("Failed to get active connection", err);
                }
                params.setLoading(false);
                return;
            }

            params.setError("Not running in supported environment (DVDT or PPTB)");
            params.setLoading(false);
        };

        void initializeEnvironment();
        return () => cleanup?.();
    }, [params.setIsPPTB, params.setLoading, params.setConnectionUrl, params.setAccessToken, params.setError]);
}

interface UseSolutionsLoaderParams {
    connectionUrl: string;
    accessToken: string;
    isPPTB: boolean;
    showError: (message: string) => void;
    setSolutions: Dispatch<SetStateAction<Array<{ uniqueName: string; displayName: string; version: string }>>>;
}

export function useSolutionsLoader(params: UseSolutionsLoaderParams) {
    useEffect(() => {
        if (!params.connectionUrl) return;

        const loadSolutions = async () => {
            try {
                const client = new DataverseClient(
                    {
                        environmentUrl: params.connectionUrl,
                        accessToken: params.accessToken,
                    },
                    params.isPPTB,
                );
                const solutionList = await client.listSolutions();
                params.setSolutions(solutionList);
            } catch (err: any) {
                params.showError(`Failed to load solutions: ${err.message}`);
            }
        };

        void loadSolutions();
    }, [params.connectionUrl, params.accessToken, params.isPPTB, params.setSolutions, params.showError]);
}

interface UseGeneratedDiagramsParams {
    workingModel: ERDEditorModel | null;
    baselineModel: ERDEditorModel | null;
    includeAttributes: boolean;
    includeRelationships: boolean;
    maxAttributesPerTable: number;
    exportSource: "working" | "baseline";
    exportChangedOnly: boolean;
    positions: GraphPositions;
    sessionShareVersion: number;
    setGeneratedDiagrams: Dispatch<SetStateAction<GeneratedDiagramState>>;
}

export function useGeneratedDiagrams(params: UseGeneratedDiagramsParams) {
    useEffect(() => {
        if (!params.workingModel || !params.baselineModel) {
            params.setGeneratedDiagrams({ flow: "", mermaid: "", plantuml: "", drawio: "" });
            return;
        }

        const model = params.exportSource === "baseline" ? params.baselineModel : params.exportChangedOnly ? changedOnlyModel(params.baselineModel, params.workingModel) : params.workingModel;

        const diagramSolution = toDataverseSolution(model);
        const generatorConfig = {
            includeAttributes: params.includeAttributes,
            includeRelationships: params.includeRelationships,
            maxAttributesPerTable: params.maxAttributesPerTable,
        };

        const tableIds = new Set(model.tables.map((table) => table.id));
        const exportedPositions: GraphPositions = {};
        for (const tableId of tableIds) {
            if (params.positions[tableId]) {
                exportedPositions[tableId] = params.positions[tableId];
            }
        }

        params.setGeneratedDiagrams({
            flow: JSON.stringify(
                {
                    version: params.sessionShareVersion,
                    exportedAt: new Date().toISOString(),
                    source: params.exportSource,
                    changedOnly: params.exportChangedOnly,
                    model,
                    positions: exportedPositions,
                },
                null,
                2,
            ),
            mermaid: new ERDGenerator({ ...generatorConfig, format: "mermaid" }).generate(diagramSolution),
            plantuml: new ERDGenerator({ ...generatorConfig, format: "plantuml" }).generate(diagramSolution),
            drawio: new ERDGenerator({ ...generatorConfig, format: "drawio" }).generate(diagramSolution),
        });
    }, [
        params.workingModel,
        params.baselineModel,
        params.includeAttributes,
        params.includeRelationships,
        params.maxAttributesPerTable,
        params.exportSource,
        params.exportChangedOnly,
        params.positions,
        params.sessionShareVersion,
        params.setGeneratedDiagrams,
    ]);
}

export function useMermaidPreload(ensureMermaid: () => Promise<void>, setMermaidReady: Dispatch<SetStateAction<boolean>>) {
    useEffect(() => {
        const preloadMermaid = async () => {
            try {
                await ensureMermaid();
                setMermaidReady(true);
            } catch (err) {
                console.error("Failed to preload mermaid:", err);
            }
        };
        void preloadMermaid();
    }, [ensureMermaid, setMermaidReady]);
}

export function useSessionLibraryInit(setSavedSessionNames: Dispatch<SetStateAction<string[]>>, setSelectedSessionName: Dispatch<SetStateAction<string>>) {
    useEffect(() => {
        const library = readSessionLibrary();
        const names = Object.keys(library).sort((left, right) => left.localeCompare(right));
        setSavedSessionNames(names);
        setSelectedSessionName((current) => (current && names.includes(current) ? current : names[0] || ""));
    }, [setSavedSessionNames, setSelectedSessionName]);
}

export function useRelationshipNameSuggestionSync(
    relationshipNameSuggestion: string,
    relationshipNameTouched: boolean,
    relationshipName: string,
    setRelationshipName: Dispatch<SetStateAction<string>>,
) {
    useEffect(() => {
        if (!relationshipNameSuggestion) return;
        if (!relationshipNameTouched || !relationshipName.trim()) {
            setRelationshipName(relationshipNameSuggestion);
        }
    }, [relationshipNameSuggestion, relationshipNameTouched, relationshipName, setRelationshipName]);
}
