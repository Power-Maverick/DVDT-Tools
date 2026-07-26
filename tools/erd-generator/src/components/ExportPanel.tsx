import { ExportMode, OutputFormat, VisualExportType } from "../utils/visualExport";

interface ExportPanelProps {
    showExportPanel: boolean;
    workingModelExists: boolean;
    selectedFormat: OutputFormat;
    exportSource: "working" | "baseline";
    exportChangedOnly: boolean;
    exportMode: ExportMode;
    visualExportType: VisualExportType;
    includeAttributes: boolean;
    includeRelationships: boolean;
    maxAttributesPerTable: number;
    availableVisualExportTypes: VisualExportType[];
    onClose: () => void;
    onExportSourceChange: (value: "working" | "baseline") => void;
    onExportChangedOnlyChange: (value: boolean) => void;
    onSelectedFormatChange: (value: OutputFormat) => void;
    onExportModeChange: (value: ExportMode) => void;
    onVisualExportTypeChange: (value: VisualExportType) => void;
    onIncludeAttributesChange: (value: boolean) => void;
    onIncludeRelationshipsChange: (value: boolean) => void;
    onMaxAttributesPerTableChange: (value: number) => void;
    onDownload: () => void;
    onCopy: () => void;
}

export function ExportPanel(props: ExportPanelProps) {
    if (!props.showExportPanel || !props.workingModelExists) return null;

    return (
        <aside className="export-panel">
            <div className="panel-header">
                <span>Export</span>
                <button className="panel-close" onClick={props.onClose}>
                    ✕
                </button>
            </div>
            <div className="panel-body">
                <div className="form-group">
                    <label>Source</label>
                    <div className="format-selector">
                        <button className={`format-btn ${props.exportSource === "working" ? "active" : ""}`} onClick={() => props.onExportSourceChange("working")}>
                            Working
                        </button>
                        <button className={`format-btn ${props.exportSource === "baseline" ? "active" : ""}`} onClick={() => props.onExportSourceChange("baseline")}>
                            Baseline
                        </button>
                    </div>
                    <label className="option-item">
                        <input
                            type="checkbox"
                            checked={props.exportChangedOnly}
                            disabled={props.exportSource !== "working"}
                            onChange={(event) => props.onExportChangedOnlyChange(event.target.checked)}
                        />
                        <span className="inline-label">Changed only</span>
                    </label>
                </div>

                <div className="form-group">
                    <label>Diagram</label>
                    <div className="format-selector format-selector-grid">
                        {(["flow", "mermaid", "plantuml", "drawio"] as const).map((format) => (
                            <button key={format} className={`format-btn ${props.selectedFormat === format ? "active" : ""}`} onClick={() => props.onSelectedFormatChange(format)}>
                                {format === "flow" ? "Flow" : format === "drawio" ? "Draw.io" : format === "plantuml" ? "PlantUML" : "Mermaid"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label>Format</label>
                    <div className="format-selector">
                        <button className={`format-btn ${props.exportMode === "text" ? "active" : ""}`} onClick={() => props.onExportModeChange("text")} disabled={props.selectedFormat === "flow"}>
                            Text
                        </button>
                        <button className={`format-btn ${props.exportMode === "visual" ? "active" : ""}`} onClick={() => props.onExportModeChange("visual")}>
                            Visual
                        </button>
                        <button className={`format-btn ${props.exportMode === "both" ? "active" : ""}`} onClick={() => props.onExportModeChange("both")} disabled={props.selectedFormat === "flow"}>
                            Both
                        </button>
                    </div>
                    {props.selectedFormat === "flow" && <div className="muted-text">Flow exports are visual-only.</div>}
                </div>

                <div className="form-group">
                    <label>Visual Type</label>
                    <div className="format-selector">
                        {(["html", "svg", "png"] as const).map((type) => (
                            <button
                                key={type}
                                className={`format-btn ${props.visualExportType === type ? "active" : ""}`}
                                onClick={() => props.onVisualExportTypeChange(type)}
                                disabled={!props.availableVisualExportTypes.includes(type)}
                            >
                                {type.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label>Options</label>
                    <label className="option-item">
                        <input type="checkbox" checked={props.includeAttributes} onChange={(event) => props.onIncludeAttributesChange(event.target.checked)} />
                        <span className="inline-label">Include attributes</span>
                    </label>
                    <label className="option-item">
                        <input type="checkbox" checked={props.includeRelationships} onChange={(event) => props.onIncludeRelationshipsChange(event.target.checked)} />
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
                            value={props.maxAttributesPerTable}
                            onChange={(event) => {
                                const parsed = Number.parseInt(event.target.value, 10);
                                if (!Number.isNaN(parsed) && parsed >= 0) props.onMaxAttributesPerTableChange(parsed);
                            }}
                            className="number-input"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <button className="btn btn-primary" onClick={props.onDownload}>
                        Download
                    </button>
                    <button className="btn btn-secondary" onClick={props.onCopy}>
                        {props.selectedFormat === "flow" ? "Copy JSON" : "Copy to clipboard"}
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
    );
}
