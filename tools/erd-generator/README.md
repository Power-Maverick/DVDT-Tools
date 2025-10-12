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
