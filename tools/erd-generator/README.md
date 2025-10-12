# ERD Generator for Dataverse

Generate Entity Relationship Diagrams (ERD) from Dataverse solutions. Designed as a **VS Code WebView panel** for seamless integration with Dataverse DevTools (DVDT).

## Features

- **🎨 VS Code WebView Panel**: Complete UI with modern dropdown controls and configuration options
- **Minimal Integration**: Just call one function - no command registration needed
- **Fetch metadata automatically**: Retrieve solution, table, attribute, and relationship metadata from Dataverse
- Generate ERD from Dataverse solution metadata
- Support for multiple diagram formats:
  - Mermaid
  - PlantUML
  - Graphviz DOT
- Configurable output (via UI):
  - Include/exclude attributes
  - Include/exclude relationships
  - Limit number of attributes per table
- **Download options**:
  - Source code (.mmd, .puml, .dot)
  - Copy to clipboard

## Installation

```bash
npm install @dvdt-tools/erd-generator
```

## Development & Testing

### Building the Project

The project uses a single unified build command that compiles both the extension code and webview bundle:

```bash
npm run build
```

This runs two build processes sequentially:
1. **TypeScript compiler (`tsc`)** - Compiles extension code for Node.js/VS Code environment
   - Compiles: `src/vscode-integration.ts`, `DataverseClient.ts`, `ERDGenerator.ts`, etc.
   - Output: `dist/src/*.js` files
   - Target: Node.js runtime (used by VS Code extension host)

2. **Webpack** - Bundles webview code for browser environment
   - Bundles: `src/webview.ts` with all dependencies (DataverseClient, ERDGenerator, Mermaid)
   - Output: `dist/webview/webview.js` (single bundled file)
   - Target: Browser runtime (runs in VS Code WebView panel)

**Why two separate build processes?**

We need both because the extension and webview run in different environments:
- **Extension code** runs in Node.js (VS Code extension host) and needs access to VS Code APIs
- **Webview code** runs in a browser context (Chrome-based webview) and needs all dependencies bundled together

The builds cannot be merged into a single tool because they target fundamentally different JavaScript runtimes.

### Standalone Testing (Without DVDT Integration)

You can test the ERD Generator without integrating it into DVDT:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Open the test page:**
   Open `packages/erd-generator/ui/test.html` in your browser

3. **Enter credentials:**
   - Environment URL: Your Dataverse environment (e.g., `https://contoso.crm.dynamics.com`)
   - Access Token: Your Dataverse access token

4. **Click "Load ERD Generator"** to test the full functionality

The standalone test page simulates VS Code's WebView environment and allows you to:
- List and select solutions
- Generate ERDs in all formats
- Test visual rendering (Mermaid)
- Download diagrams
- Copy to clipboard

## Integration with Dataverse DevTools

### VS Code WebView Panel Integration

**Simple function call - no command registration needed:**

```typescript
import { showERDPanel } from '@dvdt-tools/erd-generator';

// Call this when you want to show the ERD panel
showERDPanel(context.extensionUri, environmentUrl, accessToken);
```

**Complete example:**

```typescript
import { showERDPanel } from '@dvdt-tools/erd-generator';
import * as vscode from 'vscode';

// In your DVDT menu handler or button click
async function openERDGenerator() {
    try {
        const environmentUrl = dvdtConfig.getCurrentEnvironment();
        const accessToken = await dvdtAuth.getAccessToken();

        if (!environmentUrl || !accessToken) {
            vscode.window.showErrorMessage('Please connect to Dataverse first');
            return;
        }

        // Open ERD tool panel
        showERDPanel(context.extensionUri, environmentUrl, accessToken);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open ERD Generator: ${error.message}`);
    }
}
```

That's it! The ERD tool will:
- Open as a panel when called
- List all solutions in a dropdown control
- Allow users to select and generate ERDs
- Handle downloading and copying
- Provide a complete UI experience with configuration options

See [../../VSCODE_INTEGRATION.md](../../VSCODE_INTEGRATION.md) for complete integration guide.

## API

### showERDPanel()

Opens the ERD Generator panel in VS Code.

**Parameters:**
- `extensionUri: vscode.Uri` - VS Code extension URI from context
- `environmentUrl: string` - Dataverse environment URL
- `accessToken: string` - Dataverse access token

**Example:**
```typescript
showERDPanel(context.extensionUri, environmentUrl, accessToken);
```

### DataverseClient

Handles communication with Dataverse Web API.

**Constructor:**
```typescript
new DataverseClient({
  environmentUrl: string,
  accessToken: string,
  apiVersion?: string  // Optional, defaults to '9.2'
})
```

**Methods:**
- `listSolutions(): Promise<Solution[]>` - Lists all solutions
- `fetchSolution(uniqueName: string): Promise<DataverseSolution>` - Fetches complete solution metadata

### ERDGenerator

Generates ERD diagrams from solution metadata.

**Constructor:**
```typescript
new ERDGenerator({
  format: 'mermaid' | 'plantuml' | 'graphviz',
  includeAttributes?: boolean,      // Default: true
  includeRelationships?: boolean,   // Default: true
  maxAttributesPerTable?: number    // Default: 10, 0 = all
})
```

**Methods:**
- `generate(solution: DataverseSolution): string` - Generates ERD diagram

## Architecture

The ERD tool is self-contained:

```
DVDT Extension
    ↓ (provides credentials)
ERD Tool WebView Panel
    ↓ (uses)
DataverseClient → Dataverse Web API
    ↓ (fetches metadata)
ERDGenerator → Generates diagrams
```

## License

GPL-2.0
