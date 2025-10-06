# DVDT-Tools

Tools that can be integrated with Dataverse DevTools VS Code extension.

## Overview

This is a monorepo containing various tools for working with Microsoft Dataverse and Power Platform.

## Packages

### [@dvdt-tools/erd-generator](./packages/erd-generator)

Generate Entity Relationship Diagrams (ERD) from Dataverse solutions. Designed as a **VS Code WebView panel** for seamless integration with Dataverse DevTools (DVDT).

**Key Features:**
- **VS Code WebView Panel Integration**: Embeddable panel for DVDT with ~10 lines of integration code
- **Self-Contained UI**: Complete webview HTML that runs in VS Code panels with VS Code theming
- **Minimal DVDT Integration**: DVDT only provides environment URL and token - ERD tool handles everything else
- Fetch solution metadata automatically from Dataverse
- Multiple output formats: Mermaid, PlantUML, Graphviz DOT
- Download diagrams as source code or copy to clipboard

**DVDT Integration (WebView Panel):**
```typescript
import { registerERDTool } from '@dvdt-tools/erd-generator';

registerERDTool(context, {
  getEnvironmentUrl: () => dvdtConfig.getCurrentEnvironment(),
  getAccessToken: () => dvdtAuth.getAccessToken()
});
```

See [VSCODE_INTEGRATION.md](./VSCODE_INTEGRATION.md) for complete WebView integration guide.

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
