# DVDT-Tools

Tools that can be integrated with Dataverse DevTools VS Code extension.

## Overview

This is a monorepo containing various tools for working with Microsoft Dataverse and Power Platform.

## Packages

### [@dvdt-tools/erd-generator](./packages/erd-generator)

Generate Entity Relationship Diagrams (ERD) from Dataverse solutions. Works as a **standalone tool** that connects directly to Dataverse using an access token.

**Key Features:**
- **Web UI**: Interactive browser-based interface for generating ERDs
- Standalone operation with Dataverse token authentication
- Fetch solution metadata automatically from Dataverse
- Multiple output formats: Mermaid, PlantUML, Graphviz DOT
- CLI tool for command-line usage
- Programmatic API for VS Code extension integration
- Download diagrams as PNG, SVG, or source code

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
npm install
```

### Building

Build all packages:

```bash
npm run build
```

### Development

Watch mode for development:

```bash
cd packages/erd-generator
npm run dev
```

## Repository Structure

```
DVDT-Tools/
├── packages/
│   └── erd-generator/       # ERD generation tool
│       ├── src/
│       │   ├── ERDGenerator.ts
│       │   ├── types.ts
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── package.json             # Root package with workspaces
├── tsconfig.json           # Shared TypeScript config
├── LICENSE
└── README.md
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the GPL-2.0 License - see the [LICENSE](LICENSE) file for details.
