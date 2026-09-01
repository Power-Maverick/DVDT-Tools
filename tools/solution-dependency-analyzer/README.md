# Solution Dependency Analyzer

Analyze and visualize Dataverse solution dependencies with circular dependency detection and comprehensive reporting.

## Table of Contents

- [Solution Dependency Analyzer](#solution-dependency-analyzer)
    - [Table of Contents](#table-of-contents)
    - [Features](#features)
    - [Installation](#installation)
    - [Development](#development)
    - [Usage in ToolBox](#usage-in-toolbox)
    - [Key Concepts](#key-concepts)
        - [Dependency Analysis](#dependency-analysis)
        - [Visualization Modes](#visualization-modes)
        - [Circular Dependencies](#circular-dependencies)
    - [Technical Stack](#technical-stack)
    - [Troubleshooting](#troubleshooting)
        - [Analysis Fails or Hangs](#analysis-fails-or-hangs)
        - [Missing Components in Results](#missing-components-in-results)
        - [Export Issues](#export-issues)
        - [Circular Dependency Detection Issues](#circular-dependency-detection-issues)
    - [Best Practices](#best-practices)
    - [Contributing](#contributing)
    - [License](#license)
    - [Support](#support)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and optimized builds
- ✅ Comprehensive dependency scanning (all component types)
- ✅ Direct and indirect dependency detection
- ✅ Circular dependency chain detection and reporting
- ✅ Missing reference highlighting
- ✅ Multiple visualization modes (Tree, Graph, Summary)
- ✅ Interactive hierarchical radial graph layout
- ✅ Advanced filtering and search capabilities
- ✅ Component type breakdown with visual indicators
- ✅ Complexity scoring algorithm
- ✅ Export capabilities (CSV and JSON)
- ✅ Real-time analysis with progress tracking

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

3. Install the tool in Power Platform ToolBox through the UI

4. Use Solution Dependency Analyzer:
    - Select a solution to analyze
    - Click "Analyze Dependencies" to scan
    - View results in Tree, Graph, or Summary mode
    - Use filters to focus on specific components
    - Export results to CSV or JSON

## Key Concepts

### Dependency Analysis

The tool scans all solution components and identifies:

- **Direct Dependencies**: Components directly referenced by a component
- **Indirect Dependencies**: Components referenced through other components
- **Dependent By**: Components that reference the selected component
- **Circular Dependencies**: Chains where component A depends on B, B depends on C, and C depends on A

This helps identify:

- Unused components (no dependencies)
- Highly coupled components (many dependencies)
- Risk factors before deleting components

### Visualization Modes

- **Tree View**: List-based hierarchical view with filtering and search
- **Graph View**: Interactive radial layout showing dependency layers
- **Summary Report**: Statistical overview and top components

Each mode provides different insights into your solution structure.

### Circular Dependencies

Circular dependencies occur when components form dependency loops, which can cause issues during deployment or operations. The tool:

- Detects circular dependency chains
- Highlights affected components in red
- Provides chain details for investigation
- Helps plan refactoring to break cycles

## Technical Stack

- **React 18** with TypeScript
- **Vite** for fast development and optimized production builds
- **Fluent UI React Components** for modern UI
- **PPTB API** for all Dataverse operations
- **@pptb/types** - PPTB type definitions

## Troubleshooting

### Analysis Fails or Hangs

**Issue**: Analysis takes a long time or fails to complete

**Solution**:

- Try analyzing a smaller solution first
- Check Dataverse environment performance
- Review browser console for errors
- Try refreshing and analyzing again

### Missing Components in Results

**Issue**: Known components don't appear in analysis

**Solution**:

- Verify components are part of the selected solution
- Check Dataverse connection is working
- Ensure you have permissions to read component metadata
- Try analyzing solution again

### Export Issues

**Issue**: Export to CSV or JSON fails

**Solution**:

- Verify browser allows file downloads
- Check disk space for file size
- Try exporting smaller result sets first
- Review console for detailed error messages

### Circular Dependency Detection Issues

**Issue**: Circular dependencies don't appear to be detected

**Solution**:

- Verify solution contains the circular components
- Check component references are complete
- Try refreshing analysis
- Review component dependency chains manually

## Best Practices

1. **Analyze Before Deletion**: Always analyze before removing components
2. **Break Cycles**: Refactor to eliminate circular dependencies
3. **Document Structure**: Export results for documentation
4. **Regular Audits**: Periodically analyze to identify coupling
5. **Plan Migrations**: Use analysis to plan safer solutions

## Contributing

Contributions are welcome! When contributing:

1. Maintain PPTB integration patterns
2. Keep webview bundle browser-only (no Node.js dependencies)
3. Test in Power Platform ToolBox
4. Update documentation as needed
5. Follow existing code style

## License

This project is licensed under the GPL-2.0 License - see the [LICENSE](../../LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/Power-Maverick/PPTB-Tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Power-Maverick/PPTB-Tools/discussions)
