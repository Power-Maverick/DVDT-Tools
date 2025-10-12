# DVDT-Tools

Tools that can be integrated with Dataverse DevTools VS Code extension.

## Overview

This is a monorepo containing various tools for working with Microsoft Dataverse and Power Platform.

## Tools

### [@dvdt-tools/erd-generator](./tools/erd-generator)

Generate Entity Relationship Diagrams (ERD) from Dataverse solutions. Designed as a **VS Code WebView panel** for seamless integration with Dataverse DevTools (DVDT).

**Key Features:**
- **VS Code WebView Panel Integration**: Call one function to show the panel - no command registration needed
- **Self-Contained UI**: Complete webview HTML with modern dropdown controls and configuration options
- **Minimal DVDT Integration**: DVDT only provides environment URL and token - ERD tool handles everything else
- Fetch solution metadata automatically from Dataverse
- Multiple output formats: Mermaid, PlantUML, Graphviz DOT
- Download diagrams as source code or copy to clipboard
- User-configurable options (include attributes, relationships, max attributes)

**DVDT Integration (Simple Function Call):**
```typescript
import { showERDPanel } from '@dvdt-tools/erd-generator';

// Just call this when you want to show the ERD panel
showERDPanel(context.extensionUri, environmentUrl, accessToken);
```

See [VSCODE_INTEGRATION.md](./VSCODE_INTEGRATION.md) for complete WebView integration guide.

**Local Testing:**

Want to test the ERD tool with a local copy of Dataverse DevTools? See [LOCAL_TESTING.md](./LOCAL_TESTING.md) for step-by-step instructions on setting up local development and testing.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
npm install
```

### Building

Build all tools:

```bash
npm run build
```

### Development

Watch mode for development:

```bash
cd tools/erd-generator
npm run dev
```

## Repository Structure

```
DVDT-Tools/
├── tools/
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
