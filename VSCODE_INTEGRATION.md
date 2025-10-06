# VS Code WebView Integration Guide for DVDT

This guide shows how to integrate the ERD Generator as a webview panel in Dataverse DevTools (DVDT) with **minimal changes to DVDT**.

> **🧪 Local Testing:** For instructions on testing the ERD tool with a local copy of DVDT, see [LOCAL_TESTING.md](./LOCAL_TESTING.md).

## Integration Philosophy

The ERD tool is designed as a **plug-and-play component** for DVDT:
- **DVDT provides**: Environment URL and access token
- **ERD tool handles**: Everything else (fetching solutions, generating diagrams, UI, etc.)
- **Integration effort**: ~10 lines of code in DVDT

## Quick Start

### 1. Install the Package

```json
// In DVDT's package.json
{
  "dependencies": {
    "@dvdt-tools/erd-generator": "^1.0.0"
  }
}
```

### 2. Register the Command (One-Time Setup)

Add this to DVDT's `extension.ts` activation function:

```typescript
import { registerERDTool } from '@dvdt-tools/erd-generator';

export function activate(context: vscode.ExtensionContext) {
    // Your existing DVDT activation code...
    
    // Register ERD tool - minimal integration!
    registerERDTool(context, {
        getEnvironmentUrl: () => dvdtConfig.getCurrentEnvironment(),
        getAccessToken: () => dvdtAuth.getAccessToken()
    });
}
```

That's it! The ERD tool is now integrated.

### 3. Add Menu Item (Optional)

Add a command to DVDT's `package.json`:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "dvdt.generateERD",
        "title": "Generate ERD",
        "category": "Dataverse DevTools"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "dvdt.generateERD",
          "when": "dvdt.connected"
        }
      ]
    }
  }
}
```

## Manual Integration (If you prefer more control)

If you want more control over the integration, you can use the `ERDToolPanel` class directly:

```typescript
import { ERDToolPanel } from '@dvdt-tools/erd-generator';
import * as vscode from 'vscode';

