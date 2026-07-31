import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfigurationPanel } from "./components/ConfigurationPanel";
import { CopyActionsBar } from "./components/CopyActionsBar";
import { LayoutPreview } from "./components/LayoutPreview";
import { SolutionPicker } from "./components/SolutionPicker";
import { TableSidebar } from "./components/TableSidebar";
import { ViewListPanel } from "./components/ViewListPanel";
import { CopyOptions, CopyResultItem, Solution, TableInfo, ViewInfo } from "./models/interfaces";
import { getViewTypeLabel, isLookupView, supportsComponents, viewTypeRank } from "./models/viewTypes";
import { DataverseClient, ViewUpdatePayload } from "./utils/DataverseClient";
import { buildTargetLayoutXml, mergeFetchXml, parseLayoutColumns } from "./utils/layoutUtils";
import { version as APP_VERSION } from "../package.json";

const client = new DataverseClient();

function App() {
    const isDemoMode = (window as any).__PPTB_MOCK__ === true;

    const [connectionUrl, setConnectionUrl] = useState<string>("");
    const [fatalError, setFatalError] = useState<string>("");
    const [error, setError] = useState<string>("");
    const errorTimer = useRef<number>();

    // Solutions + tables
    const [solutions, setSolutions] = useState<Solution[]>([]);
    const [selectedSolutionId, setSelectedSolutionId] = useState<string>("");
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [solutionTableIds, setSolutionTableIds] = useState<Set<string> | null>(null);
    const [loadingTables, setLoadingTables] = useState<boolean>(true);

    // Selected table + its views
    const [selectedTable, setSelectedTable] = useState<string>("");
    const [views, setViews] = useState<ViewInfo[]>([]);
    const [attributeNames, setAttributeNames] = useState<Map<string, string>>(new Map());
    const [loadingViews, setLoadingViews] = useState<boolean>(false);

    // Copy configuration
    const [leftTab, setLeftTab] = useState<"tables" | "configuration">("tables");
    const [sourceViewId, setSourceViewId] = useState<string>("");
    const [targetIds, setTargetIds] = useState<Set<string>>(new Set());
    const [options, setOptions] = useState<CopyOptions>({ columnLayout: true, sortOrder: true, components: true });
    const [isCopying, setIsCopying] = useState<boolean>(false);
    const [results, setResults] = useState<CopyResultItem[]>([]);
    const [publishStatus, setPublishStatus] = useState<"pending" | "success" | "error" | null>(null);
    const [publishMessage, setPublishMessage] = useState<string>("");

    const clearResults = () => {
        setResults([]);
        setPublishStatus(null);
        setPublishMessage("");
    };

    const table = tables.find((t) => t.logicalName === selectedTable);
    const sourceView = views.find((v) => v.id === sourceViewId);

    const showError = useCallback((message: string) => {
        setError(message);
        window.clearTimeout(errorTimer.current);
        errorTimer.current = window.setTimeout(() => setError(""), 8000);
    }, []);

    const fetchSolutionTableIds = useCallback(
        async (solutionId: string): Promise<Set<string> | null> => {
            try {
                return await client.listSolutionTableIds(solutionId);
            } catch (e: any) {
                showError(`Failed to load solution tables: ${e.message}`);
                return null;
            }
        },
        [showError],
    );

    // ---------------------------------------------------------------- boot
    useEffect(() => {
        const initialize = async () => {
            if (!window.dataverseAPI) {
                setFatalError("Not running in Power Platform ToolBox (PPTB). This tool requires PPTB.");
                setLoadingTables(false);
                return;
            }

            try {
                const activeConnection = await window.toolboxAPI?.connections.getActiveConnection();
                setConnectionUrl(activeConnection?.url || "");
            } catch (e) {
                console.error("Failed to get connection:", e);
            }

            try {
                const [solutionList, tableList, preferredSolutionId] = await Promise.all([client.listSolutions(), client.listTables(), client.getPreferredSolutionId()]);
                setSolutions(solutionList);
                setTables(tableList);

                // Default to the user's maker-portal preferred solution when it's one of the
                // unmanaged solutions we can write to; otherwise fall back to the first
                // alphabetically. Leaves "All tables" unselected only when no solutions exist.
                const defaultSolutionId = solutionList.find((s) => s.id === preferredSolutionId)?.id ?? solutionList[0]?.id ?? "";
                if (defaultSolutionId) {
                    setSelectedSolutionId(defaultSolutionId);
                    setSolutionTableIds(await fetchSolutionTableIds(defaultSolutionId));
                }
            } catch (e: any) {
                setFatalError(`Failed to load environment metadata: ${e.message}`);
            } finally {
                setLoadingTables(false);
            }
        };

        initialize();
        return () => window.clearTimeout(errorTimer.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ------------------------------------------------------- solution filter
    const handleSolutionSelect = async (solutionId: string) => {
        setSelectedSolutionId(solutionId);
        if (!solutionId) {
            setSolutionTableIds(null);
            return;
        }
        setLoadingTables(true);
        const ids = await fetchSolutionTableIds(solutionId);
        setSolutionTableIds(ids);
        if (ids) {
            // Clear the selected table if it fell out of the filtered list
            const stillVisible = tables.some((t) => t.logicalName === selectedTable && ids.has(t.metadataId));
            if (selectedTable && !stillVisible) {
                setSelectedTable("");
            }
        }
        setLoadingTables(false);
    };

    // --------------------------------------------------------- table select
    useEffect(() => {
        setViews([]);
        setAttributeNames(new Map());
        setSourceViewId("");
        setTargetIds(new Set());
        clearResults();

        if (!selectedTable) return;

        let cancelled = false;
        const load = async () => {
            try {
                setLoadingViews(true);
                const [viewList, attrNames] = await Promise.all([client.listViews(selectedTable), client.listAttributeDisplayNames(selectedTable)]);
                if (cancelled) return;
                viewList.sort((a, b) => viewTypeRank(a) - viewTypeRank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
                setViews(viewList);
                setAttributeNames(attrNames);
            } catch (e: any) {
                if (!cancelled) showError(`Failed to load views: ${e.message}`);
            } finally {
                if (!cancelled) setLoadingViews(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTable]);

    // -------------------------------------------------------- copy handlers
    const handleSourceSelect = (viewId: string) => {
        setSourceViewId(viewId);
        clearResults();
        setTargetIds((prev) => {
            if (!prev.has(viewId)) return prev;
            const next = new Set(prev);
            next.delete(viewId);
            return next;
        });
    };

    const handleTargetToggle = (viewId: string) => {
        clearResults();
        setTargetIds((prev) => {
            const next = new Set(prev);
            if (next.has(viewId)) {
                next.delete(viewId);
            } else {
                next.add(viewId);
            }
            return next;
        });
    };

    const lookupWarningViews = useMemo(() => {
        if (!sourceView || !table) return [];
        let firstColumn = "";
        try {
            firstColumn = parseLayoutColumns(sourceView.layoutxml).filter((c) => !c.isHidden)[0]?.name ?? "";
        } catch {
            return [];
        }
        if (firstColumn === table.primaryNameAttribute) return [];
        return views.filter((v) => targetIds.has(v.id) && isLookupView(v)).map((v) => v.name);
    }, [sourceView, table, targetIds, views]);

    const handleCopy = async () => {
        if (!sourceView || !table || targetIds.size === 0) return;

        const targets = views.filter((v) => targetIds.has(v.id));
        const progress: CopyResultItem[] = targets.map((v) => ({ viewId: v.id, viewName: v.name, status: "pending" }));
        clearResults();
        setResults(progress);
        setIsCopying(true);

        let requiredColumns: string[] = [];
        try {
            requiredColumns = parseLayoutColumns(sourceView.layoutxml).map((c) => c.name);
        } catch (e: any) {
            showError(`Could not parse the source view layout: ${e.message}`);
            setIsCopying(false);
            setResults([]);
            return;
        }

        let successCount = 0;
        let systemViewUpdated = false;

        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            try {
                const payload: ViewUpdatePayload = {};
                const notes: string[] = [];

                if (options.columnLayout) {
                    payload.layoutxml = buildTargetLayoutXml(sourceView.layoutxml, target.layoutxml);
                }

                // Even when only the layout is copied, the target fetchxml must
                // contain every attribute the layout references.
                const merge = mergeFetchXml(sourceView.fetchxml, target.fetchxml, options.columnLayout ? requiredColumns : [], options.sortOrder);
                if (merge.changed) {
                    payload.fetchxml = merge.fetchXml;
                }
                if (merge.addedAttributes.length > 0) {
                    notes.push(`added ${merge.addedAttributes.length} column${merge.addedAttributes.length === 1 ? "" : "s"} to the query`);
                }
                if (merge.addedLinkEntities.length > 0) {
                    notes.push(`added related table link (${merge.addedLinkEntities.join(", ")}) without its filters`);
                }
                if (merge.droppedOrders.length > 0) {
                    notes.push(`skipped sort on ${merge.droppedOrders.join(", ")} (related table not in target)`);
                }

                if (options.components && sourceView.layoutjson) {
                    if (supportsComponents(target)) {
                        payload.layoutjson = sourceView.layoutjson;
                    } else {
                        notes.push(`skipped components (${getViewTypeLabel(target)} does not support them)`);
                    }
                }

                if (Object.keys(payload).length === 0) {
                    progress[i] = { ...progress[i], status: "success", message: notes.length > 0 ? notes.join("; ") : "Nothing to change" };
                } else {
                    await client.updateView(target, payload);
                    if (!target.isPersonal) systemViewUpdated = true;
                    progress[i] = { ...progress[i], status: "success", message: notes.length > 0 ? notes.join("; ") : undefined };
                }
                successCount++;
            } catch (e: any) {
                progress[i] = { ...progress[i], status: "error", message: e.message };
            }
            setResults([...progress]);
        }

        let publishFailed = false;
        if (systemViewUpdated) {
            setPublishStatus("pending");
            setPublishMessage(`Publishing ${table.displayName}…`);
            try {
                await client.publishTable(table.logicalName);
                setPublishStatus("success");
                setPublishMessage(`${table.displayName} published`);
            } catch (e: any) {
                publishFailed = true;
                setPublishStatus("error");
                setPublishMessage(`Publish failed: ${e.message}. Publish the table manually.`);
                showError(`Views were updated but publishing failed: ${e.message}. Publish the table manually.`);
            }
        } else if (successCount > 0) {
            setPublishStatus("success");
            setPublishMessage("No publish needed — personal views apply immediately");
        }

        setIsCopying(false);

        // Refresh the views so previews/subsequent copies use the new definitions
        try {
            const refreshed = await client.listViews(table.logicalName);
            refreshed.sort((a, b) => viewTypeRank(a) - viewTypeRank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
            setViews(refreshed);
        } catch {
            /* non-fatal */
        }

        const errorCount = targets.length - successCount;
        if (window.toolboxAPI?.utils?.showNotification) {
            if (errorCount === 0 && !publishFailed) {
                await window.toolboxAPI.utils.showNotification({ title: "Layout copied", body: `Copied to ${successCount} view(s) and published.`, type: "success" });
            } else {
                await window.toolboxAPI.utils.showNotification({ title: "Completed with errors", body: `Success: ${successCount}, Failed: ${errorCount}`, type: "error" });
            }
        }
    };

    const handleReset = () => {
        setSourceViewId("");
        setTargetIds(new Set());
        clearResults();
    };

    // ---------------------------------------------------------------- render
    if (fatalError) {
        return (
            <div className="app">
                <div className="fatal-error">{fatalError}</div>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="app-header">
                <div className="app-title">
                    <span className="app-title-text">View Layout Copier</span>
                    <span className="app-version">v{APP_VERSION}</span>
                    {isDemoMode && <span className="tag tag-demo">Demo mode — sample data</span>}
                </div>
                {connectionUrl && (
                    <div className="connection-info" title={connectionUrl}>
                        {connectionUrl.replace(/^https?:\/\//, "")}
                    </div>
                )}
            </header>

            {error && (
                <div className="error-banner" role="alert">
                    {error}
                </div>
            )}

            <div className="app-body">
                <div className="left-col">
                    <div className="left-tabs" role="tablist">
                        <button type="button" role="tab" aria-selected={leftTab === "tables"} className={`left-tab ${leftTab === "tables" ? "active" : ""}`} onClick={() => setLeftTab("tables")}>
                            Tables
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={leftTab === "configuration"}
                            className={`left-tab ${leftTab === "configuration" ? "active" : ""}`}
                            onClick={() => setLeftTab("configuration")}
                        >
                            Configuration
                        </button>
                    </div>

                    {/* Both tab panels stay mounted so search text and scroll position survive tab switches */}
                    <div className="left-tab-content" hidden={leftTab !== "tables"}>
                        <TableSidebar
                            tables={tables}
                            solutionTableIds={solutionTableIds}
                            selectedTable={selectedTable}
                            onSelect={setSelectedTable}
                            loading={loadingTables}
                            headerSlot={<SolutionPicker solutions={solutions} selectedId={selectedSolutionId} onSelect={handleSolutionSelect} disabled={loadingTables && solutions.length === 0} />}
                        />
                    </div>
                    <div className="left-tab-content" hidden={leftTab !== "configuration"}>
                        <ConfigurationPanel options={options} onOptionsChange={setOptions} componentsAvailable={!!sourceView?.layoutjson} />
                    </div>

                    <div className="sidebar-copy">
                        <CopyActionsBar
                            options={options}
                            sourceView={sourceView}
                            targetCount={targetIds.size}
                            lookupWarningViews={lookupWarningViews}
                            primaryNameAttribute={table?.primaryNameAttribute ?? "name"}
                            isCopying={isCopying}
                            results={results}
                            publishStatus={publishStatus}
                            publishMessage={publishMessage}
                            onCopy={handleCopy}
                            onReset={handleReset}
                        />
                    </div>
                </div>

                <main className="main-area">
                    {!selectedTable && (
                        <div className="empty-state">
                            <div className="empty-state-icon" aria-hidden="true">
                                ⬱
                            </div>
                            <h2>Select a table on the left to get started</h2>
                            <ol className="empty-state-steps">
                                <li>Narrow the list by solution, or search by display or schema name</li>
                                <li>Pick the source view to copy the layout from — its columns show in a preview</li>
                                <li>Check the target views to apply it to</li>
                                <li>Adjust what gets copied on the Configuration tab, then Copy &amp; publish</li>
                            </ol>
                        </div>
                    )}

                    {selectedTable && table && (
                        <>
                            <div className="table-heading">
                                <h2>{table.displayName}</h2>
                                <span className="table-heading-logical">{table.logicalName}</span>
                                {loadingViews && <span className="loading-inline">Loading views…</span>}
                            </div>

                            {sourceView && <LayoutPreview view={sourceView} attributeNames={attributeNames} />}

                            <div className="work-area">
                                <ViewListPanel mode="source" views={views} selectedId={sourceViewId} onSelect={handleSourceSelect} />
                                <ViewListPanel
                                    mode="target"
                                    views={views}
                                    sourceId={sourceViewId}
                                    selectedIds={targetIds}
                                    onToggle={handleTargetToggle}
                                    onSelectAll={() => {
                                        clearResults();
                                        setTargetIds(new Set(views.filter((v) => v.id !== sourceViewId).map((v) => v.id)));
                                    }}
                                    onClearAll={() => {
                                        clearResults();
                                        setTargetIds(new Set());
                                    }}
                                />
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}

export default App;
