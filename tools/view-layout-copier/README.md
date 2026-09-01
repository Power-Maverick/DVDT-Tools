# View Layout Copier

Copy the layout of one Dataverse view to multiple other views of the same table in a single operation.

## Table of Contents

- [View Layout Copier](#view-layout-copier)
    - [UI Preview](#ui-preview)
    - [Features](#features)
    - [Installation](#installation)
    - [Development](#development)
    - [Usage in ToolBox](#usage-in-toolbox)
    - [Key Concepts](#key-concepts)
        - [Layout Components](#layout-components)
        - [Copy Options](#copy-options)
        - [Smart Query Merging](#smart-query-merging)
    - [Technical Stack](#technical-stack)
    - [Troubleshooting](#troubleshooting)
    - [Contributing](#contributing)
    - [License](#license)
    - [Support](#support)

## UI Preview

![View Layout Copier demo](/assets/viewLayoutCopier.gif)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and optimized builds
- ✅ Copy layout from one view to multiple target views
- ✅ Support for system views and personal views
- ✅ Solution-based table filtering
- ✅ Searchable table list (display name and schema name)
- ✅ View type badges (Public, Personal, Lookup, etc.)
- ✅ Source layout preview (columns, order, widths, sort)
- ✅ Selective copy options (layout, sort, components)
- ✅ Smart FetchXML query merging
- ✅ Lookup view safety validation
- ✅ Single-operation publish
- ✅ Real-time progress tracking
- ✅ Theme-aware dark/light mode support

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

4. Use View Layout Copier:
    - Select a solution (or work across all tables)
    - Choose a source table from the searchable list
    - Select the source view to copy layout from
    - Preview the source layout (columns, order, widths)
    - Check target views to receive the layout
    - Adjust copy options as needed
    - Click Copy & publish to apply changes

## Key Concepts

### Layout Components

A view layout consists of:

- **Column Layout**: Order, display names, and column widths
- **Sort Order**: Primary and secondary sorting criteria
- **Components Configuration**: Custom controls and grid components
- **Filters**: Not copied—target views keep their existing filters

The tool preserves all configuration except filters, which remain unchanged on target views.

### Copy Options

Choose what to copy during the operation:

- **Column Layout** (enabled by default): Columns, order, and widths
- **Sort Order** (enabled by default): Replaces target sort criteria
- **Components Configuration** (enabled by default): Custom controls and grid components

Note: Components configuration is skipped for Quick Find, Lookup, Advanced Find, and personal views.

### Smart Query Merging

When copying layout:

- Attributes referenced by the source layout are automatically added to the target's FetchXML
- Related-table (link-entity) columns are carried over without their filters
- Each target view retains its own filter logic
- Single publish operation applies all changes at once

Safety checks prevent breaking lookup views by validating primary name column positioning.

## Technical Stack

- **React 18** with TypeScript
- **Vite** for fast development and optimized production builds
- **Fluent UI React Components** for modern UI
- **PPTB API** for all Dataverse operations
- **@pptb/types** - PPTB type definitions

## Troubleshooting

### Copy Operation Fails

**Issue**: Error when copying layout to target views

**Solution**:

- Verify source view is fully loaded
- Check target views are editable (unmanaged)
- Ensure all target views are the same entity type
- Try copying to fewer views at once

### Layout Not Applied

**Issue**: Source layout doesn't appear on target views

**Solution**:

- Verify copy options are correctly enabled
- Check target views are published successfully
- Refresh target views in Power Apps
- Review console for error messages

### Sort Order Not Copied

**Issue**: Sort order from source view not applied

**Solution**:

- Verify "Sort order" option is enabled
- Check source view has defined sort criteria
- Ensure target views don't have conflicting sorts
- Try copying sort separately from layout

### Filters Appearing on Target

**Issue**: Source filters appear on target views

**Solution**:

- Filters are intentionally NOT copied
- Clear target view filters manually if needed
- This behavior prevents unintended filtering
- Use Smart Query Merging for attribute handling only

### Component Configuration Issues

**Issue**: Custom controls don't copy correctly

**Solution**:

- Verify source and target support components
- Check component configuration is enabled
- Note: Components skipped for Quick Find, Lookup, Advanced Find views
- Try copying layout and components separately

## Best Practices

1. **Test First**: Copy to one test view before batch copying
2. **Verify Source**: Preview source layout before copying
3. **Batch Carefully**: Copy to related views (same entity, same purpose)
4. **Document Changes**: Keep notes of what was copied and when
5. **Backup Views**: Export view definitions before major changes

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
