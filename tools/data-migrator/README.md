# Data Migrator

Migrate data from one Dataverse environment to another with intelligent auto-mapping and smart operations.

## Table of Contents

- [Data Migrator](#data-migrator)
    - [Table of Contents](#table-of-contents)
    - [UI Preview](#ui-preview)
    - [Features](#features)
    - [Installation](#installation)
    - [Development](#development)
    - [Usage in ToolBox](#usage-in-toolbox)
    - [Key Concepts](#key-concepts)
        - [Auto-Mapping](#auto-mapping)
        - [Migration Operations](#migration-operations)
        - [Lookup Field Handling](#lookup-field-handling)
    - [Technical Stack](#technical-stack)
    - [Configuration](#configuration)
        - [Filter Options](#filter-options)
        - [Batch Settings](#batch-settings)
    - [Troubleshooting](#troubleshooting)
        - [Migration Fails](#migration-fails)
        - [Lookup Mapping Issues](#lookup-mapping-issues)
        - [Performance Issues](#performance-issues)
        - [Connection Issues](#connection-issues)
    - [Best Practices](#best-practices)
    - [Contributing](#contributing)
    - [License](#license)
    - [Support](#support)

## UI Preview

![Data Migrator demo](https://github.com/Power-Maverick/PPTB-Tools/raw/main/assets/dataMigrator.gif)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and optimized builds
- ✅ Auto-mapping of users, teams, and business units between environments
- ✅ Smart migration operations: Create, Update, Upsert, Delete
- ✅ Field selection and filtering (OData and FetchXML)
- ✅ Real-time progress tracking with detailed statistics
- ✅ Batch processing for large data sets (1-100 records per batch)
- ✅ Preview before migration to verify operations
- ✅ Lookup field mapping and transformation
- ✅ Modern Fluent UI with responsive design
- ✅ Step-based workflow with collapsible sections
- ✅ Confidence-level indicators for auto-mapping results

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

4. Ensure you have:
    - Primary connection: Source Dataverse environment
    - Secondary connection: Target Dataverse environment

5. Open Data Migrator and follow the step-by-step workflow:
    - Select entity to migrate
    - Choose fields to include
    - Apply filters (OData or FetchXML)
    - Select migration operation (Create/Update/Upsert/Delete)
    - Auto-map system entities (optional)
    - Preview data
    - Start migration and monitor progress

## Key Concepts

### Auto-Mapping

The tool automatically maps system entities between source and target environments:

- **Users**: Matched by domain name, email address, or full name
- **Teams**: Matched by name and team type
- **Business Units**: Matched by name

Each mapping includes a confidence level (high, medium, low) based on the matching criteria used. Always review auto-mapping results before starting migration.

### Migration Operations

Choose the operation that fits your scenario:

- **Create**: Insert new records only (fails if record exists)
- **Update**: Update existing records by primary key (requires records to exist)
- **Upsert**: Insert if new, update if exists
- **Delete**: Remove records from target environment by matching primary key

### Lookup Field Handling

Configure how lookup fields are processed during migration:

- **Auto-Map**: Automatically map system entities (users, teams, business units)
- **Skip**: Exclude the lookup field from migration
- **Custom Mapping**: Define custom lookup transformations

## Technical Stack

- **React 18** with TypeScript
- **Fluent UI React Components** for modern, accessible UI
- **Vite** for fast development and optimized production builds
- **PPTB API** for all Dataverse operations
- **@pptb/types** - PPTB type definitions

## Configuration

### Filter Options

- **OData Filters**: Use OData syntax for simple filtering
    - Example: `statecode eq 0 and createdon gt 2024-01-01`
- **FetchXML Queries**: Use complete FetchXML for complex queries
    - Supports advanced filtering, joins, and aggregations

### Batch Settings

- **Batch Size**: Control batch size for optimal performance (default: 50, max: 100 records)
- **Progress Tracking**: Real-time monitoring with statistics (total, successful, failed, skipped)

## Troubleshooting

### Migration Fails

**Issue**: Migration operation fails with entity or field errors

**Solution**:

- Verify target environment has the same entity/field structure as source
- Check that required fields have values in source data
- Review error messages in the progress panel
- Ensure user has appropriate permissions in both environments

### Lookup Mapping Issues

**Issue**: Lookups are not being mapped correctly between environments

**Solution**:

- Run auto-mapping before starting migration
- Verify users/teams/business units exist in target environment
- Check that entity and field names match between environments
- Verify the primary key values exist in target

### Performance Issues

**Issue**: Migration is slow or times out

**Solution**:

- Reduce batch size (try 25-50 records per batch)
- Use filters to migrate fewer records at once
- Check network connectivity and Dataverse performance
- Monitor server-side logs for throttling

### Connection Issues

**Issue**: Cannot connect to secondary environment

**Solution**:

- Verify secondary connection is configured in PPTB
- Check that connection has appropriate Dataverse permissions
- Ensure both source and target environments are accessible
- Verify credentials have not expired

## Best Practices

1. **Test First**: Always test with a small data set first
2. **Use Filters**: Use OData/FetchXML filters to migrate specific records
3. **Review Mappings**: Verify auto-mapping results before starting migration
4. **Batch Processing**: Use appropriate batch sizes (50-100 records)
5. **Backup First**: Always backup target environment before migration
6. **Monitor Progress**: Watch for errors and statistics during migration
7. **Verify Results**: Spot-check migrated records in target environment

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
