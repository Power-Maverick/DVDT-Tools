# PCF Builder

Build and manage Power Apps Component Framework (PCF) custom controls using React and Vite.

## Table of Contents

- [PCF Builder](#pcf-builder)
    - [Table of Contents](#table-of-contents)
    - [Features](#features)
    - [Installation](#installation)
    - [Development](#development)
    - [Usage in ToolBox](#usage-in-toolbox)
    - [Key Concepts](#key-concepts)
        - [PCF Control Creation](#pcf-control-creation)
        - [ToolBox API Integration](#toolbox-api-integration)
    - [Technical Stack](#technical-stack)
    - [Troubleshooting](#troubleshooting)
        - [Build Fails](#build-fails)
        - [Control Not Loading](#control-not-loading)
        - [Solution Package Issues](#solution-package-issues)
        - [Permission Issues](#permission-issues)
    - [Best Practices](#best-practices)
    - [Contributing](#contributing)
    - [License](#license)
    - [Support](#support)
    - [Configuration Options](#configuration-options)
        - [Control Configuration](#control-configuration)
        - [Solution Configuration](#solution-configuration)
    - [Output Display](#output-display)
    - [Troubleshooting](#troubleshooting-1)
        - [Build Issues](#build-issues)
        - [PPTB Integration Issues](#pptb-integration-issues)
    - [Prerequisites](#prerequisites)
    - [Features Not Included](#features-not-included)
    - [Contributing](#contributing-1)
    - [License](#license-1)
    - [Support](#support-1)
    - [Reference](#reference)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and optimized builds
- ✅ Create new PCF controls with visual interface
- ✅ Edit existing PCF controls in your environment
- ✅ Support for Field and Dataset control templates
- ✅ Build and package PCF projects
- ✅ Solution package creation and publishing
- ✅ Integration with Fluent UI and React libraries
- ✅ Command execution and output display
- ✅ Full integration with Power Platform ToolBox API
- ✅ Support for both managed and unmanaged solutions
- ✅ Real-time validation and error reporting

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

4. Use PCF Builder:
    - Create new PCF controls with the visual interface
    - Edit existing controls in your environment
    - Build and test projects locally
    - Create solution packages for deployment

## Key Concepts

### PCF Control Creation

PCF (Power Apps Component Framework) controls enable custom functionality in model-driven apps and canvas apps. The tool supports creating:

- **Field Controls**: Display and edit data in a single field
- **Dataset Controls**: Display data in a grid or list format

When creating a control, specify:

- Namespace (your organization prefix)
- Control Name (technical identifier)
- Display Name (user-friendly name)
- Control Template (Field or Dataset)

### ToolBox API Integration

The tool integrates with Power Platform ToolBox API for:

- Project file management
- Terminal command execution
- Real-time output display
- Solution package handling
- Configuration management

Key API methods:

- `window.toolboxAPI.connections.getActiveConnection()` - Get active connection
- `window.toolboxAPI.terminal.executeCommand()` - Execute CLI commands
- `window.toolboxAPI.showNotification()` - Display notifications

## Technical Stack

- **React 18** with TypeScript
- **Vite** for fast development and optimized production builds
- **Fluent UI React Components** for modern, accessible UI
- **Power Apps CLI** for PCF operations
- **@pptb/types** - PPTB type definitions

## Troubleshooting

### Build Fails

**Issue**: npm run build fails with errors

**Solution**:

- Verify Node.js version (18+ required)
- Check package.json dependencies are installed
- Review error messages for missing dependencies
- Try npm install again

### Control Not Loading

**Issue**: PCF control not loading in test harness

**Solution**:

- Verify control is built correctly (npm run build)
- Check manifest.xml configuration
- Ensure control is registered in solution properly
- Review browser console for errors

### Solution Package Issues

**Issue**: Solution package creation fails

**Solution**:

- Verify all prerequisites are installed (Power Apps CLI)
- Check publisher name format (no spaces, special characters)
- Ensure solution folder structure is correct
- Try running pac solution init manually

### Permission Issues

**Issue**: Cannot modify solution or deploy control

**Solution**:

- Verify you have appropriate Dataverse permissions
- Check connection context is correct
- Ensure solution is unmanaged
- Verify publisher is in your organization

## Best Practices

1. **Namespace Convention**: Use your organization prefix (e.g., Contoso.Controls)
2. **Component Reusability**: Build controls as composable, testable components
3. **TypeScript**: Use strict typing for better code quality
4. **Testing**: Test controls thoroughly with sample data
5. **Documentation**: Document control purpose and configuration options
6. **Versioning**: Maintain version consistency with semantic versioning

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

## Configuration Options

### Control Configuration

- Namespace, name, display name, description
- Control type (standard/virtual)
- Template (field/dataset)
- Additional npm packages

### Solution Configuration

- Publisher name and prefix
- Publisher friendly name
- Solution version (auto-managed)

## Output Display

All command outputs are displayed in a formatted pre-block with:

- Syntax highlighting
- Scrollable area
- Copy-friendly formatting
- Clear success/error indication

## Troubleshooting

### Build Issues

If builds fail, ensure:

- Node.js and npm are installed
- Power Apps CLI (pac) is installed
- Project folder is valid
- All dependencies are installed

### PPTB Integration Issues

Check:

1. `window.toolboxAPI` is available
2. Tool is running inside PPTB
3. Active connection is established
4. File system permissions are granted

## Prerequisites

Before using this tool, ensure you have:

1. **Node.js & npm**: Install from [nodejs.org](https://nodejs.org/) (LTS version recommended)
2. **Power Apps CLI**: Download from [aka.ms/PowerAppsCLI](https://aka.ms/PowerAppsCLI)
3. **PowerPlatform ToolBox**: The tool is designed for PPTB environment

## Features Not Included

This tool provides a visual interface for PCF development but does NOT include:

- Direct code editing (use your preferred IDE)
- Visual Studio integration (use external tools)
- Direct deployment to environments (use PPTB deployment features)
- Property/resource management (edit manifest manually)

## Contributing

Contributions are welcome! When contributing:

1. Maintain PPTB-only integration patterns
2. Keep webview bundle browser-only (no Node.js dependencies)
3. Test in PowerPlatform ToolBox
4. Update documentation as needed
5. Follow existing code style

## License

This project is licensed under the GPL-2.0 License - see the [LICENSE](../../LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/Power-Maverick/PPTB-Tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Power-Maverick/PPTB-Tools/discussions)

## Reference

This tool is based on the PCF Custom Control Builder for XrmToolBox:

- Reference: [PCF-CustomControlBuilder](https://github.com/Power-Maverick/PCF-CustomControlBuilder)
- Adapted for PPTB with React + TypeScript + Vite stack
