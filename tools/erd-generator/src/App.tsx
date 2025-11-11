import { useEffect, useState } from "react";
import { ERDGenerator } from "./components/ERDGenerator";
import { DataverseSolution } from "./models/interfaces";
import { DataverseClient } from "./utils/DataverseClient";

// Declare the APIs available on window
declare global {
    interface Window {
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
    const [isPPTB, setIsPPTB] = useState<boolean>(false);
    const [connectionUrl, setConnectionUrl] = useState<string>("");
    const [accessToken, setAccessToken] = useState<string>("");
    const [solutions, setSolutions] = useState<Solution[]>([]);
    const [selectedSolution, setSelectedSolution] = useState<string>("");
    const [selectedFormat, setSelectedFormat] = useState<'mermaid' | 'plantuml' | 'drawio'>('mermaid');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");
    const [generatedDiagram, setGeneratedDiagram] = useState<string>("");
    const [viewMode, setViewMode] = useState<'visual' | 'text'>('text');
    const [mermaidReady, setMermaidReady] = useState<boolean>(false);
    
    // Configuration options
    const [includeAttributes, setIncludeAttributes] = useState<boolean>(true);
    const [includeRelationships, setIncludeRelationships] = useState<boolean>(true);
    const [maxAttributesPerTable, setMaxAttributesPerTable] = useState<number>(10);

    // Detect environment and initialize
    useEffect(() => {
        const initializeEnvironment = async () => {
            // Check if we're in VS Code (DVDT)
            if (typeof window.acquireVsCodeApi !== 'undefined') {
                setIsPPTB(false);
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
                
                // Fetch connection details                
                try {
                    // Try to get context from API
                    const activeConnection = await window.toolboxAPI.connections.getActiveConnection();
                    setConnectionUrl(activeConnection?.url || "");
                } catch (error) {
                    console.error('Failed to get tool context:', error);
                }
                
                setLoading(false);
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
        if (connectionUrl) {
            loadSolutions();
        }
    }, [connectionUrl]);

    const loadSolutions = async () => {
        try {
            const client = new DataverseClient({
                environmentUrl: connectionUrl,
                accessToken: accessToken
            }, isPPTB);
            
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
            }, isPPTB);

            const solution: DataverseSolution = await client.fetchSolution(selectedSolution);
            
            const generator = new ERDGenerator({
                format: selectedFormat,
                includeAttributes,
                includeRelationships,
                maxAttributesPerTable
            });

            const diagram = generator.generate(solution);
            setGeneratedDiagram(diagram);
            
            if(isPPTB) {
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "ERD generated successfully",
                    type: "success",
                });
            }
        } catch (error: any) {
            showError(`Failed to generate ERD: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!generatedDiagram) return;

        const extensions: Record<string, string> = {
            'mermaid': 'mmd',
            'plantuml': 'puml',
            'drawio': 'drawio'
        };

        const fileName = `${selectedSolution}-erd.${extensions[selectedFormat]}`;
        
        try {
            if(isPPTB) {
                const savedPath = await window.toolboxAPI.utils.saveFile(fileName, generatedDiagram);
                if (savedPath) {
                    await window.toolboxAPI.utils.showNotification({
                        title: "Success",
                        body: "File saved successfully",
                        type: "success",
                    });
                }
            }
        } catch (error: any) {
            showError(`Failed to save file: ${error.message}`);
        }
    };

    const handleCopyToClipboard = async () => {
        if (!generatedDiagram) return;

        try {
            if(isPPTB) {
                await window.toolboxAPI.utils.copyToClipboard(generatedDiagram);
                await window.toolboxAPI.utils.showNotification({
                    title: "Success",
                    body: "Copied to clipboard",
                    type: "success",
                });
            }
        } catch (error: any) {
            showError(`Failed to copy: ${error.message}`);
        }
    };

    // Ensure mermaid is available and initialized (preload on mount)
    useEffect(() => {
        // Preload mermaid when component mounts to avoid CSS loading issues
        const preloadMermaid = async () => {
            try {
                await ensureMermaid();
                setMermaidReady(true);
            } catch (error) {
                console.error('Failed to preload mermaid:', error);
            }
        };
        preloadMermaid();
    }, []);

    const ensureMermaid = async (): Promise<void> => {
        if (window.mermaid) {
            return;
        }
        const mod = await import('mermaid');
        const mermaid = mod.default ?? (mod as any);
        // Initialize once
        mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            themeVariables: {
                primaryColor: '#0e639c',
                primaryTextColor: '#fff',
                primaryBorderColor: '#0a4f7c',
                lineColor: '#0e639c',
                secondaryColor: '#f3f4f6',
                tertiaryColor: '#e5e7eb'
            }
        });
        (window as any).mermaid = mermaid;
    };

    // Render the diagram (visual or text)
    const renderDiagram = () => {
        if (!generatedDiagram) return null;

        if (viewMode === 'visual') {
            if (selectedFormat === 'mermaid') {
                // Show loading message if mermaid isn't ready yet
                if (!mermaidReady) {
                    return (
                        <div className="loading-mermaid">
                            Loading diagram renderer...
                        </div>
                    );
                }

                // Render Mermaid diagram: use 'mermaid' class and set text content for init()
                return (
                    <div
                        className="mermaid"
                        ref={(el) => {
                            (async () => {
                                if (!el) return;
                                try {
                                    // Set the diagram source as text content for Mermaid to parse
                                    el.textContent = generatedDiagram;
                                    await ensureMermaid();
                                    if (window.mermaid) {
                                        window.mermaid.init(undefined, el);
                                    }
                                } catch (error) {
                                    console.error('Mermaid rendering error:', error);
                                }
                            })();
                        }}
                    />
                );
            } else if (selectedFormat === 'plantuml') {
                // Render PlantUML by POSTing source to the public server and inlining the returned SVG.
                // This avoids <img src=...> and respects typical CSP (img-src 'self' data:).
                return (
                    <div
                        className="diagram-visual"
                        ref={(el) => {
                            (async () => {
                                if (!el) return;
                                try {
                                    const resp = await fetch('https://www.plantuml.com/plantuml/svg', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'text/plain' },
                                        body: generatedDiagram,
                                    });
                                    if (!resp.ok) throw new Error(`PlantUML HTTP ${resp.status}`);
                                    const svgText = await resp.text();

                                    const parser = new DOMParser();
                                    const doc = parser.parseFromString(svgText, 'image/svg+xml');
                                    const svg = doc.querySelector('svg');
                                    if (!svg) throw new Error('No <svg> in PlantUML response');

                                    // Remove any script elements for safety
                                    svg.querySelectorAll('script').forEach((s) => s.remove());
                                    // Remove inline event attributes
                                    svg.querySelectorAll('*').forEach((node) => {
                                        Array.from(node.attributes).forEach((attr) => {
                                            if (attr.name.toLowerCase().startsWith('on')) {
                                                node.removeAttribute(attr.name);
                                            }
                                        });
                                    });

                                    el.innerHTML = '';
                                    el.appendChild(svg);
                                } catch (error) {
                                    console.error('PlantUML rendering error:', error);
                                    el.innerHTML = '<div class="loading-mermaid">Cannot render PlantUML due to CSP or network restrictions. Switch to Text view or enable POST to plantuml.com.</div>';
                                }
                            })();
                        }}
                    />
                );
            }
        }

        // Fallback: show text view
        return (
            <pre className="diagram-text">
                {generatedDiagram}
            </pre>
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
                            className={`format-btn ${selectedFormat === 'drawio' ? 'active' : ''}`}
                            onClick={() => setSelectedFormat('drawio')}
                        >
                            Draw.io
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
                        <button 
                            className="btn btn-secondary"
                            onClick={() => setViewMode(viewMode === 'visual' ? 'text' : 'visual')}
                        >
                            {viewMode === 'visual' ? '📝 Show Text' : '🎨 Show Visual'}
                        </button>
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
