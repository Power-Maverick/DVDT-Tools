#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import prompts from 'prompts';

interface ToolConfig {
  toolName: string;
  description: string;
  author: string;
  packageName: string;
}

/**
 * Main function to scaffold a new DVDT tool
 */
async function main() {
  console.log('🚀 Create DVDT Tool\n');
  console.log('This will create a new tool structure similar to erd-generator.\n');

  // Prompt for tool information
  const response = await prompts([
    {
      type: 'text',
      name: 'toolName',
      message: 'Tool name (e.g., my-tool):',
      validate: (value) => {
        if (!value) return 'Tool name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Tool name must be lowercase with hyphens only';
        return true;
      }
    },
    {
      type: 'text',
      name: 'description',
      message: 'Tool description:',
      validate: (value) => value ? true : 'Description is required'
    },
    {
      type: 'text',
      name: 'author',
      message: 'Author name:',
      initial: 'Power-Maverick',
      validate: (value) => value ? true : 'Author is required'
    }
  ]);

  // Handle cancellation
  if (!response.toolName || !response.description || !response.author) {
    console.log('\n❌ Tool creation cancelled.');
    process.exit(1);
  }

  const config: ToolConfig = {
    toolName: response.toolName,
    description: response.description,
    author: response.author,
    packageName: `dvdt-${response.toolName}`
  };

  const targetDir = path.join(process.cwd(), 'tools', config.toolName);

  // Check if directory already exists
  if (fs.existsSync(targetDir)) {
    console.error(`\n❌ Error: Directory 'tools/${config.toolName}' already exists!`);
    process.exit(1);
  }

  console.log(`\n✨ Creating tool structure in tools/${config.toolName}...\n`);

  // Create directory structure
  createDirectoryStructure(targetDir, config);

  console.log('✅ Tool created successfully!\n');
  console.log('Next steps:');
  console.log(`  cd tools/${config.toolName}`);
  console.log('  npm install');
  console.log('  npm run build\n');
}

/**
 * Create the complete directory structure for the new tool
 */
function createDirectoryStructure(targetDir: string, config: ToolConfig) {
  // Create directories
  const dirs = [
    targetDir,
    path.join(targetDir, 'src'),
    path.join(targetDir, 'src/components'),
    path.join(targetDir, 'src/dvdtIntegration'),
    path.join(targetDir, 'src/models'),
    path.join(targetDir, 'src/utils'),
    path.join(targetDir, 'ui'),
    path.join(targetDir, 'docs')
  ];

  dirs.forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`  Created: ${path.relative(process.cwd(), dir)}/`);
  });

  // Create files
  createPackageJson(targetDir, config);
  createTsConfig(targetDir);
  createTsConfigWebview(targetDir);
  createWebpackConfig(targetDir);
  createNpmIgnore(targetDir);
  createReadme(targetDir, config);
  createIndexTs(targetDir, config);
  createIntegrationTs(targetDir, config);
  createWebviewTs(targetDir, config);
  createWebviewHtml(targetDir, config);
  createComponentTs(targetDir, config);
  createModelsTs(targetDir);
  createClientTs(targetDir);
  createConstantsTs(targetDir);
  createGettingStartedMd(targetDir, config);
}

/**
 * Create package.json
 */
