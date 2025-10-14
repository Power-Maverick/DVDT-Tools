# create-dvdt-tool

Scaffolding tool for creating new DVDT (Dataverse DevTools) tools.

## Description

This package provides an `npx` command that scaffolds a complete tool structure based on the existing erd-generator tool. It creates all necessary files and folders, making it easy to start developing new tools for the DVDT ecosystem.

## Usage

Run the following command from the root of the DVDT-Tools repository:

```bash
npx create-dvdt-tool
```

Or use it directly with npm:

```bash
npm create dvdt-tool
```

The command will interactively prompt you for:
- **Tool name**: The name of your tool (e.g., `my-tool`, `code-analyzer`)
- **Description**: A brief description of what your tool does
- **Author**: The author name (defaults to "Power-Maverick")

## What Gets Created

The scaffolding creates a complete tool structure under `tools/<your-tool-name>/` with:

### Directory Structure
```
tools/<your-tool-name>/
├── src/
│   ├── components/        # Core business logic components
│   ├── dvdtIntegration/   # VS Code WebView integration
│   ├── models/            # TypeScript interfaces and types
│   ├── utils/             # Dataverse client and utilities
│   └── index.ts           # Main exports
├── ui/
│   └── webview.html       # WebView UI template
├── docs/
│   └── Getting_Started.md # Documentation
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript config for extension
├── tsconfig.webview.json  # TypeScript config for webview
├── webpack.config.js      # Webpack config for webview bundling
├── .npmignore            # npm ignore rules
└── README.md              # Tool-specific README
```

### Generated Files

- **package.json**: Configured with build scripts, dependencies, and workspace settings
- **TypeScript configs**: Separate configs for extension code and webview code
- **Webpack config**: Set up to bundle the webview JavaScript
- **Source files**: Template implementations for:
  - Main component with business logic
  - Dataverse client for API communication
  - VS Code integration for showing the webview panel
  - Webview script for UI interaction
- **UI template**: Basic HTML template with VS Code theming
- **Documentation**: Getting started guide

## Next Steps After Scaffolding

After the tool is created, follow these steps:

```bash
cd tools/<your-tool-name>
npm install
npm run build
```

### Development

Run in watch mode for continuous rebuilding:

```bash
npm run dev
```

### Customization

1. Edit `src/components/ToolComponent.ts` for your core business logic
2. Update `src/dvdtIntegration/webview.ts` for webview behavior
3. Modify `ui/webview.html` for your UI layout and styling
4. Add utilities in `src/utils/` as needed
5. Update the README.md with tool-specific documentation

## Integration with DVDT

To integrate your new tool with the Dataverse DevTools extension:

```typescript
import { showPanel } from '<your-package-name>';

// Call when you want to show the panel
showPanel(context.extensionUri, environmentUrl, accessToken);
```

## Features of Generated Tools

Each generated tool includes:

- ✅ VS Code WebView Panel integration
- ✅ Dataverse API client ready to use
- ✅ TypeScript with strict type checking
- ✅ Webpack bundling for webview
- ✅ Separate build configs for extension and webview
- ✅ Development watch mode
- ✅ VS Code theming support
- ✅ Message passing between extension and webview
- ✅ Template documentation

## Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0
- Must be run from the root of a DVDT-Tools repository

## License

GPL-2.0
