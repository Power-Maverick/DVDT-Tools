# ERD Generator for Dataverse

Generate Entity Relationship Diagrams (ERD) from Dataverse solutions. Works as a **standalone tool** that connects directly to Dataverse using an access token.

## Features

- **🌐 Web UI**: Interactive browser-based interface for generating ERDs
- **Standalone operation**: Connect directly to Dataverse with an access token
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
- **CLI tool** for command-line usage
- **Programmatic API** for integration with other tools
- **Download options**:
  - PNG images
  - SVG vectors
  - Source code (.mmd, .puml, .dot)

## Installation

```bash
npm install @dvdt-tools/erd-generator
```

## Integration with Dataverse DevTools

**Minimal integration - just 3 lines of code:**

```typescript
import { DataverseClient, ERDGenerator } from '@dvdt-tools/erd-generator';

// 1. Pass token from DVDT
const client = new DataverseClient({ environmentUrl, accessToken: token });

// 2. Fetch and generate
const solution = await client.fetchSolution('SolutionName');
const erd = new ERDGenerator({ format: 'mermaid' }).generate(solution);
```

See [example-minimal-integration.ts](./example-minimal-integration.ts) for a complete minimal example.

## Quick Start

### Web UI (Recommended)

The easiest way to use the ERD generator is through the web interface:

1. **Start the UI server**:
   ```bash
   npm run ui
   ```

2. **Open your browser** to `http://localhost:3000`

3. **Follow the steps in the UI**:
   - Enter your Dataverse environment URL
   - Paste your access token
   - Select a solution from the list
   - Generate and download your ERD

![ERD Generator Web UI](https://github.com/user-attachments/assets/2fcdbedc-d0c0-45fb-ac4c-1c24f6fa2ad4)

See the [UI Documentation](./ui/README.md) for more details.

## Usage

### Standalone Mode (with Dataverse Token)

The tool can connect directly to Dataverse and fetch solution metadata:

```typescript
import { DataverseClient, ERDGenerator } from '@dvdt-tools/erd-generator';

// Connect to Dataverse
const client = new DataverseClient({
  environmentUrl: 'https://your-org.crm.dynamics.com',
  accessToken: 'your-access-token',
  apiVersion: '9.2' // Optional, defaults to 9.2
});

// List available solutions
const solutions = await client.listSolutions();
console.log(solutions);

// Fetch a specific solution with all metadata
const solution = await client.fetchSolution('YourSolutionUniqueName');

// Generate ERD
const generator = new ERDGenerator({
  format: 'mermaid',
  includeAttributes: true,
  includeRelationships: true,
  maxAttributesPerTable: 10
});

const erd = generator.generate(solution);
console.log(erd);
```

### CLI Usage

The package includes a CLI tool for generating ERDs from the command line:

```bash
# List available solutions
erd-generator --url https://your-org.crm.dynamics.com \
              --token your-access-token \
              --list-solutions

# Generate ERD for a solution
erd-generator --url https://your-org.crm.dynamics.com \
              --token your-access-token \
              --solution YourSolutionName \
              --output diagram.mmd

# Generate PlantUML diagram
erd-generator --url https://your-org.crm.dynamics.com \
              --token your-access-token \
              --solution YourSolutionName \
              --format plantuml \
              --output diagram.puml

# Using environment variables
export DATAVERSE_URL=https://your-org.crm.dynamics.com
export DATAVERSE_TOKEN=your-access-token
export SOLUTION_NAME=YourSolutionName
erd-generator --output diagram.mmd
```

### Programmatic Mode (with Pre-fetched Data)

You can also use the tool with pre-fetched data (useful for testing or when data comes from another source):

```typescript
import { ERDGenerator, DataverseSolution } from '@dvdt-tools/erd-generator';

// Create sample solution data
const solution: DataverseSolution = {
  uniqueName: 'MySolution',
  displayName: 'My Solution',
  version: '1.0.0',
  publisherPrefix: 'myprefix',
  tables: [
    {
      logicalName: 'account',
      displayName: 'Account',
      schemaName: 'Account',
      primaryIdAttribute: 'accountid',
      primaryNameAttribute: 'name',
      tableType: 'Standard',
      attributes: [
        {
          logicalName: 'accountid',
          displayName: 'Account ID',
          type: 'guid',
          isPrimaryId: true,
          isPrimaryName: false,
          isRequired: true
        },
        {
          logicalName: 'name',
          displayName: 'Account Name',
          type: 'string',
          isPrimaryId: false,
          isPrimaryName: true,
          isRequired: true,
          maxLength: 160
        }
      ],
      relationships: []
    }
  ]
};

// Generate ERD in Mermaid format
const generator = new ERDGenerator({
  format: 'mermaid',
  includeAttributes: true,
  includeRelationships: true,
  maxAttributesPerTable: 10
});

const erd = generator.generate(solution);
console.log(erd);
```

## Output Formats

### Mermaid

Generates ERD in Mermaid syntax, which can be rendered in GitHub, VS Code, and many other tools.

### PlantUML

Generates ERD in PlantUML syntax for detailed UML diagrams.

### Graphviz

Generates ERD in Graphviz DOT format for flexible graph visualization.

## API

### DataverseClient

Connect to Dataverse and fetch solution metadata.

**Constructor:**
```typescript
new DataverseClient(config: DataverseConfig)
```

**Config options:**
- `environmentUrl`: Dataverse environment URL (e.g., https://org.crm.dynamics.com)
- `accessToken`: Access token for authentication (from Dataverse DevTools or Azure AD)
- `apiVersion`: API version (optional, defaults to '9.2')

**Methods:**
- `listSolutions()`: List all available solutions
- `fetchSolution(solutionUniqueName: string)`: Fetch complete solution metadata including tables, attributes, and relationships

### ERDGenerator

Constructor options:

- `format`: Output format ('mermaid' | 'plantuml' | 'graphviz')
- `includeAttributes`: Include table attributes in diagram (default: true)
- `includeRelationships`: Include relationships in diagram (default: true)
- `maxAttributesPerTable`: Maximum attributes to show per table (default: 10, 0 = all)

### Methods

- `generate(solution: DataverseSolution): string` - Generate ERD from solution

## Integration with Dataverse DevTools

This tool is designed to work seamlessly with the Dataverse DevTools VS Code extension:

1. **Get the access token** from Dataverse DevTools
2. **Pass it to DataverseClient** to fetch solution metadata
3. **Generate and display** the ERD in VS Code

Example integration:
```typescript
import { DataverseClient, ERDGenerator } from '@dvdt-tools/erd-generator';

// Token provided by Dataverse DevTools extension
const token = getTokenFromDevTools();

const client = new DataverseClient({
  environmentUrl: getCurrentEnvironmentUrl(),
  accessToken: token
});

const solution = await client.fetchSolution(selectedSolution);
const generator = new ERDGenerator({ format: 'mermaid' });
const erd = generator.generate(solution);

// Display in VS Code
showDiagram(erd);
```

## Authentication

The tool expects a valid Dataverse access token. You can obtain this token from:

- **Dataverse DevTools VS Code extension** - Recommended for VS Code integration
- **Azure AD authentication** - For standalone CLI usage
- **Power Platform CLI** - Using `pac auth list` and token extraction

The token should have appropriate permissions to read solution metadata from Dataverse.

## License

GPL-2.0