function createPackageJson(targetDir: string, config: ToolConfig) {
  const packageJson = {
    name: config.packageName,
    version: '1.0.0',
    description: config.description,
    main: 'dist/src/index.js',
    types: 'dist/src/index.d.ts',
    scripts: {
      build: 'npm run build:extension && npm run build:webview',
      'build:extension': 'tsc',
      'build:webview': 'webpack --config webpack.config.js',
      dev: 'npm run dev:extension & npm run dev:webview',
      'dev:extension': 'tsc --watch',
      'dev:webview': 'webpack --config webpack.config.js --watch',
      'test:standalone': 'echo \'Opening standalone test page...\' && python3 -m http.server 8080 --directory ui || python -m SimpleHTTPServer 8080'
    },
    keywords: [
      'dataverse',
      'power-platform',
      'dvdt'
    ],
    author: config.author,
    license: 'GPL-2.0',
    devDependencies: {
      '@types/node': '24.7.2',
      '@types/vscode': '1.85.0',
      'axios': '1.12.2',
      'ts-loader': '9.5.4',
      'typescript': '5.9.3',
      'webpack': '5.102.1',
      'webpack-cli': '5.1.4'
    },
    peerDependencies: {
      vscode: '^1.85.0'
    },
    peerDependenciesMeta: {
      vscode: {
        optional: true
      }
    }
  };

  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(packageJson, null, 2) + '\n'
  );
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'package.json'))}`);
}

/**
 * Create tsconfig.json
 */
function createTsConfig(targetDir: string) {
  const tsconfig = {
    extends: '../../tsconfig.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './',
      target: 'es6',
      module: 'commonjs',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      lib: ['es6', 'dom']
    },
    include: [
      'src/**/*'
    ],
    exclude: [
      'src/dvdtIntegration/webview.ts'
    ]
  };

  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2) + '\n'
  );
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'tsconfig.json'))}`);
}

/**
 * Create tsconfig.webview.json
 */
function createTsConfigWebview(targetDir: string) {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ES2020',
      lib: ['ES2020', 'DOM'],
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      moduleResolution: 'node',
      resolveJsonModule: true
    },
    include: [
      'src/dvdtIntegration/webview.ts',
      'src/utils/*.ts',
      'src/components/*.ts',
      'src/models/*.ts'
    ]
  };

  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.webview.json'),
    JSON.stringify(tsconfig, null, 2) + '\n'
  );
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'tsconfig.webview.json'))}`);
}

/**
 * Create webpack.config.js
 */
function createWebpackConfig(targetDir: string) {
  const webpackConfig = `const path = require('path');

module.exports = {
    mode: 'production',
    entry: './src/dvdtIntegration/webview.ts',
    output: {
        path: path.resolve(__dirname, 'dist', 'webview'),
        filename: 'webview.js',
        clean: true
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\\.ts$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: 'tsconfig.webview.json'
                    }
                },
                exclude: /node_modules/
            }
        ]
    },
    target: 'web',
    devtool: 'source-map'
};
`;

  fs.writeFileSync(path.join(targetDir, 'webpack.config.js'), webpackConfig);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'webpack.config.js'))}`);
}

/**
 * Create .npmignore
 */
function createNpmIgnore(targetDir: string) {
  const npmIgnore = `/docs
/src
`;

  fs.writeFileSync(path.join(targetDir, '.npmignore'), npmIgnore);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, '.npmignore'))}`);
}

/**
 * Create README.md
 */
function createReadme(targetDir: string, config: ToolConfig) {
  const readme = `# ${config.toolName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} for Dataverse

${config.description}

## Features

- VS Code WebView Panel integration with DVDT
- Fetch metadata automatically from Dataverse
- Minimal integration required

## Installation

