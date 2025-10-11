/**
 * Webview script for ERD Generator
 * This file runs in the webview context and has direct access to all helper classes
 */

import { DataverseClient } from './DataverseClient';
import { ERDGenerator } from './ERDGenerator';
import { DataverseSolution } from './types';

// VS Code API (provided by VS Code webview runtime)
declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

// Global state
interface State {
    environmentUrl: string | null;
    accessToken: string | null;
    solutions: any[];
    selectedSolution: string | null;
    selectedFormat: 'mermaid' | 'plantuml' | 'graphviz';
    generatedDiagram: string | null;
    config: {
        includeAttributes: boolean;
        includeRelationships: boolean;
        maxAttributesPerTable: number;
    };
}

const state: State = {
    environmentUrl: null,
    accessToken: null,
    solutions: [],
    selectedSolution: null,
    selectedFormat: 'mermaid',
    generatedDiagram: null,
    config: {
        includeAttributes: true,
        includeRelationships: true,
        maxAttributesPerTable: 10
    }
};

// DOM elements (will be initialized after DOM loads)
let elements: {
    generateBtn: HTMLButtonElement;
    newDiagramBtn: HTMLButtonElement;
    downloadSourceBtn: HTMLButtonElement;
    copyBtn: HTMLButtonElement;
    errorMessage: HTMLDivElement;
    solutionSelect: HTMLSelectElement;
    generateSection: HTMLDivElement;
    diagramSection: HTMLDivElement;
    diagramContainer: HTMLDivElement;
    envDisplay: HTMLSpanElement;
    connectionInfo: HTMLDivElement;
    includeAttributesCheckbox: HTMLInputElement;
    includeRelationshipsCheckbox: HTMLInputElement;
    maxAttributesInput: HTMLInputElement;
};

// Helper functions
function showError(message: string) {
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
        elements.errorMessage.classList.remove('hidden');
        setTimeout(() => {
            elements.errorMessage.classList.add('hidden');
        }, 5000);
    }
}

// Initialize: Request environment URL and token from VS Code extension
function initialize() {
    vscode.postMessage({
        command: 'requestCredentials'
    });
}

// Handle messages from VS Code extension
window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.command) {
        case 'setCredentials':
            state.environmentUrl = message.environmentUrl;
            state.accessToken = message.accessToken;
            if (elements.envDisplay) {
                elements.envDisplay.textContent = message.environmentUrl;
            }
            loadSolutions();
            break;
    }
});

// Load solutions from Dataverse
async function loadSolutions() {
    if (!state.environmentUrl || !state.accessToken) {
        showError('Missing environment URL or access token');
        return;
    }

    try {
        elements.solutionSelect.disabled = true;
        elements.solutionSelect.innerHTML = '<option value="">Loading solutions...</option>';

        const client = new DataverseClient({
            environmentUrl: state.environmentUrl,
            accessToken: state.accessToken
        });

        const solutions = await client.listSolutions();
        state.solutions = solutions;
        populateSolutionsDropdown(solutions);
    } catch (error: any) {
        showError(`Failed to load solutions: ${error.message}`);
        elements.solutionSelect.disabled = false;
        elements.solutionSelect.innerHTML = '<option value="">Error loading solutions</option>';
    }
}

// Populate solutions dropdown
function populateSolutionsDropdown(solutions: any[]) {
    elements.solutionSelect.innerHTML = '<option value="">-- Select a Solution --</option>';
    
    solutions.forEach(solution => {
        const option = document.createElement('option');
        option.value = solution.uniqueName;
        option.textContent = `${solution.displayName} (${solution.version})`;
        elements.solutionSelect.appendChild(option);
    });
    
    elements.solutionSelect.disabled = false;
}

// Generate ERD
async function generateERD() {
    if (!state.selectedSolution) {
        showError('Please select a solution first');
        return;
    }

    if (!state.environmentUrl || !state.accessToken) {
        showError('Missing environment URL or access token');
        return;
    }

    try {
        elements.generateBtn.disabled = true;
        elements.generateBtn.textContent = 'Generating...';

        const client = new DataverseClient({
            environmentUrl: state.environmentUrl,
            accessToken: state.accessToken
        });

        const solution = await client.fetchSolution(state.selectedSolution);
        
        const generator = new ERDGenerator({
            format: state.selectedFormat,
            includeAttributes: state.config.includeAttributes,
            includeRelationships: state.config.includeRelationships,
            maxAttributesPerTable: state.config.maxAttributesPerTable
        });

        const diagram = generator.generate(solution);
        state.generatedDiagram = diagram;
        
        displayDiagram(diagram, state.selectedFormat);
        elements.diagramSection.classList.remove('hidden');
        elements.newDiagramBtn.classList.remove('hidden');
        
    } catch (error: any) {
        showError(`Failed to generate ERD: ${error.message}`);
    } finally {
        elements.generateBtn.disabled = false;
        elements.generateBtn.textContent = 'Generate ERD';
    }
}

