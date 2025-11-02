# DVDT Integration Guide

This guide shows how to integrate the ERD Generator tool into Dataverse DevTools (DVDT) VS Code extension.

## Overview

The ERD Generator is a **dual-platform React tool** that works in both:
- **PPTB** (PowerPlatform ToolBox) - Browser-based
- **DVDT** (Dataverse DevTools) - VS Code WebView

The tool automatically detects its environment and adapts accordingly.

## Architecture

```
┌─────────────────────────────────────────┐
│   DVDT VS Code Extension (Host)         │
│   - Provides environment URL + token    │
│   - Creates WebView panel               │
│   - Loads built React app               │
└────────────────┬────────────────────────┘
                 │
                 │ postMessage
                 ▼
┌─────────────────────────────────────────┐
│   ERD Generator React App (WebView)     │
│   - Detects DVDT via acquireVsCodeApi() │
│   - Receives credentials via message    │
│   - Generates ERD diagrams              │
└─────────────────────────────────────────┘
```

## Integration Steps

### 1. Build the Tool

First, build the ERD generator to produce the `dist/` folder:

```bash
cd tools/erd-generator
npm install
npm run build
```

This creates:
```
dist/
├── index.html
├── index.js
├── index.css
└── [mermaid chunks...]
```

### 2. Add as Dependency

In your DVDT extension, add the tool as a dependency:

**Option A: NPM Workspace (if in monorepo)**

```json
// dvdt/package.json
{
  "dependencies": {
    "@power-maverick/tool-erd-generator": "workspace:*"
  }
}
```

**Option B: NPM Package**

```bash
npm install @power-maverick/tool-erd-generator
```

**Option C: File Copy**

Copy the `dist/` folder to your extension:
```
dvdt-extension/
├── src/
├── resources/
│   └── erd-generator/      # Copy dist/ here
│       ├── index.html
│       ├── index.js
│       └── index.css
```

### 3. Create ERD Panel Class (Using DVDT's VsCodePanel)

Create a new panel class that extends DVDT's `VsCodePanel` base:

```typescript
// src/views/ERDGeneratorView.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { VsCodePanel } from './base/VsCodePanelBase';

export class ERDGeneratorView extends VsCodePanel {
    private environmentUrl: string;
    private accessToken: string;

    constructor(
        webview: vscode.WebviewPanel,
        vscontext: vscode.ExtensionContext,
        environmentUrl: string,
        accessToken: string
    ) {
        super({
            panel: webview,
            extensionUri: vscontext.extensionUri,
            webViewFileName: 'erd-generator', // Not used, we override getHtmlForWebview
            excludeExternalCss: true,
            excludeExternalJs: true
        });

        this.environmentUrl = environmentUrl;
        this.accessToken = accessToken;

        // Send credentials after webview loads
        setTimeout(() => {
            this.sendCredentials();
        }, 500);

        // Set initial HTML
        super.update();
    }

    private sendCredentials() {
        this.webViewPanel.webview.postMessage({
            command: 'setCredentials',
            environmentUrl: this.environmentUrl,
            accessToken: this.accessToken
        });
    }

    /**
     * Override to load React app instead of template HTML
     */
    getHtmlForWebview(): string {
        // Path to the built React app
        const distPath = vscode.Uri.joinPath(
            this.panelOptions.extensionUri,
            'node_modules',
            '@power-maverick',
            'tool-erd-generator',
            'dist'
        );

        // Read index.html from the React build
        const indexHtmlPath = vscode.Uri.joinPath(distPath, 'index.html');
        let htmlContent = fs.readFileSync(indexHtmlPath.fsPath, 'utf-8');

        // Get webview URIs for assets
        const jsUri = this.webViewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(distPath, 'index.js')
        );
        const cssUri = this.webViewPanel.webview.asWebviewUri(
            vscode.Uri.joinPath(distPath, 'index.css')
        );

        // CSP for the webview
        const cspSource = this.webViewPanel.webview.cspSource;
        const cspMeta = `
            <meta http-equiv="Content-Security-Policy" 
                  content="default-src 'none'; 
                           script-src ${cspSource} 'unsafe-inline'; 
                           style-src ${cspSource} 'unsafe-inline'; 
                           connect-src https://*.dynamics.com; 
                           img-src ${cspSource} data: blob:;">
        `;

        // Replace script/css paths with webview URIs
        htmlContent = htmlContent
            .replace(/src="\/src\/main.tsx"/g, `src="${jsUri}"`)
            .replace('</head>', `<link rel="stylesheet" href="${cssUri}">${cspMeta}</head>`);

        return htmlContent;
    }
}
```

