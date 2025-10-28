# Dataverse ERD Generator

A PowerPlatform ToolBox tool for generating Entity Relationship Diagrams (ERD) from Dataverse solutions using React and Vite.

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and building
- ✅ Access to ToolBox API via `window.toolboxAPI`
- ✅ Dataverse connection and authentication
- ✅ Multiple ERD formats: Mermaid, PlantUML, Graphviz
- ✅ Visual Mermaid diagram rendering
- ✅ Configurable output (attributes, relationships, table limits)
- ✅ Export diagrams (download source files or copy to clipboard)
- ✅ Interactive UI with solution selection

## Structure

```
erd-generator/
├── src/
│   ├── App.tsx               # Main React component
│   ├── main.tsx              # Entry point
│   ├── styles.css            # Global styles
│   ├── components/
│   │   └── ERDGenerator.ts   # ERD generation logic
│   ├── models/
│   │   └── interfaces.ts     # TypeScript interfaces
│   └── utils/
│       └── DataverseClient.ts # Dataverse API client
├── index.html                # HTML template
├── vite.config.ts            # Vite configuration
├── package.json
├── tsconfig.json
└── README.md
```

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
  type: "success"
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

Supports three formats:

1. **Mermaid** - Visual diagrams with interactive rendering
2. **PlantUML** - Text-based UML diagrams
3. **Graphviz** - DOT language for graph visualization

Configuration options:
- Include/exclude attributes
- Include/exclude relationships
- Limit maximum attributes per table

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
4. Generates diagram in selected format
5. Renders visual preview (Mermaid) or shows source code
6. Allows export via download or clipboard

## Configuration Options

The tool provides several configuration options:

- **Output Format**: Choose between Mermaid, PlantUML, or Graphviz
- **Include Attributes**: Show/hide table columns in the diagram
- **Include Relationships**: Show/hide relationships between tables
- **Max Attributes**: Limit the number of attributes shown per table (0 = show all)

## Output Formats

### Mermaid
- Modern, declarative diagram syntax
- Visual preview available in the tool
- Great for documentation and GitHub

### PlantUML
- Widely supported UML format
- Can be rendered by many tools
- Standard UML notation

### Graphviz DOT
- Graph description language
- Powerful layout engines
- Flexible customization options

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

- **Issues**: [GitHub Issues](https://github.com/Power-Maverick/DVDT-Tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Power-Maverick/DVDT-Tools/discussions)
