# ERD Generator for Dataverse

Generate Entity Relationship Diagrams (ERD) from Dataverse solutions. Designed as a **VS Code WebView panel** for seamless integration with Dataverse DevTools (DVDT).

## Features

- **🎨 VS Code WebView Panel**: Complete UI that integrates into DVDT
- **Minimal Integration**: DVDT provides environment URL and token - ERD tool handles everything else
- **Fetch metadata automatically**: Retrieve solution, table, attribute, and relationship metadata from Dataverse
- Generate ERD from Dataverse solution metadata
- Support for multiple diagram formats:
  - Mermaid
  - PlantUML
  - Graphviz DOT
- Configurable output:
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

**Minimal integration - ~10 lines of code:**

```typescript
import { registerERDTool } from '@dvdt-tools/erd-generator';

// In DVDT's activate function
registerERDTool(context, {
  getEnvironmentUrl: () => dvdtConfig.getCurrentEnvironment(),
  getAccessToken: () => dvdtAuth.getAccessToken()
});
```

That's it! The ERD tool will:
- Open as a panel when commanded
- List all solutions from the environment
- Allow users to select and generate ERDs
- Handle downloading and copying
- Provide a complete UI experience

See [../../VSCODE_INTEGRATION.md](../../VSCODE_INTEGRATION.md) for complete integration guide.

## API

### registerERDTool()

Registers the ERD tool command in DVDT.

**Parameters:**
- `context: vscode.ExtensionContext` - VS Code extension context
- `credentialProvider: object` - Object with two functions:
  - `getEnvironmentUrl(): string | Promise<string>` - Returns Dataverse environment URL
  - `getAccessToken(): string | Promise<string>` - Returns access token

**Example:**
```typescript
registerERDTool(context, {
  getEnvironmentUrl: () => dvdtConfig.getCurrentEnvironment(),
  getAccessToken: () => dvdtAuth.getAccessToken()
});
```

### ERDToolPanel

The WebView panel class that manages the ERD UI. Typically you don't need to use this directly - use `registerERDTool()` instead.

**Method:**
- `ERDToolPanel.createOrShow(extensionUri, environmentUrl, accessToken)` - Creates or shows the panel

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