### 4. Use ViewBase to Create WebView

In your helper class (e.g., `ToolsHelper`), use `ViewBase` to create the webview:

```typescript
// src/helpers/toolsHelper.ts (add this method)
import { ERDGeneratorView } from '../views/ERDGeneratorView';
import { ViewBase } from '../views/ViewBase';

export class ToolsHelper {
    // ... existing code

    public async openERDGenerator(view: ViewBase): Promise<void> {
        const connFromWS: IConnection = this.vsstate.getFromWorkspace(connectionCurrentStoreKey);
        
        if (connFromWS && connFromWS.currentAccessToken) {
            const webview = await view.getWebView({
                type: 'erdGenerator',
                title: 'ERD Generator'
            });
            
            new ERDGeneratorView(
                webview,
                this.vscontext,
                connFromWS.environmentUrl,
                connFromWS.currentAccessToken
            );
        } else {
            vscode.window.showErrorMessage('No active Dataverse connection. Please connect first.');
        }
    }
}
```

### 5. Register Command

Register the command in your extension's `activate()` function:

```typescript
// src/extension.ts
export function activate(context: vscode.ExtensionContext) {
    // Initialize helpers
    const viewBase = new ViewBase(context);
    const toolsHelper = new ToolsHelper(context, dataverseHelper, webResourceHelper);

    // ... other commands

    context.subscriptions.push(
        vscode.commands.registerCommand('dvdt.erdGenerator.open', async () => {
            await toolsHelper.openERDGenerator(viewBase);
        })
    );
}
```

### 6. Add to package.json

Add the command to your extension manifest:

```json
// package.json
{
  "contributes": {
    "commands": [
      {
        "command": "dvdt.erdGenerator.open",
        "title": "Generate ERD",
        "category": "Dataverse"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "dvdt.erdGenerator.open",
          "when": "dvdt:hasActiveConnection"
        }
      ],
      "view/item/context": [
        {
          "command": "dvdt.erdGenerator.open",
          "when": "view == dvdtExplorer && viewItem == solutions",
          "group": "tools@1"
        }
      ]
    }
  }
}
```

## Key Advantages of Using ViewBase + VsCodePanel

### 1. **Consistent Pattern**
- Matches existing DVDT views (SmartMatchView, EntityListView, etc.)
- Familiar structure for DVDT contributors
- Follows established conventions

### 2. **Automatic Lifecycle Management**
- `VsCodePanel` handles disposal, view state changes
- Proper cleanup of resources
- Built-in message handling

### 3. **Simplified WebView Creation**
- `ViewBase.getWebView()` creates configured webview panels
- Consistent webview options (scripts, resources, retention)
- No need to manually configure `localResourceRoots`

### 4. **Template System Integration**
- While we override `getHtmlForWebview()` for React, we still benefit from:
  - `getFileUri()` helper for asset URIs
  - CSP handling patterns
  - Disposal pattern

### 5. **Connection State Management**
- Follows DVDT's pattern of getting connection from workspace state
- Consistent error handling
- Proper token management

## How It Works

### Environment Detection

The React app detects DVDT using:

```typescript
// In src/App.tsx
useEffect(() => {
    // Check if we're in VS Code (DVDT)
    if (typeof window.acquireVsCodeApi !== 'undefined') {
        setIsPPTB(false);
        // Listen for credentials from DVDT
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.command === 'setCredentials') {
                setConnectionUrl(message.environmentUrl);
                setAccessToken(message.accessToken);
            }
        };
        window.addEventListener('message', handleMessage);
    }
    // Otherwise check for PPTB
    else if (window.toolboxAPI) {
        setIsPPTB(true);
        // Use PPTB APIs
    }
}, []);
```

### Credential Flow

1. DVDT extension creates webview with URL + token
2. Webview loads and detects DVDT via `acquireVsCodeApi()`
3. Webview sends ready message (optional)
4. Extension sends credentials via `postMessage`:
   ```json
   {
     "command": "setCredentials",
     "environmentUrl": "https://org.crm.dynamics.com",
     "accessToken": "eyJ..."
   }
   ```
5. React app stores credentials and loads solutions

### API Differences

