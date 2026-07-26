import { Handle, NodeProps, Position } from "@xyflow/react";
import { ERDEditorTable } from "../models/editor";

export interface GraphTableNodeData extends Record<string, unknown> {
    table: ERDEditorTable;
    isNewTable: boolean;
    isRenamed: boolean;
    showImpactMarkers: boolean;
    impact: "low" | "medium" | "high" | "none";
    maxVisibleAttributes: number;
    hideAttributes: boolean;
    customAttributeCount: number;
    totalAttributeCount: number;
    animateIn: boolean;
    animationDelayMs: number;
    newAttributeIds: Set<string>;
    renamedAttributeIds: Set<string>;
    onSelect: (tableId: string, displayName: string) => void;
}

export function GraphTableNode({ id, data: rawData, selected }: NodeProps) {
    const data = rawData as GraphTableNodeData;
    const { table } = data;
    const impactLabel = data.impact !== "none" ? data.impact.charAt(0).toUpperCase() + data.impact.slice(1) : "";
    const newlyAddedAttributes = table.attributes.filter((attribute) => data.newAttributeIds.has(attribute.id));

    return (
        <div
            className={["rf-table-node", selected ? "is-selected" : "", data.isNewTable ? "is-new" : "", data.isRenamed ? "is-renamed" : "", data.animateIn ? "is-entering" : ""].join(" ")}
            style={{ animationDelay: `${data.animationDelayMs}ms` }}
            onClick={() => data.onSelect(id, table.displayName)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    data.onSelect(id, table.displayName);
                }
            }}
        >
            <Handle type="target" position={Position.Left} className="rf-table-handle" />
            <div className="graph-node-header">
                <div>
                    <strong>{table.displayName}</strong>
                    <div className="muted-text">{table.logicalName}</div>
                </div>
                <div className="node-badges">
                    {data.isNewTable && <span className="badge badge-new">New</span>}
                    {data.isRenamed && <span className="badge badge-renamed">Renamed</span>}
                    {data.showImpactMarkers && data.impact !== "none" && <span className={`badge badge-impact-${data.impact}`}>{impactLabel}</span>}
                </div>
            </div>
            <div className="graph-node-attrs">
                {data.hideAttributes ? (
                    <>
                        {newlyAddedAttributes.slice(0, 3).map((attribute) => (
                            <div key={attribute.id} className="graph-attr graph-attr-promoted">
                                <span className="graph-attr-name">{attribute.logicalName}</span>
                                <span className="graph-attr-type">{attribute.type}</span>
                            </div>
                        ))}
                        {newlyAddedAttributes.length > 3 && <div className="graph-attr-more">+{newlyAddedAttributes.length - 3} more new</div>}
                        <div className="graph-attr-summary">
                            {data.customAttributeCount} custom · {data.totalAttributeCount} total
                        </div>
                    </>
                ) : (
                    <>
                        {table.attributes.slice(0, data.maxVisibleAttributes).map((attribute) => {
                            const attrNew = data.newAttributeIds.has(attribute.id);
                            const attrRenamed = data.renamedAttributeIds.has(attribute.id);
                            return (
                                <div key={attribute.id} className={`graph-attr ${attrNew ? "is-new" : ""} ${attrRenamed ? "is-renamed" : ""}`}>
                                    <span className="graph-attr-name">{attribute.logicalName}</span>
                                    <span className="graph-attr-type">{attribute.type}</span>
                                </div>
                            );
                        })}
                        {table.attributes.length > data.maxVisibleAttributes && <div className="graph-attr-more">+{table.attributes.length - data.maxVisibleAttributes} more</div>}
                    </>
                )}
            </div>
            <Handle type="source" position={Position.Right} className="rf-table-handle" />
        </div>
    );
}
