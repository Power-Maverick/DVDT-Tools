interface SolutionOption {
    uniqueName: string;
    displayName: string;
    version: string;
}

type TopbarFlyout = "display" | "canvas" | "session" | null;
type EdgeStyleType = "step" | "smoothstep" | "bezier";

interface AppTopbarProps {
    topbarRef: React.Ref<HTMLElement>;
    solutions: SolutionOption[];
    selectedSolution: string;
    loading: boolean;
    workingModel: boolean;
    visualMode: "flow" | "mermaid" | "drawio" | "plantuml";
    openTopbarFlyout: TopbarFlyout;
    edgeType: EdgeStyleType;
    hideAttributes: boolean;
    hideRelationshipNames: boolean;
    showChangedOnlyInGraph: boolean;
    showImpactMarkers: boolean;
    historyPastLength: number;
    historyFutureLength: number;
    showExportPanel: boolean;
    sessionNameInput: string;
    selectedSessionName: string;
    savedSessionNames: string[];
    changeCount: number;
    publishing: boolean;
    onSelectedSolutionChange: (value: string) => void;
    onLoadSolution: () => void;
    setOpenTopbarFlyout: React.Dispatch<React.SetStateAction<TopbarFlyout>>;
    onVisualModeChange: (value: "flow" | "mermaid" | "drawio" | "plantuml") => void;
    onEdgeTypeChange: (value: EdgeStyleType) => void;
    onHideAttributesChange: (value: boolean) => void;
    onHideRelationshipNamesChange: (value: boolean) => void;
    onFitGraphToView: () => void;
    onResetView: () => void;
    onAutoLayout: () => void;
    onShowChangedOnlyChange: (value: boolean) => void;
    onShowImpactMarkersChange: (value: boolean) => void;
    onUndo: () => void;
    onRedo: () => void;
    onExportPanelToggle: () => void;
    onSessionNameInputChange: (value: string) => void;
    onSelectedSessionNameChange: (value: string) => void;
    onSaveSession: () => void;
    onLoadSession: () => void;
    onShareSessionFile: () => void;
    onImportSessionClick: () => void;
    onPublishRequest: () => void;
}

