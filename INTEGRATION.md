# Integration Guide for Dataverse DevTools

This guide explains how to integrate the ERD Generator with the Dataverse DevTools VS Code extension.

## Overview

The ERD Generator is designed to work as a **standalone tool** that receives an authentication token from the Dataverse DevTools extension. This allows it to:

1. Connect directly to Dataverse environments
2. Fetch solution metadata automatically
3. Generate ERD diagrams on-demand
4. Work independently without requiring pre-fetched data

## Integration Architecture

```
┌─────────────────────────────┐
│  Dataverse DevTools VSCode  │
│        Extension            │
└──────────┬──────────────────┘
           │
           │ 1. Get Token
           │ 2. Pass Environment URL
           │ 3. Select Solution
           │
           ▼
┌─────────────────────────────┐
│   @dvdt-tools/erd-generator │
│                             │
│  ┌────────────────────────┐ │
│  │  DataverseClient       │ │
│  │  - Authentication      │ │
│  │  - Fetch Metadata      │ │
│  └────────────────────────┘ │
│                             │
│  ┌────────────────────────┐ │
│  │  ERDGenerator          │ │
│  │  - Generate Diagram    │ │
│  └────────────────────────┘ │
└──────────┬──────────────────┘
           │
           │ 4. Return ERD
           │
           ▼
┌─────────────────────────────┐
│  Display in VS Code         │
│  - Preview Panel            │
│  - Mermaid Rendering        │
│  - Save to File             │
└─────────────────────────────┘
```

## Step-by-Step Integration

### Minimal Integration (3 Steps)

The ERD Generator requires minimal integration - just 3 simple steps:

### 1. Install the Package

```bash
npm install @dvdt-tools/erd-generator
```

### 2. Import and Use with Token

```typescript
import { DataverseClient, ERDGenerator } from '@dvdt-tools/erd-generator';

// Get token from Dataverse DevTools (your existing auth)
const token = await dvdtAuth.getAccessToken();
const environmentUrl = dvdtConfig.getCurrentEnvironment();

// Create client with token - that's it!
const client = new DataverseClient({
  environmentUrl: environmentUrl,
  accessToken: token
});

// Fetch and generate
const solution = await client.fetchSolution('SolutionName');
const generator = new ERDGenerator({ format: 'mermaid' });
const erd = generator.generate(solution);
```

### 3. Display the Result

Show the ERD in VS Code using your preferred method (webview, preview, etc.)

---

## Detailed Integration Steps (Optional)

If you need more control, here are additional options:

### 1. Install the Package

Add the ERD generator to your VS Code extension:

```bash
npm install @dvdt-tools/erd-generator
```

### 2. Import the Required Components

```typescript
import { DataverseClient, ERDGenerator } from '@dvdt-tools/erd-generator';
```

### 3. Get Authentication Token

Use the Dataverse DevTools authentication to get a valid token:

```typescript
// Example: Get token from your auth provider
const token = await dvdtAuth.getAccessToken();
const environmentUrl = dvdtConfig.getCurrentEnvironment();
```

### 4. Create DataverseClient

```typescript
const client = new DataverseClient({
  environmentUrl: environmentUrl,
  accessToken: token,
  apiVersion: '9.2' // Optional, defaults to 9.2
});
```

### 5. List Available Solutions (Optional)

Allow users to select a solution:

```typescript
const solutions = await client.listSolutions();

// Show QuickPick to user
const selected = await vscode.window.showQuickPick(
  solutions.map(s => ({
    label: s.displayName,
    description: `v${s.version}`,
    detail: s.uniqueName
  })),
  {
    placeHolder: 'Select a solution to generate ERD'
  }
);

if (!selected) return;
const solutionName = selected.detail;
```

### 6. Fetch Solution Metadata

```typescript
// Show progress
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: 'Generating ERD',
  cancellable: false
}, async (progress) => {
  
  progress.report({ message: 'Fetching solution metadata...' });
  const solution = await client.fetchSolution(solutionName);
  
  progress.report({ message: `Processing ${solution.tables.length} tables...` });
  
  // Generate ERD
  const generator = new ERDGenerator({
    format: 'mermaid',
    includeAttributes: true,
    includeRelationships: true,
    maxAttributesPerTable: 10
  });
  
  const erd = generator.generate(solution);
  
  return erd;
});
```

