import { ERDEditorModel, ERDEditorTable, RelationshipType } from "../models/editor";

type CanvasActionTab = "table" | "attribute" | "relationship";

interface CanvasActionDockProps {
    workingModel: ERDEditorModel;
    publisherPrefixWithUnderscore: string;
    selectedTable: ERDEditorTable | null;
    showCanvasActionPanel: boolean;
    canvasActionTab: CanvasActionTab;
    newTableLogicalName: string;
    newTableDisplayName: string;
    renameTableDisplayName: string;
    newAttributeLogicalName: string;
    newAttributeDisplayName: string;
    newAttributeType: string;
    relationshipName: string;
    relationshipTarget: string;
    relationshipType: RelationshipType;
    onTogglePanel: () => void;
    onCanvasActionTabChange: (value: CanvasActionTab) => void;
    onNewTableLogicalNameChange: (value: string) => void;
    onNewTableDisplayNameChange: (value: string) => void;
    onRenameTableDisplayNameChange: (value: string) => void;
    onNewAttributeLogicalNameChange: (value: string) => void;
    onNewAttributeDisplayNameChange: (value: string) => void;
    onNewAttributeTypeChange: (value: string) => void;
    onRelationshipNameChange: (value: string) => void;
    onRelationshipTargetChange: (value: string) => void;
    onRelationshipTypeChange: (value: RelationshipType) => void;
    onAddTable: () => void;
    onRenameTable: () => void;
    onAddAttribute: () => void;
    onAddRelationship: () => void;
}

export function CanvasActionDock(props: CanvasActionDockProps) {
    return (
        <>
            <button className={`canvas-fab ${props.showCanvasActionPanel ? "is-open" : ""}`} onClick={props.onTogglePanel} title="Open add and update actions">
                {props.showCanvasActionPanel ? "Close" : "Add / Update"}
            </button>
            {props.showCanvasActionPanel && (
                <div className="canvas-action-dock">
                    <div className="canvas-action-tabs">
                        <button className={`tab-btn ${props.canvasActionTab === "table" ? "is-active" : ""}`} onClick={() => props.onCanvasActionTabChange("table")}>
                            Table
                        </button>
                        <button
                            className={`tab-btn ${props.canvasActionTab === "attribute" ? "is-active" : ""}`}
                            onClick={() => props.onCanvasActionTabChange("attribute")}
                            disabled={!props.selectedTable}
                        >
                            Attribute
                        </button>
                        <button
                            className={`tab-btn ${props.canvasActionTab === "relationship" ? "is-active" : ""}`}
                            onClick={() => props.onCanvasActionTabChange("relationship")}
                            disabled={!props.selectedTable}
                        >
                            Relationship
                        </button>
                    </div>

                    {props.canvasActionTab === "table" && (
                        <div className="canvas-action-body">
                            <div className="form-group">
                                <label>Add table</label>
                                <div className="prefix-inline">
                                    <span className="prefix-chip">{props.publisherPrefixWithUnderscore || "prefix_"}</span>
                                    <input value={props.newTableLogicalName} onChange={(event) => props.onNewTableLogicalNameChange(event.target.value)} placeholder="table_suffix" />
                                </div>
                                <input value={props.newTableDisplayName} onChange={(event) => props.onNewTableDisplayNameChange(event.target.value)} placeholder="Display Name (optional)" />
                                <button className="btn btn-primary" onClick={props.onAddTable}>
                                    Add Table
                                </button>
                            </div>

                            {props.selectedTable && (
                                <div className="form-group">
                                    <label>Rename selected table</label>
                                    <input value={props.renameTableDisplayName} onChange={(event) => props.onRenameTableDisplayNameChange(event.target.value)} placeholder="Table display name" />
                                    <button className="btn btn-secondary" onClick={props.onRenameTable}>
                                        Update Name
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {props.canvasActionTab === "attribute" && props.selectedTable && (
                        <div className="canvas-action-body">
                            <div className="form-group">
                                <label>
                                    Add attribute to <span className="entity-focus-chip">{props.selectedTable.displayName}</span>
                                </label>
                                <div className="prefix-inline">
                                    <span className="prefix-chip">{props.publisherPrefixWithUnderscore || "prefix_"}</span>
                                    <input value={props.newAttributeLogicalName} onChange={(event) => props.onNewAttributeLogicalNameChange(event.target.value)} placeholder="attribute_suffix" />
                                </div>
                                <input value={props.newAttributeDisplayName} onChange={(event) => props.onNewAttributeDisplayNameChange(event.target.value)} placeholder="Display name" />
                                <select value={props.newAttributeType} onChange={(event) => props.onNewAttributeTypeChange(event.target.value)}>
                                    <option value="string">string</option>
                                    <option value="int">int</option>
                                    <option value="decimal">decimal</option>
                                    <option value="datetime">datetime</option>
                                    <option value="boolean">boolean</option>
                                    <option value="lookup">lookup</option>
                                </select>
                                <button className="btn btn-primary" onClick={props.onAddAttribute}>
                                    Add Attribute
                                </button>
                            </div>
                        </div>
                    )}

                    {props.canvasActionTab === "relationship" && props.selectedTable && (
                        <div className="canvas-action-body">
                            <div className="form-group">
                                <label>
                                    Add relationship from <span className="entity-focus-chip">{props.selectedTable.displayName}</span>
                                </label>
                                <div className="prefix-inline">
                                    <span className="prefix-chip">{props.publisherPrefixWithUnderscore || "prefix_"}</span>
                                    <input value={props.relationshipName} onChange={(event) => props.onRelationshipNameChange(event.target.value)} placeholder="relationship_suffix (optional)" />
                                </div>
                                <select value={props.relationshipTarget} onChange={(event) => props.onRelationshipTargetChange(event.target.value)}>
                                    {props.workingModel.tables.map((table) => (
                                        <option key={table.id} value={table.id}>
                                            {table.displayName}
                                        </option>
                                    ))}
                                </select>
                                <select value={props.relationshipType} onChange={(event) => props.onRelationshipTypeChange(event.target.value as RelationshipType)}>
                                    <option value="ManyToOne">ManyToOne</option>
                                    <option value="OneToMany">OneToMany</option>
                                    <option value="ManyToMany">ManyToMany</option>
                                </select>
                                <button className="btn btn-primary" onClick={props.onAddRelationship}>
                                    Add Relationship
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
