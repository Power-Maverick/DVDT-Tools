# Plugin Registration

Register and manage Microsoft Dataverse plugin assemblies, custom workflow activities, SDK message processing steps, service endpoints, and webhooks.

## Table of Contents

- [Plugin Registration](#plugin-registration)
    - [UI Preview](#ui-preview)
    - [Features](#features)
    - [Installation](#installation)
    - [Development](#development)
    - [Usage in ToolBox](#usage-in-toolbox)
    - [Key Concepts](#key-concepts)
        - [Plugin Assemblies](#plugin-assemblies)
        - [SDK Message Processing Steps](#sdk-message-processing-steps)
        - [Service Endpoints](#service-endpoints)
    - [Technical Stack](#technical-stack)
    - [Troubleshooting](#troubleshooting)
    - [Contributing](#contributing)
    - [License](#license)
    - [Support](#support)

## UI Preview

![Plugin Registration demo](/assets/pluginRegistration.gif)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and optimized builds
- ✅ Register, update, and unregister plugin assemblies
- ✅ Manage SDK Message Processing Steps with full configuration
- ✅ Step Images support (pre/post entity images)
- ✅ Enable/disable steps without removal
- ✅ Service Endpoint Management (9 contract types supported)
- ✅ Webhook management with multiple auth types
- ✅ Custom workflow activities support
- ✅ Hierarchical tree view UI for organization
- ✅ Plugins/Endpoints filtering and toggling
- ✅ Dark/light theme support
- ✅ Unsecure and Secure Config management

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

4. Use Plugin Registration:
    - Register plugin assemblies by uploading .dll files
    - Configure SDK Message Processing Steps
    - Register pre/post entity images
    - Manage service endpoints and webhooks
    - Enable/disable steps for testing

## Key Concepts

### Plugin Assemblies

Plugin assemblies are compiled .NET libraries (.dll files) that implement the Dataverse plugin interface. The tool allows you to:

- **Register**: Upload a new assembly from your development environment
- **Update**: Replace an existing assembly with a new version
- **Unregister**: Remove an assembly (and its components)
- **View Types**: See all plugin classes available in the assembly

### SDK Message Processing Steps

SDK Message Processing Steps (plugin steps) bind your plugin code to specific Dataverse messages and events:

- **Message**: The Dataverse operation (Create, Update, Delete, etc.)
- **Entity**: The table the message applies to
- **Stage**: Pre-operation (before the transaction) or Post-operation (after)
- **Execution Mode**: Synchronous or Asynchronous
- **Unsecure Config**: Non-sensitive configuration passed to the plugin
- **Secure Config**: Sensitive configuration (encrypted in Dataverse)

### Service Endpoints

Service Endpoints allow Dataverse to call external systems when events occur. Supported types:

- **REST**: HTTP POST to a custom endpoint
- **Webhook**: Secure webhook with authentication
- **Service Bus**: Azure Service Bus (One Way, Queue, Topic)
- **Event Hub**: Azure Event Hub
- **Event Grid**: Azure Event Grid

## Technical Stack

- **React 18** with TypeScript
- **Vite** for fast development and optimized production builds
- **Fluent UI React Components** for modern UI
- **PPTB API** for all Dataverse operations
- **@pptb/types** - PPTB type definitions

## Troubleshooting

### Assembly Upload Fails

**Issue**: Cannot upload or register plugin assembly

**Solution**:

- Verify .dll file is built against the correct Dataverse SDK version
- Check that you have appropriate Dataverse permissions
- Ensure assembly implements IPlugin correctly
- Try uploading a smaller/simpler assembly first

### Step Registration Issues

**Issue**: Cannot register SDK Message Processing Step

**Solution**:

- Verify plugin assembly is registered first
- Check that entity and message are valid
- Ensure you have permissions on the plugin table
- Verify stage selection (Pre vs Post operation)

### Service Endpoint Issues

**Issue**: Cannot register or test service endpoint

**Solution**:

- Verify endpoint URL is accessible and valid
- Check authentication credentials are correct
- Test endpoint availability manually first
- Review webhook logs for failed deliveries

### Permission Issues

**Issue**: Operations fail with permission error

**Solution**:

- Verify you have system administrator or plugin registration admin role
- Check connection context is correct
- Ensure target organization is accessible
- Verify solution context is correct

## Best Practices

1. **Version Control**: Maintain version numbers for plugin assemblies
2. **Test Environments**: Always test plugins thoroughly before production
3. **Configuration**: Use Secure Config for sensitive data (API keys, passwords)
4. **Error Handling**: Implement comprehensive error handling in plugins
5. **Logging**: Use plugin trace logs for debugging
6. **Step Order**: Configure step execution order carefully
7. **Filtering**: Use step filtering to optimize performance

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

## Dataverse Entities Used

| Entity                                 | Purpose                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `pluginassembly`                       | Stores compiled assembly metadata and content            |
| `plugintype`                           | Stores plugin class information within an assembly       |
| `sdkmessageprocessingstep`             | Stores step configuration (message, entity, stage, mode) |
| `sdkmessageprocessingstepimage`        | Stores pre/post entity images for steps                  |
| `sdkmessage`                           | SDK messages (Create, Update, Delete, etc.)              |
| `sdkmessagefilter`                     | Entity-specific filters for messages                     |
| `serviceendpoint`                      | Stores webhook and Service Bus endpoint configuration    |
| `sdkmessageprocessingstepsecureconfig` | Stores secure configuration strings for steps            |

## Reference

- [Microsoft Plugin Registration Tool Docs](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/register-plug-in#about-the-plug-in-registration-tool)
- [PPTB Types Package](https://www.npmjs.com/package/@pptb/types)
