# ERD Generator for Dataverse

Generate Entity Relationship Diagrams (ERD) from Dataverse solutions.

## Features

- Generate ERD from Dataverse solution metadata
- Support for multiple diagram formats:
  - Mermaid
  - PlantUML
  - Graphviz DOT
- Configurable output:
  - Include/exclude attributes
  - Include/exclude relationships
  - Limit number of attributes per table

## Installation

```bash
npm install @dvdt-tools/erd-generator
```

## Usage

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

### ERDGenerator

Constructor options:

- `format`: Output format ('mermaid' | 'plantuml' | 'graphviz')
- `includeAttributes`: Include table attributes in diagram (default: true)
- `includeRelationships`: Include relationships in diagram (default: true)
- `maxAttributesPerTable`: Maximum attributes to show per table (default: 10, 0 = all)

### Methods

- `generate(solution: DataverseSolution): string` - Generate ERD from solution

## License

GPL-2.0
