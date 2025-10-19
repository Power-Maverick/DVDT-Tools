import { useEffect, useState } from "react";
import { DataverseClient } from "../src/utils/DataverseClient";
import { ERDGenerator } from "../src/components/ERDGenerator";
import { DataverseSolution } from "../src/models/interfaces";

// Declare the APIs available on window
declare global {
    interface Window {
        // PPTB (Power Platform Toolbox) API
        toolboxAPI?: {
            getToolContext: () => Promise<{ connectionUrl: string; accessToken: string }>;
            showNotification: (options: { title: string; body: string; type: string }) => Promise<void>;
            onToolboxEvent: (callback: (event: string, payload: unknown) => void) => void;
            getConnections: () => Promise<Array<{ id: string; name: string; url: string }>>;
            getActiveConnection: () => Promise<{ id: string; name: string; url: string } | null>;
        };
        TOOLBOX_CONTEXT?: { toolId: string | null; connectionUrl: string | null; accessToken: string | null };
        
        // DVDT (VS Code) API
        acquireVsCodeApi?: () => {
            postMessage: (message: any) => void;
        };
        
        // Mermaid library (loaded externally for visualization)
        mermaid?: {
            initialize: (config: any) => void;
            init: (config: any, element: HTMLElement | null) => void;
        };
    }
}

interface Solution {
    uniqueName: string;
    displayName: string;
    version: string;
}