// In your command handler
vscode.commands.registerCommand('dvdt.generateERD', async () => {
    try {
        const environmentUrl = dvdtConfig.getCurrentEnvironment();
        const accessToken = await dvdtAuth.getAccessToken();

        if (!environmentUrl || !accessToken) {
            vscode.window.showErrorMessage('Please connect to Dataverse first');
            return;
        }

        // Open ERD tool panel
        ERDToolPanel.createOrShow(
            context.extensionUri,
            environmentUrl,
            accessToken
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open ERD Generator: ${error.message}`);
    }
});
```

## How It Works

### Architecture

```
┌─────────────────────────────┐
│     DVDT Extension          │
│  (Minimal Integration)      │
│                             │
│  1. Get environment URL     │
│  2. Get access token        │
│  3. Call registerERDTool()  │
└──────────┬──────────────────┘
           │
           │ Pass credentials
           ▼
┌─────────────────────────────┐
│  ERD Tool (Self-Contained)  │
│                             │
│  ┌────────────────────────┐ │
│  │  WebView Panel         │ │
│  │  - List solutions      │ │
│  │  - Select solution     │ │
│  │  - Generate diagram    │ │
│  │  - Download/copy       │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │  DataverseClient       │ │
│  │  - Fetch metadata      │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │  ERDGenerator          │ │
│  │  - Generate diagrams   │ │
│  └────────────────────────┘ │
└─────────────────────────────┘
```

### Communication Flow

1. **DVDT → ERD Tool**: Environment URL and token
2. **ERD Tool → Dataverse**: Fetch solutions and metadata
3. **ERD Tool → User**: Display UI and diagrams
4. **ERD Tool → VS Code**: Save files, copy to clipboard

All heavy lifting is done by the ERD tool. DVDT just provides credentials.

## Features Handled by ERD Tool

- ✅ WebView UI rendering
- ✅ Solution listing and selection
- ✅ Metadata fetching from Dataverse
- ✅ ERD generation (Mermaid, PlantUML, Graphviz)
- ✅ File saving
- ✅ Clipboard operations
- ✅ Error handling
- ✅ Loading states
- ✅ User feedback

## WebView Content

The ERD tool includes a self-contained HTML file (`webview.html`) that:
- Uses VS Code's theme colors automatically
- Follows VS Code design guidelines
- Communicates via message passing
- Handles all user interactions
- Requires no external dependencies

## Testing Integration

### 1. Test the Command

```bash
# In VS Code, open command palette (Ctrl+Shift+P)
# Type: "Generate ERD"
# The ERD tool should open in a panel
```

### 2. Verify Functionality

1. ERD panel opens successfully
2. Environment URL is displayed
3. Solutions are loaded and displayed
4. Selecting a solution works
5. ERD generation works
6. Download and copy functions work

## Error Handling

The ERD tool handles errors gracefully:

- **Authentication errors**: Shows message to reconnect
- **Network errors**: Displays error with details
- **API errors**: Shows Dataverse error messages
- **No solutions**: Displays helpful message

DVDT only needs to ensure valid credentials are provided.

## Customization Options

If you want to customize the ERD tool behavior, you can pass options:

```typescript
// Future enhancement - not yet implemented
ERDToolPanel.createOrShow(context.extensionUri, environmentUrl, accessToken, {
    defaultFormat: 'plantuml',
    maxAttributesPerTable: 15,
    theme: 'dark'
});
```

## Benefits for DVDT

1. **Minimal Code**: ~10 lines of integration code
2. **Zero Maintenance**: ERD tool updates independently
3. **No UI Code**: All UI handled by ERD tool
4. **No API Calls**: All Dataverse communication handled by ERD tool
5. **Plug-and-Play**: Can be added/removed without affecting DVDT core
6. **Extensible**: Easy to add more tools following the same pattern

## Troubleshooting

### ERD panel doesn't open

Check that:
- Package is installed: `npm list @dvdt-tools/erd-generator`
- Command is registered in activation
- Extension is activated

### Solutions don't load

Check that:
- Environment URL is valid
- Access token is not expired
- Token has required permissions

### Webview is blank

Check browser console for errors. The webview should work in VS Code 1.85+.

## Complete Example

Here's a complete example of DVDT integration:

```typescript
// extension.ts
import * as vscode from 'vscode';
import { registerERDTool } from '@dvdt-tools/erd-generator';

export function activate(context: vscode.ExtensionContext) {
    console.log('DVDT is now active');

    // Your existing DVDT code...
    const dvdtConfig = new DataverseConfig();
    const dvdtAuth = new DataverseAuth();

    // ... more DVDT setup ...

    // Register ERD tool - minimal integration!
    registerERDTool(context, {
        getEnvironmentUrl: () => dvdtConfig.getCurrentEnvironment(),
        getAccessToken: async () => {
            const token = await dvdtAuth.getAccessToken();
            if (!token) {
                throw new Error('Not authenticated');
            }
            return token;
        }
    });

    console.log('ERD tool registered successfully');
}

export function deactivate() {
    // Cleanup is handled automatically
}
```

```json
// package.json
{
  "name": "dataverse-devtools",
  "version": "1.0.0",
  "dependencies": {
    "@dvdt-tools/erd-generator": "^1.0.0"
  },
  "contributes": {
    "commands": [
      {
        "command": "dvdt.generateERD",
        "title": "Generate ERD",
        "category": "Dataverse DevTools",
        "icon": "$(graph)"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "dvdt.generateERD",
          "when": "dvdt.connected"
        }
      ],
      "view/title": [
        {
          "command": "dvdt.generateERD",
          "when": "view == dvdt.solutionsView",
          "group": "navigation"
        }
      ]
    }
  }
}
```

## Summary

The ERD tool is designed as a **self-contained component** that requires minimal integration:

1. **Install**: `npm install @dvdt-tools/erd-generator`
2. **Register**: Call `registerERDTool()` in activation
3. **Done**: ERD tool handles everything else

This design allows DVDT to remain a lightweight "toolbox" while ERD tool provides rich functionality with zero maintenance burden on DVDT.
