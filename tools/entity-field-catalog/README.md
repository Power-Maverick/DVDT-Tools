# Entity Field Catalog

Export entity and field metadata from Dataverse solutions to Excel format with comprehensive documentation.

## Table of Contents

- [Entity Field Catalog](#entity-field-catalog)
    - [Table of Contents](#table-of-contents)
    - [UI Preview](#ui-preview)
    - [Features](#features)
    - [Installation](#installation)
    - [Development](#development)
    - [Usage in ToolBox](#usage-in-toolbox)
    - [Key Concepts](#key-concepts)
        - [Metadata Export](#metadata-export)
        - [Export Formats](#export-formats)
    - [Technical Stack](#technical-stack)
    - [Configuration](#configuration)
        - [Export Options](#export-options)
        - [Field Properties](#field-properties)
    - [Troubleshooting](#troubleshooting)
        - [No Entities Appearing](#no-entities-appearing)
        - [Export Fails](#export-fails)
        - [Excel File Issues](#excel-file-issues)
        - [CSV Export Issues](#csv-export-issues)
    - [Best Practices](#best-practices)
    - [Contributing](#contributing)
    - [License](#license)
    - [Support](#support)
        - [Field Details (per entity)](#field-details-per-entity)
    - [Development](#development-1)
    - [License](#license-1)
    - [Contributing](#contributing-1)
    - [Author](#author)

## UI Preview

![Entity Field Catalog Screenshot](https://github.com/Power-Maverick/PPTB-Tools/raw/main/assets/entityFieldCatalog.png)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and optimized builds
- ✅ Modern Fluent UI design with responsive layout
- ✅ Multi-entity selection for batch export
- ✅ Multiple export formats: Excel (.xlsx) and CSV (.zip)
- ✅ Comprehensive metadata export (entities, fields, properties)
- ✅ Solution-based entity filtering
- ✅ Field properties included (primary ID, primary name, required)
- ✅ Real-time entity selection with checkboxes
- ✅ Export progress tracking
- ✅ Full integration with Dataverse API via PPTB

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

4. Use Entity Field Catalog:
    - Select a solution from the dropdown
    - Check the entities you want to export
    - Choose your export format (Excel or CSV)
    - Click "Export" to download the file

## Key Concepts

### Metadata Export

Exports comprehensive metadata about entities and their fields:

- **Entity Information**: Logical name, display name, schema name, description, primary ID/name attributes
- **Field Information**: Logical name, display name, schema name, data type, description
- **Field Properties**: Is primary ID, is primary name, is required flag

### Export Formats

Choose between two export options:

- **Excel (.xlsx)**: Single workbook with "Entities" summary tab plus one tab per entity
- **CSV (.zip)**: Compressed archive containing Entities.csv plus one CSV file per entity

Both formats contain identical data, choose based on your preference and tool compatibility.

## Technical Stack

- **React 18** with TypeScript
- **Fluent UI React Components** for modern, accessible UI
- **Vite** for fast development and optimized production builds
- **ExcelJS** for secure Excel export without external dependencies
- **PPTB API** for all Dataverse operations

## Configuration

### Export Options

- **Excel Format**: Professional workbook suitable for documentation and analysis
- **CSV Format**: Portable format for data integration and processing
- **Multiple Entities**: Select multiple entities to export in one operation

### Field Properties

The export includes these field attributes:

| Attribute    | Description                               |
| ------------ | ----------------------------------------- |
| Display Name | Human-readable field name                 |
| Logical Name | Dataverse logical identifier              |
| Schema Name  | Database schema name                      |
| Type         | Field data type                           |
| Primary ID   | Whether field is the primary key          |
| Primary Name | Whether field is the primary display name |
| Required     | Whether field is required                 |

## Troubleshooting

### No Entities Appearing

**Issue**: Solution dropdown shows solutions but entity list is empty

**Solution**:

- Verify the solution contains entities (some solutions may be empty)
- Try selecting a different solution
- Check that you have appropriate permissions to read solution metadata
- Refresh the tool

### Export Fails

**Issue**: Export operation fails or produces empty files

**Solution**:

- Verify you have read permissions on all selected entities and fields
- Ensure entity metadata is accessible in Dataverse
- Try exporting a single entity first
- Check browser console for detailed error messages

### Excel File Issues

**Issue**: Exported Excel file won't open or is corrupted

**Solution**:

- Try using CSV format instead to isolate the issue
- Verify your Excel version supports the .xlsx format
- Try opening the file with Excel Online first
- Check that no special characters are causing issues

### CSV Export Issues

**Issue**: CSV file won't unzip or contains corrupted data

**Solution**:

- Verify your system has a working ZIP extraction utility
- Try exporting again with fewer entities
- Use Excel to open individual CSV files directly
- Check for special characters in entity/field names

## Best Practices

1. **Document Everything**: Use this tool to create comprehensive entity/field documentation
2. **Solution-Based**: Export solutions separately for better organization
3. **Backup Reference**: Keep exports as reference documentation for your Dataverse schema
4. **Version Control**: Track exports over time to monitor schema changes
5. **Share Widely**: Use CSV format for sharing with non-Excel users

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

### Field Details (per entity)

| Column             | Description                                |
| ------------------ | ------------------------------------------ |
| Field Display Name | Human-friendly field label                 |
| Field Logical Name | Dataverse logical name                     |
| Field Schema Name  | Dataverse schema name                      |
| Field Type         | Data type                                  |
| Is Primary ID      | Indicates if the field is the primary ID   |
| Is Primary Name    | Indicates if the field is the primary name |
| Is Required        | Indicates if the field is required         |
| Field Description  | Field description                          |

## Development

To run the tool in development mode:

```bash
npm run dev
```

This will start the Vite development server with hot module replacement.

## License

This project is licensed under the GPL-2.0 License - see the [LICENSE](../../LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Power Maverick - [GitHub](https://github.com/Power-Maverick)
