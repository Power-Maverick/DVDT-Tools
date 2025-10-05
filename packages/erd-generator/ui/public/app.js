// Import mermaid for diagram rendering
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

// Initialize mermaid
mermaid.initialize({ 
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose'
});

// Global state
let state = {
    client: null,
    solutions: [],
    selectedSolution: null,
    selectedFormat: 'mermaid',
    generatedDiagram: null,
    environmentUrl: null,
    accessToken: null
};

// DOM elements
const elements = {
    connectBtn: document.getElementById('connectBtn'),
    generateBtn: document.getElementById('generateBtn'),
    newDiagramBtn: document.getElementById('newDiagramBtn'),
    downloadImageBtn: document.getElementById('downloadImageBtn'),
    downloadSvgBtn: document.getElementById('downloadSvgBtn'),
    downloadSourceBtn: document.getElementById('downloadSourceBtn'),
    copyBtn: document.getElementById('copyBtn'),
    environmentUrl: document.getElementById('environmentUrl'),
    accessToken: document.getElementById('accessToken'),
    errorMessage: document.getElementById('errorMessage'),
    connectionSection: document.getElementById('connectionSection'),
    solutionsSection: document.getElementById('solutionsSection'),
    generateSection: document.getElementById('generateSection'),
    diagramSection: document.getElementById('diagramSection'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    solutionsList: document.getElementById('solutionsList'),
    diagramContainer: document.getElementById('diagramContainer'),
    step1: document.getElementById('step1'),
    step2: document.getElementById('step2'),
    step3: document.getElementById('step3')
};

// API base URL (will be replaced by the server)
const API_BASE = window.location.origin;

// Helper functions
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.classList.remove('hidden');
    setTimeout(() => {
        elements.errorMessage.classList.add('hidden');
    }, 5000);
}

function updateStep(step) {
    [elements.step1, elements.step2, elements.step3].forEach((s, i) => {
        s.classList.remove('active', 'completed');
        if (i < step - 1) {
            s.classList.add('completed');
        } else if (i === step - 1) {
            s.classList.add('active');
        }
    });
}

