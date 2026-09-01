# Security Role Comparator

Compare one security role against multiple other roles in Dataverse—side by side, privilege by privilege, with combined permission analysis.

## Table of Contents

- [Security Role Comparator](#security-role-comparator)
    - [UI Preview](#ui-preview)
    - [Features](#features)
    - [Installation](#installation)
    - [Development](#development)
    - [Usage in ToolBox](#usage-in-toolbox)
    - [Key Concepts](#key-concepts)
        - [Side-by-Side Comparison](#side-by-side-comparison)
        - [Combined Permission Analysis](#combined-permission-analysis)
        - [Privilege Depth](#privilege-depth)
    - [Technical Stack](#technical-stack)
    - [Troubleshooting](#troubleshooting)
    - [Contributing](#contributing)
    - [License](#license)
    - [Support](#support)

## UI Preview

![Security Role Comparator demo](/assets/roleComparator.gif)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite for fast development and optimized builds
- ✅ Compare base role against up to 5 other roles simultaneously
- ✅ Category grouping (Tables, Miscellaneous, Privacy Related)
- ✅ Accurate privilege mapping from entity metadata
- ✅ Depth icons for visual permission levels
- ✅ Directional difference indicators (+ for more, - for less permissions)
- ✅ Combined Permission analysis (additive security model)
- ✅ Advanced filtering: Row filter, Group/Operation filters
- ✅ Search functionality (display name, schema name, operation)
- ✅ Remembered selections per environment
- ✅ Dark/light theme support
- ✅ Set as Base quick swap functionality

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

4. Use Security Role Comparator:
    - Select a base role
    - Choose up to 5 comparison roles
    - Click Compare to analyze privileges
    - Use filters to focus on specific areas
    - View Combined Permission for additive analysis

## Key Concepts

### Side-by-Side Comparison

The tool displays privileges in a grid showing:

- Base role permissions in the first column
- Comparison roles in subsequent columns
- Color-coded difference indicators (green + for more, red - for less)
- Category grouping like the native Dataverse role editor

Select roles are remembered per environment for quick re-comparison.

### Combined Permission Analysis

The Combined Permission view answers: "If a user had all selected roles, what could they do?"

This reflects Dataverse's additive security model where a user's effective permission is the broadest scope granted by any assigned role. The combined value uses:

**None → User → Business Unit → Parent-Child Business Unit → Organization**

### Privilege Depth

Each privilege depth is represented with an icon:

| Icon            | Level           | Description           |
| --------------- | --------------- | --------------------- |
| 🚫 Prohibited   | None            | Not granted           |
| 👤 Person       | User            | Own records only      |
| 👥 People       | Business Unit   | Business unit records |
| 👨‍👩‍👧 People team  | Parent-Child BU | Including child BUs   |
| 🏢 Organization | Organization    | All records globally  |

## Technical Stack

- **React 18** with TypeScript
- **Vite** for fast development and optimized production builds
- **Fluent UI React Components** for modern UI
- **PPTB API** for all Dataverse operations
- **@pptb/types** - PPTB type definitions

## Troubleshooting

### Roles Not Loading

**Issue**: Role lists appear empty

**Solution**:

- Verify you have appropriate Dataverse permissions
- Check connection context is correct
- Try refreshing the tool
- Ensure roles exist in the environment

### Privilege Mapping Issues

**Issue**: Privileges don't appear or show incorrect categorization

**Solution**:

- Verify roles are loaded correctly
- Check Dataverse environment is accessible
- Try comparing with a different role
- Review console for error messages

### Filter Not Working

**Issue**: Filters don't reduce results as expected

**Solution**:

- Verify filter criteria match privilege names
- Try clearing filters and applying one at a time
- Use the search feature for more precise filtering
- Check that roles have privileges to filter

### Performance Issues

**Issue**: Tool is slow with many roles or privileges

**Solution**:

- Use filters to reduce displayed data
- Reduce number of comparison roles
- Clear browser cache and refresh
- Try comparing fewer roles at once

## Best Practices

1. **Test Assignments**: Use Combined Permission to verify user access
2. **Audit Permissions**: Regularly compare roles to ensure consistency
3. **Document Differences**: Screenshot comparisons for compliance
4. **Role Consolidation**: Identify overlapping role permissions
5. **Principle of Least Privilege**: Use comparisons to minimize excess permissions

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