export function AppTopbar(props: AppTopbarProps) {
    return (
        <header className="topbar" ref={props.topbarRef}>
            <div className="topbar-section">
                <select className="topbar-select" value={props.selectedSolution} onChange={(event) => props.onSelectedSolutionChange(event.target.value)} disabled={props.solutions.length === 0}>
                    <option value="">Select solution…</option>
                    {props.solutions.map((solution) => (
                        <option key={solution.uniqueName} value={solution.uniqueName}>
                            {solution.displayName} ({solution.version})
                        </option>
                    ))}
                </select>
                <button className="btn btn-primary topbar-load-btn" onClick={props.onLoadSolution} disabled={!props.selectedSolution || props.loading}>
                    Load ERD
                </button>
            </div>

            <div className="topbar-divider" />

            <div className="topbar-flyout">
                <button
                    className={`btn btn-tool ${props.openTopbarFlyout === "display" ? "is-active" : ""}`}
                    onClick={() => props.setOpenTopbarFlyout((current) => (current === "display" ? null : "display"))}
                >
                    Display: {props.visualMode === "flow" ? "Flow" : props.visualMode === "drawio" ? "Draw.io" : props.visualMode === "plantuml" ? "PlantUML" : "Mermaid"} ▾
                </button>
                {props.openTopbarFlyout === "display" && (
                    <div className="topbar-flyout-menu">
                        <div className="topbar-flyout-section-title">Visual</div>
                        <button
                            className={`btn btn-tool ${props.visualMode === "flow" ? "is-active" : ""}`}
                            onClick={() => {
                                props.onVisualModeChange("flow");
                                props.setOpenTopbarFlyout(null);
                            }}
                        >
                            Flow
                        </button>
                        <button
                            className={`btn btn-tool ${props.visualMode === "mermaid" ? "is-active" : ""}`}
                            onClick={() => {
                                props.onVisualModeChange("mermaid");
                                props.setOpenTopbarFlyout(null);
                            }}
                        >
                            Mermaid
                        </button>
                        <button
                            className={`btn btn-tool ${props.visualMode === "drawio" ? "is-active" : ""}`}
                            onClick={() => {
                                props.onVisualModeChange("drawio");
                                props.setOpenTopbarFlyout(null);
                            }}
                        >
                            Draw.io
                        </button>
                        <button
                            className={`btn btn-tool ${props.visualMode === "plantuml" ? "is-active" : ""}`}
                            onClick={() => {
                                props.onVisualModeChange("plantuml");
                                props.setOpenTopbarFlyout(null);
                            }}
                        >
                            PlantUML
                        </button>

                        {props.visualMode === "flow" ? (
                            <>
                                <div className="topbar-flyout-section-title">Edges</div>
                                <button className={`btn btn-tool ${props.edgeType === "step" ? "is-active" : ""}`} onClick={() => props.onEdgeTypeChange("step")}>
                                    Step
                                </button>
                                <button className={`btn btn-tool ${props.edgeType === "smoothstep" ? "is-active" : ""}`} onClick={() => props.onEdgeTypeChange("smoothstep")}>
                                    Smooth-step
                                </button>
                                <button className={`btn btn-tool ${props.edgeType === "bezier" ? "is-active" : ""}`} onClick={() => props.onEdgeTypeChange("bezier")}>
                                    Bezier
                                </button>

                                <label className="topbar-toggle">
                                    <input type="checkbox" checked={props.hideAttributes} onChange={(event) => props.onHideAttributesChange(event.target.checked)} />
                                    <span>Hide attributes</span>
                                </label>
                                <label className="topbar-toggle">
                                    <input type="checkbox" checked={props.hideRelationshipNames} onChange={(event) => props.onHideRelationshipNamesChange(event.target.checked)} />
                                    <span>Hide relationship name</span>
                                </label>
                            </>
                        ) : (
                            <div className="topbar-flyout-note">Flow-only display options are hidden for this visual mode.</div>
                        )}
                    </div>
                )}
            </div>

            {props.workingModel && (
                <>
                    <div className="topbar-divider" />
                    <div className="topbar-flyout">
                        <button
                            className={`btn btn-tool ${props.openTopbarFlyout === "canvas" ? "is-active" : ""}`}
                            onClick={() => props.setOpenTopbarFlyout((current) => (current === "canvas" ? null : "canvas"))}
                            disabled={props.visualMode !== "flow"}
                            title={props.visualMode !== "flow" ? "Canvas options are available only in Flow mode" : "Canvas options"}
                        >
                            Canvas ▾
                        </button>
                        {props.openTopbarFlyout === "canvas" && (
                            <div className="topbar-flyout-menu topbar-flyout-menu-canvas">
                                <button className="btn btn-tool" onClick={props.onFitGraphToView} title="Fit graph to view">
                                    Fit
                                </button>
                                <button className="btn btn-tool" onClick={props.onResetView} title="Reset view">
                                    Reset
                                </button>
                                <button className="btn btn-tool" onClick={props.onAutoLayout} title="Auto-layout nodes">
                                    Auto-layout
                                </button>
                                <label className="topbar-toggle">
                                    <input type="checkbox" checked={props.showChangedOnlyInGraph} onChange={(event) => props.onShowChangedOnlyChange(event.target.checked)} />
                                    <span>Changed only</span>
                                </label>
                                <label className="topbar-toggle">
                                    <input type="checkbox" checked={props.showImpactMarkers} onChange={(event) => props.onShowImpactMarkersChange(event.target.checked)} />
                                    <span>Impact markers</span>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="topbar-divider" />
                    <div className="topbar-section">
                        <button className="btn btn-tool" onClick={props.onUndo} disabled={props.historyPastLength === 0} title="Undo">
                            ↩
                        </button>
                        <button className="btn btn-tool" onClick={props.onRedo} disabled={props.historyFutureLength === 0} title="Redo">
                            ↪
                        </button>
                    </div>

                    <div className="topbar-divider" />
                    <button className={`btn btn-tool ${props.showExportPanel ? "is-active" : ""}`} onClick={props.onExportPanelToggle} title="Toggle export panel">
                        Export
                    </button>
                </>
            )}

            <div className="topbar-divider" />
            <div className="topbar-flyout">
                <button
                    className={`btn btn-tool ${props.openTopbarFlyout === "session" ? "is-active" : ""}`}
                    onClick={() => props.setOpenTopbarFlyout((current) => (current === "session" ? null : "session"))}
                    title="Session actions"
                >
                    Session ▾
                </button>
                {props.openTopbarFlyout === "session" && (
                    <div className="topbar-flyout-menu topbar-flyout-menu-canvas">
                        <div className="topbar-flyout-section-title">Session Name</div>
                        <input className="session-input" value={props.sessionNameInput} onChange={(event) => props.onSessionNameInputChange(event.target.value)} placeholder="Enter a name to save" />
                        <div className="topbar-flyout-section-title">Saved Sessions</div>
                        <select className="session-select" value={props.selectedSessionName} onChange={(event) => props.onSelectedSessionNameChange(event.target.value)}>
                            <option value="">Select a saved session…</option>
                            {props.savedSessionNames.map((name) => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <button className="btn btn-tool" onClick={props.onSaveSession} disabled={!props.sessionNameInput.trim() && !props.selectedSessionName.trim() && !props.selectedSolution.trim()}>
                            Save Session
                        </button>
                        <button className="btn btn-tool" onClick={props.onLoadSession} disabled={props.savedSessionNames.length === 0}>
                            Load Session
                        </button>
                        <button className="btn btn-tool" onClick={props.onShareSessionFile} disabled={!props.workingModel}>
                            Share Session (JSON)
                        </button>
                        <button className="btn btn-tool" onClick={props.onImportSessionClick}>
                            Import Session JSON
                        </button>
                        <div className="topbar-flyout-note">Saved sessions can be loaded directly without selecting a solution first.</div>
                    </div>
                )}
            </div>

            <div className="topbar-spacer" />

            {props.workingModel && (
                <div className="topbar-section">
                    {props.changeCount > 0 && (
                        <span className="change-pill has-changes">
                            {props.changeCount} {props.changeCount === 1 ? "change" : "changes"}
                        </span>
                    )}
                    <button className="btn btn-publish" onClick={props.onPublishRequest} disabled={props.publishing || props.changeCount === 0}>
                        {props.publishing ? "Publishing…" : "↑ Publish"}
                    </button>
                </div>
            )}
        </header>
    );
}