The tool automatically handles API differences:

| Feature | DVDT (VS Code) | PPTB (Browser) |
|---------|----------------|----------------|
| Environment | `acquireVsCodeApi()` | `window.toolboxAPI` |
| Credentials | `postMessage` | `getToolContext()` |
| Notifications | Not implemented | `showNotification()` |
| File Save | Not implemented | `saveFile()` |
| Clipboard | Not implemented | `copyToClipboard()` |
| Dataverse API | Direct axios | `window.dataverseAPI` |

## Content Security Policy (CSP)

The webview requires CSP to allow:

```typescript
const panel = vscode.window.createWebviewPanel(
    'erdGenerator',
    'ERD Generator',
    vscode.ViewColumn.One,
    {
        enableScripts: true,
        // ... other options
    }
);

// Add CSP meta tag to HTML
const cspMeta = `
    <meta http-equiv="Content-Security-Policy" 
          content="default-src 'none'; 
                   script-src ${panel.webview.cspSource} 'unsafe-inline'; 
                   style-src ${panel.webview.cspSource} 'unsafe-inline'; 
                   connect-src https://*.dynamics.com; 
                   img-src ${panel.webview.cspSource} data: blob:;">
`;

// Insert before </head>
const htmlWithCsp = htmlContent.replace('</head>', cspMeta + '</head>');
```

**Required CSP directives:**
- `script-src` - For React bundle
- `style-src 'unsafe-inline'` - For Mermaid inline styles
- `connect-src https://*.dynamics.com` - For Dataverse API calls
- `img-src data: blob:` - For Mermaid diagrams (optional)

## Example: Complete Integration with DVDT Patterns

Here's the complete ERDGeneratorView following DVDT conventions:

```typescript
// src/views/ERDGeneratorView.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import { VsCodePanel } from './base/VsCodePanelBase';
import { IConnection } from '../utils/Interfaces';

/**
 * ERD Generator View - React-based tool for generating ERDs from Dataverse solutions
 * Follows DVDT's VsCodePanel pattern for consistency
 */
export class ERDGeneratorView extends VsCodePanel {
    private environmentUrl: string;
    private accessToken: string;

    constructor(
        webview: vscode.WebviewPanel,
        vscontext: vscode.ExtensionContext,
        connection: IConnection
    ) {
        super({
            panel: webview,
            extensionUri: vscontext.extensionUri,
            webViewFileName: 'erd-generator', // Not used for React apps
            excludeExternalCss: true,
            excludeExternalJs: true
        });

        this.environmentUrl = connection.environmentUrl;
        this.accessToken = connection.currentAccessToken;

        // Send credentials after a short delay (ensure React app is ready)
        setTimeout(() => {
            this.sendCredentials();
        }, 500);

        // Set initial HTML content
        super.update();
    }

    /**
     * Send credentials to the React app via postMessage
     */
    private sendCredentials() {
        this.webViewPanel.webview.postMessage({
            command: 'setCredentials',
            environmentUrl: this.environmentUrl,
            accessToken: this.accessToken
        });
    }

    /**
     * Override to load the React app instead of a template
     * This is where we inject the built React bundle
     */
    getHtmlForWebview(): string {
        try {
            // Path to the built React app (from npm package)
            const distPath = vscode.Uri.joinPath(
                this.panelOptions.extensionUri,
                'node_modules',
                '@power-maverick',
                'tool-erd-generator',
                'dist'
            );

            // Read the React app's index.html
            const indexHtmlPath = vscode.Uri.joinPath(distPath, 'index.html');
            let htmlContent = fs.readFileSync(indexHtmlPath.fsPath, 'utf-8');

            // Convert local paths to webview URIs
            const jsUri = this.webViewPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(distPath, 'index.js')
            );
            const cssUri = this.webViewPanel.webview.asWebviewUri(
                vscode.Uri.joinPath(distPath, 'index.css')
            );

            // Generate CSP for the webview
            const cspSource = this.webViewPanel.webview.cspSource;
            const cspMeta = `
                <meta http-equiv="Content-Security-Policy" 
                      content="default-src 'none'; 
                               script-src ${cspSource} 'unsafe-inline'; 
                               style-src ${cspSource} 'unsafe-inline'; 
                               connect-src https://*.dynamics.com; 
                               img-src ${cspSource} data: blob:;">
            `;

            // Replace the React development paths with webview URIs
            htmlContent = htmlContent
                .replace(/src="\/src\/main.tsx"/g, `src="${jsUri}"`)
                .replace('</head>', `<link rel="stylesheet" href="${cssUri}">${cspMeta}</head>`);

            return htmlContent;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to load ERD Generator: ${error}`);
            return '<html><body><h1>Error loading ERD Generator</h1></body></html>';
        }
    }
}
```

And the helper method:

```typescript
// src/helpers/toolsHelper.ts
import { ERDGeneratorView } from '../views/ERDGeneratorView';
import { ViewBase } from '../views/ViewBase';
import { connectionCurrentStoreKey } from '../utils/Constants';
import { IConnection } from '../utils/Interfaces';
import { State } from '../utils/State';