// Event: Connect to Dataverse
elements.connectBtn.addEventListener('click', async () => {
    const url = elements.environmentUrl.value.trim();
    const token = elements.accessToken.value.trim();

    if (!url || !token) {
        showError('Please enter both Environment URL and Access Token');
        return;
    }

    try {
        elements.connectBtn.disabled = true;
        elements.connectBtn.textContent = 'Connecting...';
        elements.loadingIndicator.classList.remove('hidden');

        // Call API to list solutions
        const response = await fetch(`${API_BASE}/api/solutions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ environmentUrl: url, accessToken: token })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch solutions');
        }

        state.solutions = await response.json();
        state.environmentUrl = url;
        state.accessToken = token;

        // Display solutions
        displaySolutions(state.solutions);

        // Update UI
        elements.solutionsSection.classList.remove('hidden');
        elements.loadingIndicator.classList.add('hidden');
        updateStep(2);

    } catch (error) {
        showError(`Connection failed: ${error.message}`);
        elements.loadingIndicator.classList.add('hidden');
    } finally {
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = 'Connect & List Solutions';
    }
});

// Display solutions
function displaySolutions(solutions) {
    elements.solutionsList.innerHTML = '';
    
    solutions.forEach(solution => {
        const card = document.createElement('div');
        card.className = 'solution-card';
        card.innerHTML = `
            <h3>${solution.displayName}</h3>
            <p><strong>Unique Name:</strong> ${solution.uniqueName}</p>
            <p><strong>Version:</strong> ${solution.version}</p>
        `;
        
        card.addEventListener('click', () => {
            // Remove previous selection
            document.querySelectorAll('.solution-card').forEach(c => {
                c.classList.remove('selected');
            });
            
            // Mark as selected
            card.classList.add('selected');
            state.selectedSolution = solution.uniqueName;
            
            // Show generate section
            elements.generateSection.classList.remove('hidden');
            updateStep(3);
        });
        
        elements.solutionsList.appendChild(card);
    });
}

// Format selector
document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedFormat = btn.dataset.format;
    });
});

// Event: Generate ERD
elements.generateBtn.addEventListener('click', async () => {
    if (!state.selectedSolution) {
        showError('Please select a solution first');
        return;
    }

    try {
        elements.generateBtn.disabled = true;
        elements.generateBtn.textContent = 'Generating...';

        // Call API to generate ERD
        const response = await fetch(`${API_BASE}/api/generate-erd`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                environmentUrl: state.environmentUrl,
                accessToken: state.accessToken,
                solutionName: state.selectedSolution,
                format: state.selectedFormat
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to generate ERD');
        }

        const data = await response.json();
        state.generatedDiagram = data.diagram;

        // Display diagram
        displayDiagram(state.generatedDiagram, state.selectedFormat);

        // Show diagram section and new diagram button
        elements.diagramSection.classList.remove('hidden');
        elements.newDiagramBtn.classList.remove('hidden');

    } catch (error) {
        showError(`Generation failed: ${error.message}`);
    } finally {
        elements.generateBtn.disabled = false;
        elements.generateBtn.textContent = 'Generate ERD';
    }
});

// Display diagram
async function displayDiagram(diagram, format) {
    elements.diagramContainer.innerHTML = '';

    if (format === 'mermaid') {
        // Render mermaid diagram
        const id = `mermaid-${Date.now()}`;
        const container = document.createElement('div');
        container.className = 'mermaid';
        container.id = id;
        container.textContent = diagram;
        elements.diagramContainer.appendChild(container);

        try {
            await mermaid.run({ nodes: [container] });
        } catch (error) {
            console.error('Mermaid rendering error:', error);
            // Fallback to showing source code
            elements.diagramContainer.innerHTML = `<pre>${diagram}</pre>`;
        }
    } else {
        // For PlantUML and Graphviz, show source code
        elements.diagramContainer.innerHTML = `<pre>${diagram}</pre>`;
    }
}

// Download as PNG
elements.downloadImageBtn.addEventListener('click', async () => {
    try {
        const svgElement = elements.diagramContainer.querySelector('svg');
        if (!svgElement) {
            showError('No diagram to download. Please generate a Mermaid diagram first.');
            return;
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const img = new Image();
        
        // Get SVG dimensions
        const svgRect = svgElement.getBoundingClientRect();
        canvas.width = svgRect.width * 2; // 2x for better quality
        canvas.height = svgRect.height * 2;
        
        img.onload = () => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${state.selectedSolution}-erd.png`;
                a.click();
                URL.revokeObjectURL(url);
            });
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    } catch (error) {
        showError(`Download failed: ${error.message}`);
    }
});

// Download as SVG
elements.downloadSvgBtn.addEventListener('click', () => {
    try {
        const svgElement = elements.diagramContainer.querySelector('svg');
        if (!svgElement) {
            showError('No diagram to download. Please generate a Mermaid diagram first.');
            return;
        }

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.selectedSolution}-erd.svg`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        showError(`Download failed: ${error.message}`);
    }
});

// Download source
elements.downloadSourceBtn.addEventListener('click', () => {
    try {
        if (!state.generatedDiagram) {
            showError('No diagram to download');
            return;
        }

        const extensions = {
            'mermaid': 'mmd',
            'plantuml': 'puml',
            'graphviz': 'dot'
        };

        const blob = new Blob([state.generatedDiagram], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.selectedSolution}-erd.${extensions[state.selectedFormat]}`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        showError(`Download failed: ${error.message}`);
    }
});

// Copy to clipboard
elements.copyBtn.addEventListener('click', async () => {
    try {
        if (!state.generatedDiagram) {
            showError('No diagram to copy');
            return;
        }

        await navigator.clipboard.writeText(state.generatedDiagram);
        
        const originalText = elements.copyBtn.textContent;
        elements.copyBtn.textContent = '✓ Copied!';
        setTimeout(() => {
            elements.copyBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        showError(`Copy failed: ${error.message}`);
    }
});

// New diagram
elements.newDiagramBtn.addEventListener('click', () => {
    // Reset selection
    document.querySelectorAll('.solution-card').forEach(c => {
        c.classList.remove('selected');
    });
    
    state.selectedSolution = null;
    state.generatedDiagram = null;
    
    elements.generateSection.classList.add('hidden');
    elements.diagramSection.classList.add('hidden');
    elements.newDiagramBtn.classList.add('hidden');
    
    updateStep(2);
});

console.log('ERD Generator UI loaded');