function App() {
    const [isVSCode, setIsVSCode] = useState<boolean>(false);
    const [isPPTB, setIsPPTB] = useState<boolean>(false);
    const [connectionUrl, setConnectionUrl] = useState<string>("");
    const [accessToken, setAccessToken] = useState<string>("");
    const [solutions, setSolutions] = useState<Solution[]>([]);
    const [selectedSolution, setSelectedSolution] = useState<string>("");
    const [selectedFormat, setSelectedFormat] = useState<'mermaid' | 'plantuml' | 'graphviz'>('mermaid');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [generatedDiagram, setGeneratedDiagram] = useState<string>("");
    const [viewMode, setViewMode] = useState<'visual' | 'text'>('visual');
    
    // Configuration options
    const [includeAttributes, setIncludeAttributes] = useState<boolean>(true);
    const [includeRelationships, setIncludeRelationships] = useState<boolean>(true);
    const [maxAttributesPerTable, setMaxAttributesPerTable] = useState<number>(10);

    // Detect environment and initialize
    useEffect(() => {
        const initializeEnvironment = async () => {
            // Check if we're in VS Code (DVDT)
            if (typeof window.acquireVsCodeApi !== 'undefined') {
                setIsVSCode(true);
                setLoading(true);
                
                // Listen for credentials from DVDT
                const handleMessage = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === 'setCredentials') {
                        setConnectionUrl(message.environmentUrl);
                        setAccessToken(message.accessToken);
                        setLoading(false);
                    }
                };
                window.addEventListener('message', handleMessage);
                
                return () => {
                    window.removeEventListener('message', handleMessage);
                };
            }
            // Check if we're in PPTB
            else if (window.toolboxAPI) {
                setIsPPTB(true);
                
                // Listen for TOOLBOX_CONTEXT from parent window
                const handleMessage = (event: MessageEvent) => {
                    if (event.data && event.data.type === 'TOOLBOX_CONTEXT') {
                        window.TOOLBOX_CONTEXT = event.data.data;
                        const ctx = event.data.data;
                        if (ctx.connectionUrl && ctx.accessToken) {
                            setConnectionUrl(ctx.connectionUrl);
                            setAccessToken(ctx.accessToken);
                        }
                    }
                };
                window.addEventListener('message', handleMessage);
                
                try {
                    // Try to get context from API
                    const context = await window.toolboxAPI.getToolContext();
                    setConnectionUrl(context.connectionUrl);
                    setAccessToken(context.accessToken);
                } catch (error) {
                    console.error('Failed to get tool context:', error);
                }
                
                setLoading(false);
                
                return () => {
                    window.removeEventListener('message', handleMessage);
                };
            } else {
                // Standalone mode - show error
                setError('Not running in supported environment (DVDT or PPTB)');
                setLoading(false);
            }
        };

        initializeEnvironment();
    }, []);

    // Load solutions when credentials are available
    useEffect(() => {
        if (connectionUrl && accessToken) {
            loadSolutions();
        }
    }, [connectionUrl, accessToken]);

    const loadSolutions = async () => {
        try {
            const client = new DataverseClient({
                environmentUrl: connectionUrl,
                accessToken: accessToken
            });
            
            const solutionList = await client.listSolutions();
            setSolutions(solutionList);
        } catch (error: any) {
            showError(`Failed to load solutions: ${error.message}`);
        }
    };

    const showError = (message: string) => {
        setError(message);
        setTimeout(() => setError(""), 5000);
    };

    const showNotification = async (title: string, body: string, type: 'success' | 'error' | 'info') => {
        if (isPPTB && window.toolboxAPI) {
            await window.toolboxAPI.showNotification({ title, body, type });
        }
        // For DVDT, notifications are handled differently (through VS Code API on host side)
    };

    const handleGenerateERD = async () => {
        if (!selectedSolution) {
            showError('Please select a solution first');
            return;
        }

        try {
            setLoading(true);
            
            const client = new DataverseClient({
                environmentUrl: connectionUrl,
                accessToken: accessToken
            });

            const solution: DataverseSolution = await client.fetchSolution(selectedSolution);
            
            const generator = new ERDGenerator({
                format: selectedFormat,
                includeAttributes,
                includeRelationships,
                maxAttributesPerTable
            });

            const diagram = generator.generate(solution);
            setGeneratedDiagram(diagram);
            
            await showNotification('Success', 'ERD generated successfully', 'success');
        } catch (error: any) {
            showError(`Failed to generate ERD: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!generatedDiagram) return;

        const extensions: Record<string, string> = {
            'mermaid': 'mmd',
            'plantuml': 'puml',
            'graphviz': 'dot'
        };

        if (isVSCode) {
            // Send message to VS Code extension to handle file save
            const vscode = window.acquireVsCodeApi!();
            vscode.postMessage({
                command: 'saveFile',
                content: generatedDiagram,
                fileName: `${selectedSolution}-erd.${extensions[selectedFormat]}`
            });
        } else {
            // In PPTB, trigger browser download
            const blob = new Blob([generatedDiagram], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedSolution}-erd.${extensions[selectedFormat]}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const handleCopyToClipboard = async () => {
        if (!generatedDiagram) return;

        try {
            if (isVSCode) {
                // Send message to VS Code extension
                const vscode = window.acquireVsCodeApi!();
                vscode.postMessage({
                    command: 'copyToClipboard',
                    content: generatedDiagram
                });
            } else {
                // In PPTB, use browser clipboard API
                await navigator.clipboard.writeText(generatedDiagram);
                await showNotification('Success', 'Copied to clipboard', 'success');
            }
        } catch (error: any) {
            showError(`Failed to copy: ${error.message}`);
        }
    };

    const renderDiagram = () => {
        if (!generatedDiagram) return null;

        if (viewMode === 'visual' && selectedFormat === 'mermaid') {
            // Render Mermaid diagram
            return (
                <div 
                    className="mermaid-container"
                    dangerouslySetInnerHTML={{ __html: generatedDiagram }}
                    ref={(el) => {
                        if (el && window.mermaid) {
                            try {
                                window.mermaid.init(undefined, el);
                            } catch (error) {
                                console.error('Mermaid rendering error:', error);
                            }
                        }
                    }}
                />
            );
        } else {
            // Show text view
            return (
                <pre className="diagram-text">
                    {generatedDiagram}
                </pre>
            );
        }
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
            <header className="header">
                <h1>🗺️ Dataverse ERD Generator</h1>
                <p>Generate Entity Relationship Diagrams from your Dataverse solutions</p>
            </header>

            {error && (
                <div className="error">
                    {error}
                </div>
            )}

            <div className="card">
                <div className="info-message">
                    <strong>✓ Connected to Dataverse</strong><br />
                    Environment: <span>{connectionUrl || "Not connected"}</span>
                </div>

                <div className="form-group">
                    <label htmlFor="solutionSelect">Select a Solution</label>
                    <select 
                        id="solutionSelect" 
                        value={selectedSolution}
                        onChange={(e) => setSelectedSolution(e.target.value)}
                        disabled={solutions.length === 0}
                    >
                        <option value="">-- Select a Solution --</option>
                        {solutions.map((solution) => (
                            <option key={solution.uniqueName} value={solution.uniqueName}>
                                {solution.displayName} ({solution.version})
                            </option>
                        ))}
                    </select>
                </div>

                <div className="generate-section">
                    <h2>Generate ERD</h2>
                    <div className="format-selector">
                        <label style={{ fontWeight: 600, marginRight: '10px' }}>Output Format:</label>
                        <button 
                            className={`format-btn ${selectedFormat === 'mermaid' ? 'active' : ''}`}
                            onClick={() => setSelectedFormat('mermaid')}
                        >
                            Mermaid
                        </button>
                        <button 
                            className={`format-btn ${selectedFormat === 'plantuml' ? 'active' : ''}`}
                            onClick={() => setSelectedFormat('plantuml')}
                        >
                            PlantUML
                        </button>
                        <button 
                            className={`format-btn ${selectedFormat === 'graphviz' ? 'active' : ''}`}
                            onClick={() => setSelectedFormat('graphviz')}
                        >
                            Graphviz
                        </button>
                    </div>

                    <div className="config-section">
                        <h3>Configuration</h3>
                        
                        <div className="config-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={includeAttributes}
                                    onChange={(e) => setIncludeAttributes(e.target.checked)}
                                />
                                <span>Include Attributes</span>
                            </label>
                            <div className="config-help">Show table columns/fields in the diagram</div>
                        </div>

                        <div className="config-group">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={includeRelationships}
                                    onChange={(e) => setIncludeRelationships(e.target.checked)}
                                />
                                <span>Include Relationships</span>
                            </label>
                            <div className="config-help">Show relationships between tables</div>
                        </div>

                        <div className="config-group">
                            <div className="config-label-group">
                                <label htmlFor="maxAttributesInput">Max Attributes per Table:</label>
                                <input 
                                    type="number" 
                                    id="maxAttributesInput"
                                    value={maxAttributesPerTable}
                                    onChange={(e) => setMaxAttributesPerTable(parseInt(e.target.value) || 0)}
                                    min="0" 
                                    max="100"
                                />
                            </div>
                            <div className="config-help">Maximum number of attributes to display per table (0 = show all)</div>
                        </div>
                    </div>

                    <button 
                        className="btn btn-primary" 
                        onClick={handleGenerateERD}
                        disabled={!selectedSolution || loading}
                    >
                        Generate ERD
                    </button>
                </div>
            </div>

            {generatedDiagram && (
                <div className="card">
                    <h2>Generated ERD</h2>
                    <div className="diagram-controls">
                        {selectedFormat === 'mermaid' && (
                            <button 
                                className="btn btn-secondary"
                                onClick={() => setViewMode(viewMode === 'visual' ? 'text' : 'visual')}
                            >
                                {viewMode === 'visual' ? '📝 Show Text' : '🎨 Show Visual'}
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={handleDownload}>
                            📥 Download Source
                        </button>
                        <button className="btn btn-secondary" onClick={handleCopyToClipboard}>
                            📋 Copy to Clipboard
                        </button>
                    </div>
                    <div className="diagram-container">
                        {renderDiagram()}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
