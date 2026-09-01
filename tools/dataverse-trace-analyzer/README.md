# Dataverse Trace Analyzer

Analyze and view Plugin Trace Logs from Microsoft Dataverse with filtering, search, and detailed inspection capabilities.

## Table of Contents

- [Dataverse Trace Analyzer](#dataverse-trace-analyzer)
    - [UI Preview](#ui-preview)
    - [Features](#features)
    - [Installation](#installation)
    - [Development](#development)
    - [Usage in ToolBox](#usage-in-toolbox)
    - [Key Concepts](#key-concepts)
        - [Plugin Trace Logs](#plugin-trace-logs)
        - [Correlation ID](#correlation-id)
        - [Filtering](#filtering)
    - [Technical Stack](#technical-stack)
    - [Troubleshooting](#troubleshooting)
    - [Contributing](#contributing)
    - [License](#license)
    - [Support](#support)

## UI Preview

![Dataverse Trace Analyzer demo](/assets/traceAnalyzer.gif)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and optimized builds
- ✅ View all plugin trace logs from Dataverse
- ✅ Smart filtering by message name, entity, and correlation ID
- ✅ Search and filter by exception status
- ✅ Detailed trace log inspection
- ✅ Delete individual or multiple trace logs
- ✅ Real-time data refresh
- ✅ Modern, minimalist UI with no unnecessary chrome
- ✅ Correlation ID tracking for related operations
- ✅ Performance metrics display (execution duration)
- ✅ Direct integration with Dataverse API

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

4. Open Dataverse Trace Analyzer in PPTB:
    - Connects to your active Dataverse environment automatically
    - Loads the latest 100 plugin trace logs
    - Use filter controls to narrow down results
    - Click on any log to view full details
    - Delete logs when no longer needed

## Key Concepts

### Plugin Trace Logs

Plugin Trace Logs (`plugintracelog` entity) are records created by Dataverse when plugin tracing is enabled. They capture:

- Plugin or custom workflow activity execution details
- Performance metrics (execution duration)
- Message block content
- Exception information when errors occur
- Context information (depth, correlation ID, operation type)

### Correlation ID

A unique identifier that links related plugin executions together, helping you trace the full sequence of operations triggered by a single user action. Use it to follow the complete flow of a business process.

### Filtering

The tool provides multiple filter options:

- **Message Name**: Filter by operation (e.g., "Create", "Update", "Delete")
- **Entity Name**: Filter by table/entity (e.g., "account", "contact")
- **Correlation ID**: Find all operations related to a single transaction
- **Exceptions Only**: Show only failed executions with errors

## Technical Stack

- **React 18** with TypeScript
- **Vite** for fast development and optimized production builds
- **PPTB API** for all Dataverse operations
- **@pptb/types** - PPTB type definitions

## Troubleshooting

### No Trace Logs Appearing

**Issue**: Tool loads but no plugin trace logs are displayed

**Solution**:

- Verify plugin tracing is enabled in your Dataverse environment
- Check that you have appropriate permissions to read plugin trace logs
- Try clicking "Refresh" to reload the data
- Check that your connection context is correct

### Filter Not Working

**Issue**: Filters don't seem to reduce the results

**Solution**:

- Ensure filter values match actual data (case-sensitive for some fields)
- Clear filters and try filtering by one criterion at a time
- Use "Refresh" after changing filters
- Verify trace logs exist with the values you're filtering on

### Cannot Delete Logs

**Issue**: Delete button is disabled or operation fails

**Solution**:

- Verify you have appropriate Dataverse permissions
- Check that you have sufficient quota for delete operations
- Try deleting a single log instead of bulk operation
- Review security roles for "Delete" permission on plugintracelog

### Performance Issues

**Issue**: Tool is slow loading or displaying logs

**Solution**:

- Use filters to reduce the number of logs displayed
- Clear older logs periodically to reduce query time
- Check your Dataverse environment performance
- Try refreshing the tool

## Best Practices

1. **Regular Cleanup**: Delete old trace logs regularly to maintain performance
2. **Use Filters**: Use message/entity filters to find relevant logs quickly
3. **Correlation ID**: Use correlation IDs to trace related operations
4. **Review Exceptions**: Focus on exception logs to identify errors
5. **Performance Monitoring**: Check execution duration to identify slow plugins

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

## License

GPL-2.0
