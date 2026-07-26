# Dataverse ERD Generator

A PowerPlatform ToolBox tool for loading Dataverse solutions into a graph-first ERD editor, applying in-memory schema changes, and exporting diagrams in multiple formats.

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and building
- ✅ Access to ToolBox API via `window.toolboxAPI`
- ✅ Dataverse connection and authentication
- ✅ Multiple ERD formats: Flow, Mermaid, PlantUML, Draw.io
- ✅ Graph-first relationship canvas with pan/zoom/drag, fit/reset view and auto-layout controls
- ✅ Visual diagram rendering (Mermaid, PlantUML, Draw.io)
- ✅ Configurable output (attributes, relationships, changed-only filtering)
- ✅ Export modes: Text, Visual, Both
- ✅ Flow export support with visual-first behavior
- ✅ Interactive UI with solution selection
- ✅ In-memory ERD editing (add/rename tables, add/rename attributes, add relationships)
- ✅ Change highlighting, changed-only filtering, undo/redo, and publish review flow
- ✅ Session save/load and JSON file sharing (export/import session)

## Installation

Install dependencies:

```bash
npm install
```

## Development

Run development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Usage in ToolBox

1. Build the tool:

    ```bash
    npm run build
    ```

2. The built files will be in the `dist/` directory:
    - `index.html` - Main entry point
    - `index.js` - Bundled application
    - `index.css` - Compiled styles

3. Install the tool in PowerPlatform ToolBox through the UI or programmatically

## Key Concepts

### ToolBox API Integration

The tool integrates with PowerPlatform ToolBox via `window.toolboxAPI`:

```typescript
// Get connection context
const context = await window.toolboxAPI.getToolContext();

// Show notification
await window.toolboxAPI.showNotification({
    title: "Success",
    body: "ERD generated successfully",
    type: "success",
});

// Save file
await window.toolboxAPI.saveFile(fileName, content);

// Copy to clipboard
await window.toolboxAPI.copyToClipboard(text);
```

**Important**: The tool must listen for `TOOLBOX_CONTEXT` via `postMessage` from the parent window. This provides connection information when the tool is loaded in a webview.

### React Hooks

The tool demonstrates:

- `useState` for managing component state
- `useEffect` for initialization and side effects
- Type-safe event handling with TypeScript
- Dataverse API integration

### ERD Generation

Supports four formats:

1. **Flow** - Interactive graph/canvas representation
2. **Mermaid** - Visual diagrams with interactive rendering
3. **PlantUML** - Text-based UML diagrams
4. **Draw.io** - XML format for diagrams.net/draw.io

Configuration options:

- Include/exclude attributes
- Include/exclude relationships
- Changed-only filtering for graph inspection

Export options:

- **Text**: download/copy textual source for selected diagram format
- **Visual**: export visual artifact
- **Both**: export text + visual together

Flow behavior:

- When format is **Flow**, visual export is used (canvas snapshot / flow visual artifact)
- Session data can be shared as JSON files (no link-based sharing)

### Styling

Uses CSS with modern features:

- CSS Grid for layouts
- Flexbox for alignment
- Gradient backgrounds
- Responsive design
- Clean, professional UI

## TypeScript

Full TypeScript support with:

- Type declarations for ToolBox API
- Strict type checking
- Modern ES2020 features
- React JSX types
- Dataverse API types

## Building Diagrams

The tool:

1. Connects to Dataverse using provided credentials
2. Lists available solutions
3. Fetches solution metadata (tables, attributes, relationships)
4. Loads schema into an interactive graph editor (default view)
5. Applies in-memory edits with visual change tracking
6. Generates diagrams in selected export format
7. Renders visual preview (Flow, Mermaid, PlantUML, Draw.io) or shows source code
8. Exports using Text / Visual / Both modes
9. Saves/loads sessions locally and supports JSON session share/import

## Configuration Options

The tool provides several configuration options:

- **Output Format**: Choose between Flow, Mermaid, PlantUML, or Draw.io
- **Include Attributes**: Show/hide table columns in the diagram
- **Include Relationships**: Show/hide relationships between tables
- **Changed-only in Graph**: Focus graph on changed tables/entities
- **Impact Markers**: Highlight impact level in graph nodes
- **Export Mode**: Text, Visual, or Both

## Output Formats

### Flow

- Native interactive graph representation
- Best for editing, validating relationships, and visual-first export
- Supports pan/zoom/drag and auto-layout controls

### Mermaid

- Modern, declarative diagram syntax
- Visual preview available in the tool
- Great for documentation and GitHub

### PlantUML

- Widely supported UML format
- Can be rendered by many tools
- Standard UML notation

### Draw.io

- Native diagrams.net/draw.io XML format
- Visual preview using embedded draw.io viewer
- Can be opened directly in draw.io web or desktop app
- mxGraph-based format with entity-relationship notation
- Tables displayed with attributes and relationships
- Entities positioned in an organized grid layout

## Session Management

- Save the current working session locally by name
- Load a previously saved session
- Share sessions by exporting a JSON file
- Import shared sessions from JSON files

## Troubleshooting

### Build Issues

If builds fail, try:

```bash
# Clean build artifacts
rm -rf dist node_modules
npm install
npm run build
```

### ToolBox Integration Issues

Check:

1. `window.toolboxAPI` is available
2. Console logs for TOOLBOX_CONTEXT messages
3. Connection context is being received
4. Network requests are successful

## Contributing

Contributions are welcome! When contributing:

1. Maintain PPTB integration patterns
2. Keep webview bundle browser-only (no Node.js dependencies)
3. Test in PowerPlatform ToolBox
4. Update documentation as needed
5. Follow existing code style

## License

This project is licensed under the GPL-2.0 License - see the [LICENSE](../../LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/Power-Maverick/PPTB-Tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Power-Maverick/PPTB-Tools/discussions)