\`\`\`bash
npm install ${config.packageName}
\`\`\`

## Development & Testing

### Building the Project

\`\`\`bash
npm run build
\`\`\`

### Watch Mode

\`\`\`bash
npm run dev
\`\`\`

## Integration with Dataverse DevTools

### VS Code WebView Panel Integration

\`\`\`typescript
import { showPanel } from '${config.packageName}';

// Call this when you want to show the panel
showPanel(context.extensionUri, environmentUrl, accessToken);
\`\`\`

## API

### showPanel()

Opens the panel in VS Code.

**Parameters:**
- \`extensionUri: vscode.Uri\` - VS Code extension URI from context
- \`environmentUrl: string\` - Dataverse environment URL
- \`accessToken: string\` - Dataverse access token

**Example:**
\`\`\`typescript
showPanel(context.extensionUri, environmentUrl, accessToken);
\`\`\`

### DataverseClient

Handles communication with Dataverse Web API.

**Constructor:**
\`\`\`typescript
new DataverseClient({
  environmentUrl: string,
  accessToken: string,
  apiVersion?: string  // Optional, defaults to '9.2'
})
\`\`\`

## Architecture

- \`src/components/\` - Core business logic
- \`src/dvdtIntegration/\` - VS Code WebView integration
- \`src/models/\` - TypeScript interfaces and types
- \`src/utils/\` - Dataverse client and utilities
- \`ui/\` - WebView HTML templates
- \`dist/\` - Compiled output

## License

GPL-2.0
`;

  fs.writeFileSync(path.join(targetDir, 'README.md'), readme);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'README.md'))}`);
}

/**
 * Create src/index.ts
 */
function createIndexTs(targetDir: string, config: ToolConfig) {
  const indexTs = `export { ToolComponent } from './components/ToolComponent';
export * from './models/interfaces';
export { DataverseClient } from './utils/DataverseClient';
export type { DataverseConfig } from './utils/DataverseClient';

// VS Code integration (optional import)
export { showPanel } from './dvdtIntegration/integration';
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'index.ts'), indexTs);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'src', 'index.ts'))}`);
}

/**
 * Create src/dvdtIntegration/integration.ts
 */
function createIntegrationTs(targetDir: string, config: ToolConfig) {
  const integrationTs = `import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Show the ${config.toolName} panel in VS Code
 * @param extensionUri The extension URI from context
 * @param environmentUrl Dataverse environment URL
 * @param accessToken Dataverse access token
 */
export function showPanel(
  extensionUri: vscode.Uri,
  environmentUrl: string,
  accessToken: string
): void {
  // Create and show webview panel
  const panel = vscode.window.createWebviewPanel(
    '${config.toolName}Panel',
    '${config.toolName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(extensionUri, 'node_modules', '${config.packageName}', 'dist'),
        vscode.Uri.joinPath(extensionUri, 'node_modules', '${config.packageName}', 'ui')
      ]
    }
  );

  // Load HTML content
  const htmlPath = vscode.Uri.joinPath(
    extensionUri,
    'node_modules',
    '${config.packageName}',
    'ui',
    'webview.html'
  );

  let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

  // Get webview script URI
  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(
      extensionUri,
      'node_modules',
      '${config.packageName}',
      'dist',
      'webview',
      'webview.js'
    )
  );

  // Replace script placeholder
  htmlContent = htmlContent.replace(
    '{{WEBVIEW_SCRIPT_URI}}',
    scriptUri.toString()
  );

  panel.webview.html = htmlContent;

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'getConfig':
          // Send configuration to webview
          panel.webview.postMessage({
            command: 'config',
            environmentUrl,
            accessToken
          });
          break;
        case 'error':
          vscode.window.showErrorMessage(message.message);
          break;
        case 'info':
          vscode.window.showInformationMessage(message.message);
          break;
      }
    },
    undefined
  );

  // Request config on panel load
  panel.webview.postMessage({ command: 'ready' });
}
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'dvdtIntegration', 'integration.ts'), integrationTs);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'src', 'dvdtIntegration', 'integration.ts'))}`);
}

/**
 * Create src/dvdtIntegration/webview.ts
 */
function createWebviewTs(targetDir: string, config: ToolConfig) {
  const webviewTs = `import { DataverseClient, DataverseConfig } from '../utils/DataverseClient';

// VS Code API (available in webview context)
declare const acquireVsCodeApi: () => any;
const vscode = acquireVsCodeApi();

let dataverseClient: DataverseClient | null = null;

/**
 * Initialize the webview
 */
function init() {
  console.log('Webview initializing...');
  
  // Request configuration from extension
  vscode.postMessage({ command: 'getConfig' });

  // Set up event listeners
  setupEventListeners();
}

