import plantumlEncoder from 'plantuml-encoder';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ERDGenerator } from './components/ERDGenerator';
import {
    ERDEditorModel,
    ModelDiff,
    cloneModel,
    diffModel,
    makeId,
    toDataverseSolution,
    toEditorModel,
    totalChangeCount,
    changedOnlyModel,
} from './models/editor';
import { DataverseSolution } from './models/interfaces';
import { DataverseClient } from './utils/DataverseClient';
import { GraphPositions, generateGridLayout, getBounds, mergePositions, nodeWidth } from './utils/graphLayout';

declare global {
    interface Window {
        acquireVsCodeApi?: () => {
            postMessage: (message: any) => void;
        };
        mermaid?: {
            initialize: (config: any) => void;
            init: (config: any, element: HTMLElement | null) => Promise<void>;
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

type OutputFormat = 'mermaid' | 'plantuml' | 'drawio';

type ViewMode = 'interactive' | 'preview';

const ERROR_DISPLAY_DURATION_MS = 7000;
const IMPACT_MEDIUM_ATTRIBUTE_THRESHOLD = 8;
const IMPACT_HIGH_ATTRIBUTE_THRESHOLD = 18;
const GRAPH_NODE_MAX_VISIBLE_ATTRIBUTES = 9;
const RESERVED_NAMES = new Set([
    'entity', 'table', 'attribute', 'relationship', 'select', 'from', 'where',
    'insert', 'update', 'delete', 'order', 'group', 'join', 'inner', 'outer',
    'create', 'drop', 'alter', 'having', 'distinct', 'union', 'truncate',
]);
const getImpactLevel = (attributeCount: number): 'low' | 'medium' | 'high' => {
    if (attributeCount > IMPACT_HIGH_ATTRIBUTE_THRESHOLD) return 'high';
    if (attributeCount > IMPACT_MEDIUM_ATTRIBUTE_THRESHOLD) return 'medium';
    return 'low';
};

function App() {
    const [isPPTB, setIsPPTB] = useState<boolean>(false);
    const [connectionUrl, setConnectionUrl] = useState<string>('');
    const [accessToken, setAccessToken] = useState<string>('');
    const [solutions, setSolutions] = useState<Solution[]>([]);
    const [selectedSolution, setSelectedSolution] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    const [baselineModel, setBaselineModel] = useState<ERDEditorModel | null>(null);
    const [workingModel, setWorkingModel] = useState<ERDEditorModel | null>(null);
    const [positions, setPositions] = useState<GraphPositions>({});
    const [historyPast, setHistoryPast] = useState<EditorSnapshot[]>([]);
    const [historyFuture, setHistoryFuture] = useState<EditorSnapshot[]>([]);

    const [viewMode, setViewMode] = useState<ViewMode>('interactive');
    const [previewMode, setPreviewMode] = useState<'visual' | 'text'>('visual');
    const [selectedFormat, setSelectedFormat] = useState<OutputFormat>('mermaid');

    const [includeAttributes, setIncludeAttributes] = useState<boolean>(true);
    const [includeRelationships, setIncludeRelationships] = useState<boolean>(true);
    const [maxAttributesPerTable, setMaxAttributesPerTable] = useState<number>(12);

    const [exportSource, setExportSource] = useState<'working' | 'baseline'>('working');
    const [exportChangedOnly, setExportChangedOnly] = useState<boolean>(false);

    const [showChangedOnlyInGraph, setShowChangedOnlyInGraph] = useState<boolean>(false);
    const [showImpactMarkers, setShowImpactMarkers] = useState<boolean>(true);

    const [selectedTableId, setSelectedTableId] = useState<string>('');
    const [newTableLogicalName, setNewTableLogicalName] = useState<string>('');
    const [newTableDisplayName, setNewTableDisplayName] = useState<string>('');
    const [renameTableDisplayName, setRenameTableDisplayName] = useState<string>('');
    const [newAttributeLogicalName, setNewAttributeLogicalName] = useState<string>('');
    const [newAttributeDisplayName, setNewAttributeDisplayName] = useState<string>('');
    const [newAttributeType, setNewAttributeType] = useState<string>('string');
    const [attributeRenameDrafts, setAttributeRenameDrafts] = useState<Record<string, string>>({});

    const [relationshipName, setRelationshipName] = useState<string>('');
    const [relationshipTarget, setRelationshipTarget] = useState<string>('');
    const [relationshipType, setRelationshipType] = useState<'OneToMany' | 'ManyToOne' | 'ManyToMany'>('ManyToOne');

    const [publishing, setPublishing] = useState<boolean>(false);
    const [showPublishConfirm, setShowPublishConfirm] = useState<boolean>(false);
    const [publishResult, setPublishResult] = useState<{ success: boolean; lines: string[] } | null>(null);

    const [generatedDiagrams, setGeneratedDiagrams] = useState<Record<OutputFormat, string>>({
        mermaid: '',
        plantuml: '',
        drawio: '',
    });

    const [mermaidReady, setMermaidReady] = useState<boolean>(false);

    const graphContainerRef = useRef<HTMLDivElement | null>(null);
    const [viewport, setViewport] = useState({ x: 24, y: 24, scale: 1 });
    const [panning, setPanning] = useState<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
    const [draggingNode, setDraggingNode] = useState<{ tableId: string; startMouseX: number; startMouseY: number; originX: number; originY: number } | null>(null);

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

    const changeCount = diff ? totalChangeCount(diff) : 0;

    const getModelForExport = (): ERDEditorModel | null => {
        if (!workingModel || !baselineModel) return null;
        if (exportSource === 'baseline') return baselineModel;
        if (!exportChangedOnly) return workingModel;
        return changedOnlyModel(baselineModel, workingModel);
    };

    useEffect(() => {
        if (!selectedTable) {
            setAttributeRenameDrafts({});
            return;
        }
        const drafts: Record<string, string> = {};
        for (const attribute of selectedTable.attributes) {
            drafts[attribute.id] = attribute.displayName;
        }
        setAttributeRenameDrafts(drafts);
    }, [selectedTable]);

    useEffect(() => {
        const initializeEnvironment = async () => {
            if (typeof window.acquireVsCodeApi !== 'undefined') {
                setIsPPTB(false);
                setLoading(true);

                const handleMessage = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === 'setCredentials') {
                        setConnectionUrl(message.environmentUrl);
                        setAccessToken(message.accessToken);
                        setLoading(false);
                    }
                };

                window.addEventListener('message', handleMessage);
                return () => window.removeEventListener('message', handleMessage);
            }

            if (window.toolboxAPI) {
                setIsPPTB(true);
                try {
                    const activeConnection = await window.toolboxAPI.connections.getActiveConnection();
                    setConnectionUrl(activeConnection?.url || '');
                } catch (err) {
                    console.error('Failed to get active connection', err);
                }
                setLoading(false);
                return;
            }

            setError('Not running in supported environment (DVDT or PPTB)');
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
            setGeneratedDiagrams({ mermaid: '', plantuml: '', drawio: '' });
            return;
        }

        const diagramSolution = toDataverseSolution(model);
        const generatorConfig = {
            includeAttributes,
            includeRelationships,
            maxAttributesPerTable,
        };

        setGeneratedDiagrams({
            mermaid: new ERDGenerator({ ...generatorConfig, format: 'mermaid' }).generate(diagramSolution),
            plantuml: new ERDGenerator({ ...generatorConfig, format: 'plantuml' }).generate(diagramSolution),
            drawio: new ERDGenerator({ ...generatorConfig, format: 'drawio' }).generate(diagramSolution),
        });
    }, [workingModel, baselineModel, includeAttributes, includeRelationships, maxAttributesPerTable, exportSource, exportChangedOnly]);

    useEffect(() => {
        const preloadMermaid = async () => {
            try {
                await ensureMermaid();
                setMermaidReady(true);
            } catch (err) {
                console.error('Failed to preload mermaid:', err);
            }
        };
        preloadMermaid();
    }, []);

    useEffect(() => {
        if (!workingModel) return;

        const onMouseMove = (event: MouseEvent) => {
            if (draggingNode) {
                const dx = (event.clientX - draggingNode.startMouseX) / viewport.scale;
                const dy = (event.clientY - draggingNode.startMouseY) / viewport.scale;
                setPositions((prev) => ({
                    ...prev,
                    [draggingNode.tableId]: {
                        x: draggingNode.originX + dx,
                        y: draggingNode.originY + dy,
                    },
                }));
                return;
            }

            if (panning) {
                setViewport((prev) => ({
                    ...prev,
                    x: panning.originX + (event.clientX - panning.startX),
                    y: panning.originY + (event.clientY - panning.startY),
                }));
            }
        };

        const onMouseUp = () => {
            setDraggingNode(null);
            setPanning(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [draggingNode, panning, viewport.scale, positions, workingModel]);

    const ensureMermaid = async (): Promise<void> => {
        if (window.mermaid) return;
        const mod = await import('mermaid');
        const mermaid = mod.default ?? (mod as any);
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            themeVariables: {
                primaryColor: '#0e639c',
                primaryTextColor: '#fff',
                primaryBorderColor: '#0a4f7c',
                lineColor: '#0e639c',
                secondaryColor: '#f3f4f6',
                tertiaryColor: '#e5e7eb',
            },
        });
        (window as any).mermaid = mermaid;
    };

    const loadSolutions = async () => {
        try {
            const client = new DataverseClient({
                environmentUrl: connectionUrl,
                accessToken,
            }, isPPTB);
            const solutionList = await client.listSolutions();
            setSolutions(solutionList);
        } catch (err: any) {
            showError(`Failed to load solutions: ${err.message}`);
        }
    };

    const showError = (message: string) => {
        setError(message);
        setTimeout(() => setError(''), ERROR_DISPLAY_DURATION_MS);
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

    const validateLogicalName = (name: string, kind: 'table' | 'attribute') => {
        const trimmed = name.trim();
        if (!trimmed) return `${kind} logical name is required.`;
        if (!/^[a-z][a-z0-9_]*$/i.test(trimmed)) return `${kind} logical name must start with a letter and contain only alphanumeric/underscore.`;
        if (RESERVED_NAMES.has(trimmed.toLowerCase())) return `${kind} logical name '${trimmed}' is reserved.`;
        return '';
    };

    const handleLoadSolution = async () => {
        if (!selectedSolution) {
            showError('Please select a solution first.');
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
            setViewport({ x: 24, y: 24, scale: 1 });
            setSelectedTableId(editorModel.tables[0]?.id || '');
            setRelationshipTarget(editorModel.tables[1]?.id || editorModel.tables[0]?.id || '');
            setRenameTableDisplayName(editorModel.tables[0]?.displayName || '');
            resetHistory();

            if (isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: 'Success',
                    body: 'Interactive ERD loaded.',
                    type: 'success',
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

        const tableLogicalName = newTableLogicalName.trim();
        const tableDisplayName = newTableDisplayName.trim() || tableLogicalName;

        const tableError = validateLogicalName(tableLogicalName, 'table');
        if (tableError) {
            showError(tableError);
            return;
        }

        if (workingModel.tables.some((table) => table.logicalName.toLowerCase() === tableLogicalName.toLowerCase())) {
            showError(`Table logical name '${tableLogicalName}' already exists.`);
            return;
        }

        const primaryId = `${tableLogicalName}id`;
        const primaryName = 'name';
        const tableId = makeId('table');

        const nextModel = cloneModel(workingModel);
        nextModel.tables.push({
            id: tableId,
            logicalName: tableLogicalName,
            displayName: tableDisplayName,
            schemaName: `${workingModel.publisherPrefix}_${tableLogicalName}`,
            primaryIdAttribute: primaryId,
            primaryNameAttribute: primaryName,
            tableType: 'Standard',
            isIntersect: false,
            attributes: [
                {
                    id: makeId('attr'),
                    logicalName: primaryId,
                    displayName: `${tableDisplayName} Identifier`,
                    type: 'guid',
                    isPrimaryId: true,
                    isPrimaryName: false,
                    isRequired: true,
                },
                {
                    id: makeId('attr'),
                    logicalName: primaryName,
                    displayName: `${tableDisplayName} Name`,
                    type: 'string',
                    isPrimaryId: false,
                    isPrimaryName: true,
                    isRequired: true,
                },
            ],
        });

        const layout = mergePositions(positions, generateGridLayout(nextModel));
        applyModelChange(nextModel, layout);
        setNewTableLogicalName('');
        setNewTableDisplayName('');
        setSelectedTableId(tableId);
    };

    const handleRenameTable = () => {
        if (!workingModel || !selectedTable) return;
        const nextDisplayName = renameTableDisplayName.trim();
        if (!nextDisplayName) {
            showError('Table display name cannot be empty.');
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
        const logical = newAttributeLogicalName.trim();
        const display = newAttributeDisplayName.trim() || logical;

        const attrError = validateLogicalName(logical, 'attribute');
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

        table.attributes.push({
            id: makeId('attr'),
            logicalName: logical,
            displayName: display,
            type: newAttributeType,
            isPrimaryId: false,
            isPrimaryName: false,
            isRequired: false,
        });

        applyModelChange(nextModel);
        setNewAttributeLogicalName('');
        setNewAttributeDisplayName('');
    };

    const handleRenameAttribute = (attributeId: string, displayName: string) => {
        if (!workingModel || !selectedTable) return;
        const nextName = displayName.trim();
        if (!nextName) {
            showError('Attribute display name cannot be empty.');
            return;
        }

        const nextModel = cloneModel(workingModel);
        const table = nextModel.tables.find((t) => t.id === selectedTable.id);
        if (!table) return;

        const attribute = table.attributes.find((a) => a.id === attributeId);
        if (!attribute) return;
        attribute.displayName = nextName;

        applyModelChange(nextModel);
    };

    const handleAddRelationship = () => {
        if (!workingModel || !selectedTable) return;
        if (!relationshipTarget) {
            showError('Please choose a target table for the relationship.');
            return;
        }

        // Deliberate editor UX constraint: self-links for 1:N and N:1 are hidden to avoid overlapping edge UX.
        if (relationshipTarget === selectedTable.id && relationshipType !== 'ManyToMany') {
            showError('Self-relationship is allowed only for Many-to-Many in this editor.');
            return;
        }

        const schemaName = relationshipName.trim();
        if (!schemaName) {
            showError('Relationship schema name is required.');
            return;
        }

        const duplicate = workingModel.relationships.some(
            (relationship) =>
                relationship.schemaName.toLowerCase() === schemaName.toLowerCase() &&
                relationship.fromTableId === selectedTable.id &&
                relationship.toTableId === relationshipTarget,
        );

        if (duplicate) {
            showError(`Relationship '${schemaName}' already exists between selected tables.`);
            return;
        }

        const nextModel = cloneModel(workingModel);
        const targetTable = nextModel.tables.find((table) => table.id === relationshipTarget);
        nextModel.relationships.push({
            id: makeId('rel'),
            schemaName,
            type: relationshipType,
            fromTableId: selectedTable.id,
            toTableId: relationshipTarget,
            lookupAttribute: relationshipType === 'ManyToMany' ? undefined : targetTable?.primaryIdAttribute || `${selectedTable.logicalName}id`,
            intersectTable: relationshipType === 'ManyToMany' ? `${selectedTable.logicalName}_${schemaName}` : undefined,
        });
        applyModelChange(nextModel);
        setRelationshipName('');
    };

    const handlePublishRequest = () => {
        if (changeCount === 0) {
            showError('No changes to publish.');
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
            const lines = result.results.map((item) => `${item.success ? '✅' : '❌'} ${item.name}: ${item.message}`);
            setPublishResult({ success: result.success, lines });

            if (result.success) {
                const refreshed = await client.fetchSolution(selectedSolution);
                const refreshedModel = toEditorModel(refreshed);
                setBaselineModel(refreshedModel);
                setWorkingModel(cloneModel(refreshedModel));
                setPositions(mergePositions(positions, generateGridLayout(refreshedModel)));
                resetHistory();
            }
        } catch (err: any) {
            showError(`Publish failed: ${err.message}`);
        } finally {
            setPublishing(false);
        }
    };

    const fitGraphToView = () => {
        if (!workingModel || !graphContainerRef.current) return;

        const bounds = getBounds(workingModel, positions);
        const width = graphContainerRef.current.clientWidth;
        const height = graphContainerRef.current.clientHeight;
        const scaleX = (width - 80) / Math.max(1, bounds.width);
        const scaleY = (height - 80) / Math.max(1, bounds.height);
        const scale = Math.max(0.3, Math.min(1.4, Math.min(scaleX, scaleY)));

        const centerX = bounds.minX + bounds.width / 2;
        const centerY = bounds.minY + bounds.height / 2;

        setViewport({
            scale,
            x: width / 2 - centerX * scale,
            y: height / 2 - centerY * scale,
        });
    };

    const handleResetView = () => setViewport({ x: 24, y: 24, scale: 1 });

    const handleAutoLayout = () => {
        if (!workingModel) return;
        const nextPositions = mergePositions(positions, generateGridLayout(workingModel));
        setPositions(nextPositions);
        setViewport({ x: 24, y: 24, scale: 1 });
    };

    const handleDownload = async () => {
        const currentDiagram = generatedDiagrams[selectedFormat];
        if (!currentDiagram) return;

        const extensions: Record<OutputFormat, string> = {
            mermaid: 'mmd',
            plantuml: 'puml',
            drawio: 'drawio',
        };

        const sourceSuffix = exportSource === 'baseline' ? 'baseline' : exportChangedOnly ? 'changed' : 'working';
        const fileName = `${selectedSolution}-erd-${sourceSuffix}.${extensions[selectedFormat]}`;

        try {
            if (isPPTB) {
                const savedPath = await window.toolboxAPI.utils.saveFile(fileName, currentDiagram);
                if (savedPath) {
                    await window.toolboxAPI.utils.showNotification({
                        title: 'Success',
                        body: 'File saved successfully.',
                        type: 'success',
                    });
                }
            }
        } catch (err: any) {
            showError(`Failed to save file: ${err.message}`);
        }
    };

    const handleCopyToClipboard = async () => {
        const currentDiagram = generatedDiagrams[selectedFormat];
        if (!currentDiagram) return;

        try {
            if (isPPTB) {
                await window.toolboxAPI.utils.copyToClipboard(currentDiagram);
                await window.toolboxAPI.utils.showNotification({
                    title: 'Success',
                    body: 'Copied to clipboard.',
                    type: 'success',
                });
            }
        } catch (err: any) {
            showError(`Failed to copy: ${err.message}`);
        }
    };

    const renderPreview = () => {
        const currentDiagram = generatedDiagrams[selectedFormat];
        if (!currentDiagram) return <div className="loading-mermaid">No diagram generated yet.</div>;

        if (previewMode === 'text') {
            return <pre className="diagram-text">{currentDiagram}</pre>;
        }

        if (selectedFormat === 'mermaid') {
            if (!mermaidReady) return <div className="loading-mermaid">Loading mermaid renderer...</div>;
            return (
                <div
                    className="mermaid"
                    ref={(el) => {
                        (async () => {
                            if (!el) return;
                            try {
                                el.removeAttribute('data-processed');
                                el.textContent = currentDiagram;
                                await ensureMermaid();
                                if (window.mermaid) {
                                    await window.mermaid.init(undefined, el);
                                }
                            } catch (err) {
                                console.error('Mermaid render error', err);
                            }
                        })();
                    }}
                />
            );
        }

        if (selectedFormat === 'plantuml') {
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
                                const doc = parser.parseFromString(svgText, 'image/svg+xml');
                                const svg = doc.querySelector('svg');
                                if (!svg) throw new Error('No SVG returned from PlantUML.');
                                svg.querySelectorAll('script').forEach((node) => node.remove());
                                svg.querySelectorAll('*').forEach((node) => {
                                    Array.from(node.attributes).forEach((attr) => {
                                        if (attr.name.toLowerCase().startsWith('on')) {
                                            node.removeAttribute(attr.name);
                                        }
                                    });
                                });
                                el.innerHTML = '';
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
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '100%';
                    iframe.style.height = '600px';
                    iframe.style.border = '1px solid var(--border-color)';
                    iframe.style.borderRadius = '6px';
                    iframe.src = `https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=ERD#R${encodeURIComponent(currentDiagram)}`;
                    el.innerHTML = '';
                    el.appendChild(iframe);
                }}
            />
        );
    };

    const renderGraph = () => {
        if (!workingModel) {
            return <div className="loading-mermaid">Load a solution to start graph editing.</div>;
        }

        const tableById = new Map(workingModel.tables.map((table) => [table.id, table]));
        const bounds = getBounds(workingModel, positions);
        const minimapScale = 0.12;

        const visibleTables = workingModel.tables.filter((table) => visibleTableIds.has(table.id));
        const visibleTableIdSet = new Set(visibleTables.map((table) => table.id));
        const visibleRelationships = includeRelationships
            ? workingModel.relationships.filter((rel) => visibleTableIdSet.has(rel.fromTableId) && visibleTableIdSet.has(rel.toTableId))
            : [];

        return (
            <div
                className="graph-canvas"
                ref={graphContainerRef}
                onMouseDown={(event) => {
                    if ((event.target as HTMLElement).closest('.graph-node')) return;
                    setPanning({
                        startX: event.clientX,
                        startY: event.clientY,
                        originX: viewport.x,
                        originY: viewport.y,
                    });
                }}
                onWheel={(event) => {
                    event.preventDefault();
                    const nextScale = Math.min(2, Math.max(0.3, viewport.scale + (event.deltaY > 0 ? -0.08 : 0.08)));
                    const rect = graphContainerRef.current?.getBoundingClientRect();
                    if (!rect) return;

                    const mouseX = event.clientX - rect.left;
                    const mouseY = event.clientY - rect.top;
                    const worldX = (mouseX - viewport.x) / viewport.scale;
                    const worldY = (mouseY - viewport.y) / viewport.scale;

                    setViewport({
                        scale: nextScale,
                        x: mouseX - worldX * nextScale,
                        y: mouseY - worldY * nextScale,
                    });
                }}
            >
                <div className="graph-transform" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}>
                    <svg className="graph-edges" width={Math.max(1600, bounds.maxX + 400)} height={Math.max(1200, bounds.maxY + 400)}>
                        {visibleRelationships.map((relationship) => {
                            const source = positions[relationship.fromTableId];
                            const target = positions[relationship.toTableId];
                            const sourceTable = tableById.get(relationship.fromTableId);
                            const targetTable = tableById.get(relationship.toTableId);
                            if (!source || !target || !sourceTable || !targetTable) return null;

                            const sourceY = source.y + 55;
                            const targetY = target.y + 55;
                            const x1 = source.x + nodeWidth;
                            const y1 = sourceY;
                            const x2 = target.x;
                            const y2 = targetY;
                            const controlOffset = Math.max(80, Math.abs(x2 - x1) * 0.33);
                            const path = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
                            const isNew = diff?.newRelationshipIds.has(relationship.id);

                            return (
                                <g key={relationship.id}>
                                    <path d={path} className={`graph-edge ${isNew ? 'is-new' : ''}`} />
                                    <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} className="graph-edge-label">
                                        {relationship.schemaName}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {visibleTables.map((table) => {
                        const tablePosition = positions[table.id] || { x: 24, y: 24 };
                        const isSelected = selectedTableId === table.id;
                        const isNewTable = !!diff?.newTableIds.has(table.id);
                        const isRenamed = !!diff?.renamedTableIds.has(table.id);
                        const hasAttributeChanges = table.attributes.some(
                            (attribute) => !!diff && (diff.newAttributeIds.has(attribute.id) || diff.renamedAttributeIds.has(attribute.id)),
                        );
                        const impact = hasAttributeChanges || isNewTable || isRenamed ? getImpactLevel(table.attributes.length) : 'none';

                        return (
                            <div
                                key={table.id}
                                className={`graph-node ${isSelected ? 'is-selected' : ''} ${isNewTable ? 'is-new' : ''} ${isRenamed ? 'is-renamed' : ''}`}
                                style={{ left: tablePosition.x, top: tablePosition.y }}
                                onMouseDown={(event) => {
                                    event.stopPropagation();
                                    setSelectedTableId(table.id);
                                    setRenameTableDisplayName(table.displayName);
                                    if (workingModel) {
                                        pushSnapshot(workingModel, positions);
                                    }
                                    setDraggingNode({
                                        tableId: table.id,
                                        startMouseX: event.clientX,
                                        startMouseY: event.clientY,
                                        originX: tablePosition.x,
                                        originY: tablePosition.y,
                                    });
                                }}
                            >
                                <div className="graph-node-header">
                                    <div>
                                        <strong>{table.displayName}</strong>
                                        <div className="muted-text">{table.logicalName}</div>
                                    </div>
                                    <div className="node-badges">
                                        {isNewTable && <span className="badge badge-new">New</span>}
                                        {isRenamed && <span className="badge badge-renamed">Renamed</span>}
                                        {showImpactMarkers && impact !== 'none' && <span className={`badge badge-impact-${impact}`}>{impact}</span>}
                                    </div>
                                </div>
                                <div className="graph-node-attrs">
                                    {table.attributes.slice(0, GRAPH_NODE_MAX_VISIBLE_ATTRIBUTES).map((attribute) => {
                                        const attrNew = !!diff?.newAttributeIds.has(attribute.id);
                                        const attrRenamed = !!diff?.renamedAttributeIds.has(attribute.id);
                                        return (
                                            <div key={attribute.id} className={`graph-attr ${attrNew ? 'is-new' : ''} ${attrRenamed ? 'is-renamed' : ''}`}>
                                                <span className="graph-attr-name">{attribute.logicalName}</span>
                                                <span className="graph-attr-type">{attribute.type}</span>
                                            </div>
                                        );
                                    })}
                                    {table.attributes.length > GRAPH_NODE_MAX_VISIBLE_ATTRIBUTES && (
                                        <div className="graph-attr-more">+{table.attributes.length - GRAPH_NODE_MAX_VISIBLE_ATTRIBUTES} more</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="graph-minimap">
                    <div className="graph-minimap-stage" style={{ width: Math.max(220, bounds.width * minimapScale), height: Math.max(130, bounds.height * minimapScale) }}>
                        {visibleTables.map((table) => {
                            const position = positions[table.id];
                            if (!position) return null;
                            return (
                                <div
                                    key={table.id}
                                    className={`graph-minimap-node ${selectedTableId === table.id ? 'is-selected' : ''}`}
                                    style={{
                                        left: (position.x - bounds.minX) * minimapScale,
                                        top: (position.y - bounds.minY) * minimapScale,
                                        width: nodeWidth * minimapScale,
                                        height: 42 * minimapScale,
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
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
            {error && <div className="error">{error}</div>}

            <div className="main-content">
                <div className="controls-panel">
                    <div className="form-group">
                        <label htmlFor="solutionSelect">Solution</label>
                        <select id="solutionSelect" value={selectedSolution} onChange={(event) => setSelectedSolution(event.target.value)} disabled={solutions.length === 0}>
                            <option value="">Select a solution</option>
                            {solutions.map((solution) => (
                                <option key={solution.uniqueName} value={solution.uniqueName}>
                                    {solution.displayName} ({solution.version})
                                </option>
                            ))}
                        </select>
                        <button className="btn btn-primary" onClick={handleLoadSolution} disabled={!selectedSolution || loading}>
                            Load Interactive ERD
                        </button>
                    </div>

                    {workingModel && (
                        <>
                            <div className="form-group card-panel">
                                <div className="panel-row">
                                    <strong>Unsaved changes</strong>
                                    <span className={`change-pill ${changeCount > 0 ? 'has-changes' : ''}`}>{changeCount}</span>
                                </div>
                                <div className="panel-row">
                                    <button className="btn btn-secondary" onClick={handleUndo} disabled={historyPast.length === 0}>
                                        Undo
                                    </button>
                                    <button className="btn btn-secondary" onClick={handleRedo} disabled={historyFuture.length === 0}>
                                        Redo
                                    </button>
                                    <button className="btn btn-secondary" onClick={handlePublishRequest} disabled={publishing || changeCount === 0}>
                                        {publishing ? 'Publishing...' : 'Publish to Dataverse'}
                                    </button>
                                </div>
                                {publishResult && (
                                    <div className={`publish-result ${publishResult.success ? 'is-success' : 'is-error'}`}>
                                        {publishResult.lines.map((line, index) => (
                                            <div key={`${line}-${index}`}>{line}</div>
                                        ))}
                                        {!publishResult.success && <div className="muted-text">Some operations failed. Review errors and re-run publish.</div>}
                                    </div>
                                )}
                            </div>

                            <div className="form-group card-panel">
                                <label>Graph controls</label>
                                <div className="panel-row">
                                    <button className="btn btn-secondary" onClick={fitGraphToView}>Fit</button>
                                    <button className="btn btn-secondary" onClick={handleResetView}>Reset</button>
                                    <button className="btn btn-secondary" onClick={handleAutoLayout}>Auto-layout</button>
                                </div>
                                <label className="option-item">
                                    <input type="checkbox" checked={showChangedOnlyInGraph} onChange={(event) => setShowChangedOnlyInGraph(event.target.checked)} />
                                    <span>Show changed only</span>
                                </label>
                                <label className="option-item">
                                    <input type="checkbox" checked={showImpactMarkers} onChange={(event) => setShowImpactMarkers(event.target.checked)} />
                                    <span>Show impact markers</span>
                                </label>
                                <div className="legend-grid">
                                    <span><i className="legend-swatch new" /> New table/attribute</span>
                                    <span><i className="legend-swatch renamed" /> Renamed</span>
                                    <span><i className="legend-swatch rel" /> New relationship</span>
                                </div>
                            </div>

                            <div className="form-group card-panel">
                                <label>Add table</label>
                                <input value={newTableLogicalName} onChange={(event) => setNewTableLogicalName(event.target.value)} placeholder="logical_name" />
                                <input value={newTableDisplayName} onChange={(event) => setNewTableDisplayName(event.target.value)} placeholder="Display Name" />
                                <button className="btn btn-secondary" onClick={handleAddTable}>Add table</button>
                            </div>

                            <div className="form-group card-panel">
                                <label htmlFor="tableEditorSelect">Edit table</label>
                                <select
                                    id="tableEditorSelect"
                                    value={selectedTableId}
                                    onChange={(event) => {
                                        setSelectedTableId(event.target.value);
                                        const table = workingModel.tables.find((t) => t.id === event.target.value);
                                        setRenameTableDisplayName(table?.displayName || '');
                                    }}
                                >
                                    {workingModel.tables.map((table) => (
                                        <option key={table.id} value={table.id}>
                                            {table.displayName}
                                        </option>
                                    ))}
                                </select>

                                {selectedTable && (
                                    <>
                                        <input value={renameTableDisplayName} onChange={(event) => setRenameTableDisplayName(event.target.value)} placeholder="Table display name" />
                                        <button className="btn btn-secondary" onClick={handleRenameTable}>Rename table</button>

                                        <label>Add attribute</label>
                                        <input value={newAttributeLogicalName} onChange={(event) => setNewAttributeLogicalName(event.target.value)} placeholder="attribute_logical_name" />
                                        <input value={newAttributeDisplayName} onChange={(event) => setNewAttributeDisplayName(event.target.value)} placeholder="Attribute display name" />
                                        <select value={newAttributeType} onChange={(event) => setNewAttributeType(event.target.value)}>
                                            <option value="string">string</option>
                                            <option value="int">int</option>
                                            <option value="decimal">decimal</option>
                                            <option value="datetime">datetime</option>
                                            <option value="boolean">boolean</option>
                                            <option value="lookup">lookup</option>
                                        </select>
                                        <button className="btn btn-secondary" onClick={handleAddAttribute}>Add attribute</button>

                                        <label>Rename attributes</label>
                                        <div className="attribute-list">
                                            {selectedTable.attributes.map((attribute) => (
                                                <div className="attribute-item" key={attribute.id}>
                                                    <div className="muted-text">{attribute.logicalName}</div>
                                                    <input
                                                        value={attributeRenameDrafts[attribute.id] ?? attribute.displayName}
                                                        onChange={(event) =>
                                                            setAttributeRenameDrafts((prev) => ({ ...prev, [attribute.id]: event.target.value }))
                                                        }
                                                    />
                                                    <button
                                                        className="btn btn-tertiary"
                                                        onClick={() => handleRenameAttribute(attribute.id, attributeRenameDrafts[attribute.id] ?? attribute.displayName)}
                                                    >
                                                        Save
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <label>Add relationship</label>
                                        <input value={relationshipName} onChange={(event) => setRelationshipName(event.target.value)} placeholder="relationship_schema_name" />
                                        <select value={relationshipTarget} onChange={(event) => setRelationshipTarget(event.target.value)}>
                                            {workingModel.tables
                                                .filter((table) => table.id !== selectedTable.id)
                                                .map((table) => (
                                                    <option key={table.id} value={table.id}>
                                                        {table.displayName}
                                                    </option>
                                                ))}
                                        </select>
                                        <select value={relationshipType} onChange={(event) => setRelationshipType(event.target.value as 'OneToMany' | 'ManyToOne' | 'ManyToMany')}>
                                            <option value="ManyToOne">ManyToOne</option>
                                            <option value="OneToMany">OneToMany</option>
                                            <option value="ManyToMany">ManyToMany</option>
                                        </select>
                                        <button className="btn btn-secondary" onClick={handleAddRelationship}>Add relationship</button>
                                    </>
                                )}
                            </div>

                            <div className="form-group card-panel">
                                <label>Export source</label>
                                <div className="panel-row">
                                    <button className={`format-btn ${exportSource === 'working' ? 'active' : ''}`} onClick={() => setExportSource('working')}>Working</button>
                                    <button className={`format-btn ${exportSource === 'baseline' ? 'active' : ''}`} onClick={() => setExportSource('baseline')}>Baseline</button>
                                </div>
                                <label className="option-item">
                                    <input
                                        type="checkbox"
                                        checked={exportChangedOnly}
                                        disabled={exportSource !== 'working'}
                                        onChange={(event) => setExportChangedOnly(event.target.checked)}
                                    />
                                    <span>Export changed only</span>
                                </label>

                                <label>Format</label>
                                <div className="format-selector">
                                    <button className={`format-btn ${selectedFormat === 'mermaid' ? 'active' : ''}`} onClick={() => setSelectedFormat('mermaid')}>Mermaid</button>
                                    <button className={`format-btn ${selectedFormat === 'plantuml' ? 'active' : ''}`} onClick={() => setSelectedFormat('plantuml')}>PlantUML</button>
                                    <button className={`format-btn ${selectedFormat === 'drawio' ? 'active' : ''}`} onClick={() => setSelectedFormat('drawio')}>Draw.io</button>
                                </div>

                                <label className="option-item">
                                    <input type="checkbox" checked={includeAttributes} onChange={(event) => setIncludeAttributes(event.target.checked)} />
                                    <span>Include attributes</span>
                                </label>
                                <label className="option-item">
                                    <input type="checkbox" checked={includeRelationships} onChange={(event) => setIncludeRelationships(event.target.checked)} />
                                    <span>Include relationships</span>
                                </label>

                                <div className="option-item">
                                    <label htmlFor="maxAttributesInput" className="inline-label">Max attributes:</label>
                                    <input
                                        id="maxAttributesInput"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={maxAttributesPerTable}
                                        onChange={(event) => {
                                            const parsed = Number.parseInt(event.target.value, 10);
                                            if (!Number.isNaN(parsed) && parsed >= 0) {
                                                setMaxAttributesPerTable(parsed);
                                            }
                                        }}
                                        className="number-input"
                                    />
                                </div>

                                <div className="panel-row">
                                    <button className="btn btn-secondary" onClick={handleDownload}>Download</button>
                                    <button className="btn btn-secondary" onClick={handleCopyToClipboard}>Copy</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="diagram-panel">
                    <div className="diagram-mode-tabs">
                        <button className={`format-btn ${viewMode === 'interactive' ? 'active' : ''}`} onClick={() => setViewMode('interactive')}>
                            Interactive Graph (Default)
                        </button>
                        <button className={`format-btn ${viewMode === 'preview' ? 'active' : ''}`} onClick={() => setViewMode('preview')}>
                            Export Preview
                        </button>
                        {viewMode === 'preview' && (
                            <div className="preview-toggle">
                                <button className={`btn btn-secondary ${previewMode === 'visual' ? 'active' : ''}`} onClick={() => setPreviewMode('visual')}>Visual</button>
                                <button className={`btn btn-secondary ${previewMode === 'text' ? 'active' : ''}`} onClick={() => setPreviewMode('text')}>Text</button>
                            </div>
                        )}
                    </div>
                    <div className="diagram-container">
                        {viewMode === 'interactive' ? renderGraph() : renderPreview()}
                    </div>
                </div>
            </div>

            {showPublishConfirm && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <h3>Publish changes</h3>
                        <p>Publish {changeCount} change(s) to Dataverse now?</p>
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
        </div>
    );
}

export default App;