### 7. Display or Save the ERD

```typescript
// Option 1: Display in a webview panel
const panel = vscode.window.createWebviewPanel(
  'erdDiagram',
  `ERD: ${solution.displayName}`,
  vscode.ViewColumn.One,
  {}
);

panel.webview.html = getWebviewContent(erd);

// Option 2: Save to file
const uri = await vscode.window.showSaveDialog({
  defaultUri: vscode.Uri.file(`${solution.uniqueName}-erd.mmd`),
  filters: {
    'Mermaid': ['mmd'],
    'All Files': ['*']
  }
});

if (uri) {
  await vscode.workspace.fs.writeFile(uri, Buffer.from(erd));
  vscode.window.showInformationMessage(`ERD saved to ${uri.fsPath}`);
}
```

## Complete Example Command

```typescript
import * as vscode from 'vscode';
import { DataverseClient, ERDGenerator } from '@dvdt-tools/erd-generator';

export async function generateERDCommand() {
  try {
    // Get authentication from your extension
    const token = await getAuthToken();
    const environmentUrl = getEnvironmentUrl();
    
    if (!token || !environmentUrl) {
      vscode.window.showErrorMessage('Please connect to a Dataverse environment first');
      return;
    }
    
    // Create client
    const client = new DataverseClient({
      environmentUrl,
      accessToken: token
    });
    
    // List solutions
    const solutions = await client.listSolutions();
    
    // Let user select
    const selected = await vscode.window.showQuickPick(
      solutions.map(s => ({
        label: s.displayName,
        description: `v${s.version}`,
        detail: s.uniqueName
      })),
      { placeHolder: 'Select a solution' }
    );
    
    if (!selected) return;
    
    // Generate ERD with progress
    const erd = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Generating ERD'
    }, async (progress) => {
      progress.report({ message: 'Fetching metadata...' });
      const solution = await client.fetchSolution(selected.detail);
      
      progress.report({ message: 'Generating diagram...' });
      const generator = new ERDGenerator({ format: 'mermaid' });
      return generator.generate(solution);
    });
    
    // Display result
    const panel = vscode.window.createWebviewPanel(
      'erdDiagram',
      `ERD: ${selected.label}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    
    panel.webview.html = getMermaidWebview(erd);
    
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to generate ERD: ${error.message}`);
  }
}

function getMermaidWebview(mermaidCode: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true });</script>
</head>
<body>
  <div class="mermaid">
${mermaidCode}
  </div>
</body>
</html>`;
}
```

## Configuration Options

### ERDGenerator Options

```typescript
{
  format: 'mermaid' | 'plantuml' | 'graphviz',
  includeAttributes: boolean,      // Default: true
  includeRelationships: boolean,   // Default: true
  maxAttributesPerTable: number    // Default: 10, 0 = all
}
```

### User Preferences

Consider adding VS Code settings for user customization:

```json
{
  "dvdt.erd.format": "mermaid",
  "dvdt.erd.includeAttributes": true,
  "dvdt.erd.includeRelationships": true,
  "dvdt.erd.maxAttributesPerTable": 10
}
```

## Error Handling

```typescript
try {
  const solution = await client.fetchSolution(solutionName);
  // ... generate ERD
} catch (error) {
  if (error.message.includes('401') || error.message.includes('403')) {
    vscode.window.showErrorMessage('Authentication failed. Please reconnect to Dataverse.');
  } else if (error.message.includes('not found')) {
    vscode.window.showErrorMessage(`Solution '${solutionName}' not found.`);
  } else {
    vscode.window.showErrorMessage(`Error: ${error.message}`);
  }
}
```

## Performance Considerations

- **Solution size**: Large solutions with many tables may take time to fetch
- **Show progress**: Always use `vscode.window.withProgress` for long operations
- **Caching**: Consider caching solution metadata to avoid repeated API calls
- **Pagination**: The DataverseClient handles pagination internally

## Testing

For testing during development, you can use the standalone examples:

```bash
# Set environment variables
export DATAVERSE_URL=https://your-org.crm.dynamics.com
export DATAVERSE_TOKEN=your-token
export SOLUTION_NAME=YourSolution

# Run the standalone example
npx ts-node packages/erd-generator/example-standalone.ts
```

## Additional Resources

- [Dataverse Web API Reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview)
- [Mermaid Documentation](https://mermaid.js.org/)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