/**
 * Setup event listeners for UI elements
 */
function setupEventListeners() {
  // Add your event listeners here
  const loadButton = document.getElementById('loadButton');
  if (loadButton) {
    loadButton.addEventListener('click', handleLoad);
  }
}

/**
 * Handle load button click
 */
async function handleLoad() {
  if (!dataverseClient) {
    showError('Not connected to Dataverse');
    return;
  }

  try {
    showStatus('Loading data...');
    
    // Add your data loading logic here
    
    showStatus('Data loaded successfully');
  } catch (error: any) {
    showError(\`Failed to load data: \${error.message}\`);
  }
}

/**
 * Show status message
 */
function showStatus(message: string) {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'status-info';
  }
}

/**
 * Show error message
 */
function showError(message: string) {
  const statusDiv = document.getElementById('status');
  if (statusDiv) {
    statusDiv.textContent = message;
    statusDiv.className = 'status-error';
  }
  vscode.postMessage({ command: 'error', message });
}

// Listen for messages from extension
window.addEventListener('message', (event) => {
  const message = event.data;
  
  switch (message.command) {
    case 'config':
      // Initialize Dataverse client with config
      const config: DataverseConfig = {
        environmentUrl: message.environmentUrl,
        accessToken: message.accessToken
      };
      dataverseClient = new DataverseClient(config);
      showStatus('Connected to Dataverse');
      break;
  }
});

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'dvdtIntegration', 'webview.ts'), webviewTs);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'src', 'dvdtIntegration', 'webview.ts'))}`);
}

/**
 * Create ui/webview.html
 */
function createWebviewHtml(targetDir: string, config: ToolConfig) {
  const webviewHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.toolName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        h1 {
            color: var(--vscode-foreground);
            margin-bottom: 20px;
        }
        
        .controls {
            margin: 20px 0;
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            cursor: pointer;
            border-radius: 2px;
            margin-right: 10px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .status {
            margin: 10px 0;
            padding: 10px;
            border-radius: 4px;
        }
        
        .status-info {
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
        }
        
        .status-error {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
        }
        
        .content {
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${config.toolName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</h1>
        
        <div class="controls">
            <button id="loadButton">Load Data</button>
        </div>
        
        <div id="status" class="status"></div>
        
        <div class="content" id="content">
            <!-- Content will be added here -->
        </div>
    </div>
    
    <script src="{{WEBVIEW_SCRIPT_URI}}"></script>
</body>
</html>
`;

  fs.writeFileSync(path.join(targetDir, 'ui', 'webview.html'), webviewHtml);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'ui', 'webview.html'))}`);
}

/**
 * Create src/components/ToolComponent.ts
 */
function createComponentTs(targetDir: string, config: ToolConfig) {
  const componentTs = `/**
 * ${config.toolName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Component
 * Core business logic for the tool
 */
export class ToolComponent {
  /**
   * Constructor
   */
  constructor() {
    // Initialize your component
  }

  /**
   * Process data
   * @param data Input data
   * @returns Processed result
   */
  public process(data: any): any {
    // Add your processing logic here
    return data;
  }
}
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'components', 'ToolComponent.ts'), componentTs);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'src', 'components', 'ToolComponent.ts'))}`);
}

/**
 * Create src/models/interfaces.ts
 */
function createModelsTs(targetDir: string) {
  const modelsTs = `/**
 * Common interfaces and types for the tool
 */

export interface ToolConfig {
  // Add your configuration options here
}

export interface DataItem {
  id: string;
  name: string;
  // Add more properties as needed
}
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'models', 'interfaces.ts'), modelsTs);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'src', 'models', 'interfaces.ts'))}`);
}

/**
 * Create src/utils/DataverseClient.ts
 */
function createClientTs(targetDir: string) {
  const clientTs = `import axios, { AxiosInstance } from 'axios';
import { API_VERSION } from './Constants';

export interface DataverseConfig {
  environmentUrl: string;
  accessToken: string;
  apiVersion?: string;
}

/**
 * Client for interacting with Dataverse Web API
 */
export class DataverseClient {
  private axios: AxiosInstance;
  private config: DataverseConfig;

  constructor(config: DataverseConfig) {
    this.config = {
      ...config,
      apiVersion: config.apiVersion || API_VERSION
    };

    this.axios = axios.create({
      baseURL: \`\${this.config.environmentUrl}/api/data/v\${this.config.apiVersion}\`,
      headers: {
        'Authorization': \`Bearer \${this.config.accessToken}\`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
      }
    });
  }

  /**
   * Fetch data from Dataverse
   * @param entityName Entity logical name
   * @returns Array of records
   */
  async fetchData(entityName: string): Promise<any[]> {
    try {
      const response = await this.axios.get(\`/\${entityName}\`);
      return response.data.value || [];
    } catch (error: any) {
      throw new Error(\`Failed to fetch \${entityName}: \${error.message}\`);
    }
  }
}
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'utils', 'DataverseClient.ts'), clientTs);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'src', 'utils', 'DataverseClient.ts'))}`);
}