export class ToolsHelper {
    private vsstate: State;

    constructor(
        private vscontext: vscode.ExtensionContext,
        private dvHelper: DataverseHelper,
        private wrHelper: WebResourceHelper
    ) {
        this.vsstate = new State(vscontext);
    }

    /**
     * Open the ERD Generator tool
     * Follows the same pattern as openDRB()
     */
    public async openERDGenerator(view: ViewBase): Promise<void> {
        // Get the active connection from workspace state
        const connFromWS: IConnection = this.vsstate.getFromWorkspace(connectionCurrentStoreKey);
        
        if (connFromWS && connFromWS.currentAccessToken) {
            // Create webview panel using ViewBase
            const webview = await view.getWebView({
                type: 'erdGenerator',
                title: 'ERD Generator'
            });
            
            // Initialize the ERD Generator view
            new ERDGeneratorView(webview, this.vscontext, connFromWS);
        } else {
            vscode.window.showErrorMessage('No active Dataverse connection. Please connect to an environment first.');
        }
    }

    // ... existing methods (openDRB, etc.)
}
```

## Usage in DVDT

Once integrated, users can:

1. Open Command Palette (`Cmd+Shift+P`)
2. Run "Dataverse: Generate ERD"
3. Select a solution from the dropdown
4. Configure options (attributes, relationships, max attributes)
5. Choose format (Mermaid, PlantUML, or Graphviz)
6. Click "Generate ERD"
7. View visual preview (Mermaid) or copy source code

## Troubleshooting

### Webview shows blank screen

- Check browser console for CSP errors
- Verify dist/ folder exists and contains index.html, index.js, index.css
- Ensure script/css paths are replaced with webview URIs

### "Not running in supported environment" error

- The tool couldn't detect DVDT or PPTB
- Verify `acquireVsCodeApi` is available in the webview
- Check that credentials are sent via postMessage

### Dataverse API calls fail

- CSP blocks the request - add `connect-src https://*.dynamics.com`
- Invalid token - ensure fresh access token is provided
- Network issue - check environment URL is correct

### Mermaid diagrams don't render

- Mermaid library not loading - check for CSP script-src errors
- Missing 'unsafe-inline' in style-src - Mermaid needs inline styles

## Testing

### Manual Testing

1. Build the tool: `npm run build`
2. Install in DVDT: Copy dist/ or use npm workspace
3. Run DVDT in development: `F5` in VS Code
4. Open Command Palette and run your command
5. Verify webview loads and credentials are received

### Automated Testing

```typescript
// test/erdGenerator.test.ts
import * as vscode from 'vscode';
import * as assert from 'assert';

suite('ERD Generator Tests', () => {
    test('Command is registered', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('dvdt.showERDGenerator'));
    });

    test('Panel creates successfully', async () => {
        await vscode.commands.executeCommand('dvdt.showERDGenerator');
        // Add assertions for panel existence
    });
});
```

## Best Practices

1. **Cache credentials**: Store environment URL and token to avoid re-authentication
2. **Error handling**: Show VS Code notifications for errors
3. **Loading states**: Display progress while fetching solutions
4. **Dispose properly**: Clean up webview resources when panel closes
5. **CSP strict**: Only allow necessary sources in CSP

## Next Steps

- Add telemetry to track ERD generation usage
- Implement file save in DVDT (currently PPTB-only)
- Add keyboard shortcuts for common actions
- Support exporting to image formats (PNG, SVG)
- Add settings for default format and options

## Support

For issues or questions:
- GitHub Issues: https://github.com/Power-Maverick/DVDT-Tools/issues
- Discussions: https://github.com/Power-Maverick/DVDT-Tools/discussions