// Display diagram
function displayDiagram(diagram: string, format: string) {
    elements.diagramContainer.innerHTML = `<pre>${diagram}</pre>`;
}

// Download source
function downloadSource() {
    if (!state.generatedDiagram) {
        showError('No diagram to download');
        return;
    }

    const extensions: Record<string, string> = {
        'mermaid': 'mmd',
        'plantuml': 'puml',
        'graphviz': 'dot'
    };

    vscode.postMessage({
        command: 'saveFile',
        content: state.generatedDiagram,
        fileName: `${state.selectedSolution}-erd.${extensions[state.selectedFormat]}`
    });
}

// Copy to clipboard
function copyToClipboard() {
    if (!state.generatedDiagram) {
        showError('No diagram to copy');
        return;
    }

    vscode.postMessage({
        command: 'copyToClipboard',
        content: state.generatedDiagram
    });

    const originalText = elements.copyBtn.textContent;
    elements.copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
        elements.copyBtn.textContent = originalText;
    }, 2000);
}

// Generate new diagram
function generateNewDiagram() {
    elements.solutionSelect.value = '';
    state.selectedSolution = null;
    state.generatedDiagram = null;
    
    elements.diagramSection.classList.add('hidden');
    elements.newDiagramBtn.classList.add('hidden');
    elements.generateBtn.disabled = true;
}

// DOM initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    elements = {
        generateBtn: document.getElementById('generateBtn') as HTMLButtonElement,
        newDiagramBtn: document.getElementById('newDiagramBtn') as HTMLButtonElement,
        downloadSourceBtn: document.getElementById('downloadSourceBtn') as HTMLButtonElement,
        copyBtn: document.getElementById('copyBtn') as HTMLButtonElement,
        errorMessage: document.getElementById('errorMessage') as HTMLDivElement,
        solutionSelect: document.getElementById('solutionSelect') as HTMLSelectElement,
        generateSection: document.getElementById('generateSection') as HTMLDivElement,
        diagramSection: document.getElementById('diagramSection') as HTMLDivElement,
        diagramContainer: document.getElementById('diagramContainer') as HTMLDivElement,
        envDisplay: document.getElementById('envDisplay') as HTMLSpanElement,
        connectionInfo: document.getElementById('connectionInfo') as HTMLDivElement,
        includeAttributesCheckbox: document.getElementById('includeAttributesCheckbox') as HTMLInputElement,
        includeRelationshipsCheckbox: document.getElementById('includeRelationshipsCheckbox') as HTMLInputElement,
        maxAttributesInput: document.getElementById('maxAttributesInput') as HTMLInputElement
    };

    // Solution selection handler
    elements.solutionSelect.addEventListener('change', (e) => {
        state.selectedSolution = (e.target as HTMLSelectElement).value;
        elements.generateBtn.disabled = !state.selectedSolution;
    });

    // Format selector
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.selectedFormat = (btn as HTMLElement).dataset.format as any;
        });
    });

    // Config controls
    elements.includeAttributesCheckbox.addEventListener('change', (e) => {
        state.config.includeAttributes = (e.target as HTMLInputElement).checked;
    });

    elements.includeRelationshipsCheckbox.addEventListener('change', (e) => {
        state.config.includeRelationships = (e.target as HTMLInputElement).checked;
    });

    elements.maxAttributesInput.addEventListener('input', (e) => {
        state.config.maxAttributesPerTable = parseInt((e.target as HTMLInputElement).value) || 0;
    });

    // Generate ERD button
    elements.generateBtn.addEventListener('click', generateERD);

    // Download source button
    elements.downloadSourceBtn.addEventListener('click', downloadSource);

    // Copy to clipboard button
    elements.copyBtn.addEventListener('click', copyToClipboard);

    // New diagram button
    elements.newDiagramBtn.addEventListener('click', generateNewDiagram);

    // Initialize
    initialize();
});