/**
 * Create src/utils/Constants.ts
 */
function createConstantsTs(targetDir: string) {
  const constantsTs = `/**
 * Constants used throughout the tool
 */

export const API_VERSION = '9.2';
`;

  fs.writeFileSync(path.join(targetDir, 'src', 'utils', 'Constants.ts'), constantsTs);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'src', 'utils', 'Constants.ts'))}`);
}

/**
 * Create docs/Getting_Started.md
 */
function createGettingStartedMd(targetDir: string, config: ToolConfig) {
  const gettingStartedMd = `# Getting Started: ${config.toolName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

This guide will help you install, build, and integrate the tool with Dataverse DevTools (DVDT).

## Prerequisites

- VS Code 1.85+ (stable)
- Node.js 18+ and npm 9+
- A Dataverse environment and an account with read access
- Optional: DVDT extension (for integration testing)

## Project Layout

\`\`\`
tools/${config.toolName}/
  src/                 # Source code
    components/        # Core business logic
    dvdtIntegration/   # VS Code WebView integration
    models/            # TypeScript interfaces and types
    utils/             # Dataverse client and utilities
  ui/                  # WebView HTML template
  dist/webview/        # Bundled WebView JS (built by webpack)
  webpack.config.js    # WebView bundling config
  package.json         # Scripts for build/dev
  docs/                # Documentation
\`\`\`

## Install Dependencies

From the tool directory:

\`\`\`bash
cd tools/${config.toolName}
npm install
\`\`\`

## Build

Build both extension and webview:

\`\`\`bash
npm run build
\`\`\`

## Development Mode

Run in watch mode for continuous rebuilding:

\`\`\`bash
npm run dev
\`\`\`

## Integration with DVDT

In your DVDT extension code:

\`\`\`typescript
import { showPanel } from '${config.packageName}';

// Call when you want to show the panel
showPanel(context.extensionUri, environmentUrl, accessToken);
\`\`\`

## Customization

1. Edit \`src/components/ToolComponent.ts\` for core business logic
2. Update \`src/dvdtIntegration/webview.ts\` for webview behavior
3. Modify \`ui/webview.html\` for UI layout and styling
4. Add more utilities in \`src/utils/\` as needed

## Testing

Run the standalone test server:

\`\`\`bash
npm run test:standalone
\`\`\`

Then open http://localhost:8080/test.html in your browser.
`;

  fs.writeFileSync(path.join(targetDir, 'docs', 'Getting_Started.md'), gettingStartedMd);
  console.log(`  Created: ${path.relative(process.cwd(), path.join(targetDir, 'docs', 'Getting_Started.md'))}`);
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
