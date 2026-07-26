import { Background, Controls, Edge, MarkerType, Node, NodeTypes, ReactFlow, ReactFlowInstance } from "@xyflow/react";
import { ERDEditorModel, ModelDiff } from "../models/editor";
import { GraphPositions } from "../utils/graphLayout";
import { GraphTableNode, GraphTableNodeData } from "./GraphTableNode";

type EdgeStyleType = "step" | "smoothstep" | "bezier";

const nodeTypes: NodeTypes = { tableNode: GraphTableNode };
const IMPACT_MEDIUM_ATTRIBUTE_THRESHOLD = 8;
const IMPACT_HIGH_ATTRIBUTE_THRESHOLD = 18;
const GRAPH_NODE_MAX_VISIBLE_ATTRIBUTES = 9;

const getImpactLevel = (attributeCount: number): "low" | "medium" | "high" => {
    if (attributeCount > IMPACT_HIGH_ATTRIBUTE_THRESHOLD) return "high";
    if (attributeCount > IMPACT_MEDIUM_ATTRIBUTE_THRESHOLD) return "medium";
    return "low";
};

interface GraphCanvasProps {
    workingModel: ERDEditorModel;
    diff: ModelDiff | null;
    positions: GraphPositions;
    selectedTableId: string;
    visibleTableIds: Set<string>;
    includeRelationships: boolean;
    hideRelationshipNames: boolean;
    edgeType: EdgeStyleType;
    showImpactMarkers: boolean;
    hideAttributes: boolean;
    graphEntryAnimating: boolean;
    onReactFlowInit: (instance: ReactFlowInstance<Node<GraphTableNodeData>, Edge>) => void;
    onTableSelect: (tableId: string, displayName: string) => void;
    onPushSnapshot: () => void;
    onPositionChange: (tableId: string, x: number, y: number) => void;
}

export function GraphCanvas(props: GraphCanvasProps) {
    const visibleTables = props.workingModel.tables.filter((table) => props.visibleTableIds.has(table.id));
    const visibleTableIdSet = new Set(visibleTables.map((table) => table.id));
    const visibleRelationships = props.includeRelationships
        ? props.workingModel.relationships
              .filter((rel) => visibleTableIdSet.has(rel.fromTableId) && visibleTableIdSet.has(rel.toTableId))
              .filter((rel) => rel.fromTableId !== rel.toTableId)
              .filter((rel, index, all) => {
                  const key = [rel.schemaName, ...[rel.fromTableId, rel.toTableId].sort()].join("|");
                  return index === all.findIndex((candidate) => [candidate.schemaName, ...[candidate.fromTableId, candidate.toTableId].sort()].join("|") === key);
              })
        : [];

    const nodes: Node<GraphTableNodeData>[] = visibleTables.map((table, index) => {
        const tablePosition = props.positions[table.id] || { x: 24, y: 24 };
        const isNewTable = !!props.diff?.newTableIds.has(table.id);
        const isRenamed = !!props.diff?.renamedTableIds.has(table.id);
        const hasAttributeChanges = table.attributes.some((attribute) => !!props.diff && (props.diff.newAttributeIds.has(attribute.id) || props.diff.renamedAttributeIds.has(attribute.id)));
        const impact = hasAttributeChanges || isNewTable || isRenamed ? getImpactLevel(table.attributes.length) : "none";

        return {
            id: table.id,
            type: "tableNode",
            position: tablePosition,
            selected: props.selectedTableId === table.id,
            data: {
                table,
                isNewTable,
                isRenamed,
                showImpactMarkers: props.showImpactMarkers,
                impact,
                maxVisibleAttributes: GRAPH_NODE_MAX_VISIBLE_ATTRIBUTES,
                hideAttributes: props.hideAttributes,
                customAttributeCount: table.attributes.filter((attribute) => attribute.logicalName.toLowerCase().startsWith(`${props.workingModel.publisherPrefix.toLowerCase()}_`)).length,
                totalAttributeCount: table.attributes.length,
                animateIn: props.graphEntryAnimating,
                animationDelayMs: Math.min(450, index * 40),
                newAttributeIds: props.diff?.newAttributeIds || new Set<string>(),
                renamedAttributeIds: props.diff?.renamedAttributeIds || new Set<string>(),
                onSelect: props.onTableSelect,
            },
        };
    });

    const edges: Edge[] = visibleRelationships.map((relationship) => ({
        id: relationship.id,
        source: relationship.fromTableId,
        target: relationship.toTableId,
        label: props.hideRelationshipNames ? undefined : relationship.schemaName,
        animated: !!props.diff?.newRelationshipIds.has(relationship.id),
        type: props.edgeType,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { stroke: props.diff?.newRelationshipIds.has(relationship.id) ? "#2f89fc" : "#7f8ea3", strokeWidth: 1.7 },
        labelStyle: { fill: "#667085", fontSize: 11, fontWeight: 600 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.8 },
        labelBgPadding: [4, 2] as [number, number],
    }));

    return (
        <div className={`graph-canvas ${props.graphEntryAnimating ? "is-entering" : ""}`}>
            <ReactFlow<Node<GraphTableNodeData>, Edge>
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                defaultEdgeOptions={{ type: props.edgeType, markerEnd: { type: MarkerType.ArrowClosed } }}
                onInit={props.onReactFlowInit}
                onNodeClick={(_, node) => {
                    const currentTable = props.workingModel.tables.find((table) => table.id === node.id);
                    if (!currentTable) return;
                    props.onTableSelect(node.id, currentTable.displayName);
                }}
                onNodeDragStart={props.onPushSnapshot}
                onNodeDragStop={(_, node) => props.onPositionChange(node.id, node.position.x, node.position.y)}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.25}
                maxZoom={2.2}
                proOptions={{ hideAttribution: true }}
            >
                <Background gap={20} size={1} color="rgba(108, 117, 125, 0.2)" />
                <Controls showInteractive={false} />
            </ReactFlow>
        </div>
    );
}
