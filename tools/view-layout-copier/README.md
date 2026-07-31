# View Layout Copier

A Power Platform ToolBox (PPTB) tool that copies the layout of one Dataverse view to multiple other views of the same table in a single operation.

## Overview

View Layout Copier simplifies keeping view layouts consistent across a table. Instead of manually editing each view, pick a source view and apply its column layout, sort order, and components configuration to any number of target views at once — system views and personal views alike.

## Features

- **Solution selector on launch**: Narrow the table list to an unmanaged solution (managed solutions are excluded — they can't be modified), or work across all tables. Defaults to the current user's preferred solution from the maker portal when one is set, otherwise the first unmanaged solution alphabetically
- **Persistent, searchable table list**: Search by display name *or* schema/logical name; the list is alphabetized by display name and stays available on the left for quick switching
- **View types at a glance**: Every view is badged with its type — Default Public View, Public View, Personal View, Associated View, Advanced Find View, Quick Find View, Lookup View, and more
- **Personal views included**: Copy to/from personal views (userquery) as well as system views (savedquery)
- **Source layout preview**: See the source view's columns — order, display names, and relative widths — plus its sort order before copying
- **Selective copying**: Choose what to copy (all enabled by default):
  - **Column layout** — columns, order, and widths
  - **Sort order** — replaces the targets' sorting
  - **Components configuration** — custom controls / grid components (`layoutjson`); skipped for Quick Find, Lookup, Advanced Find, and personal views, which do not support them
- **Filters are never copied**: Each target view keeps its own filter criteria by design
- **Smart query merging**: Attributes referenced by the copied layout are added to the target's fetchxml automatically; related-table (link-entity) columns are carried over *without* their filters
- **Lookup view safety check**: If a lookup view is selected as a target and the source layout's first column is not the table's primary name column, the tool warns you — lookup views need the name column first to work correctly on forms
- **Single publish**: Customizations are published once per copy operation, not once per view
- **Real-time progress**: Per-view status with details of what was changed

## How to Use

1. **Pick a solution** on the Tables tab to narrow the table list — it's pre-selected using your maker-portal preferred solution when available
2. **Select a table** from the searchable list on the left
3. **Choose the source view** whose layout you want to copy — its layout appears in the preview strip
4. **Check the target views** to apply the layout to
5. **Adjust the copy options** on the Configuration tab if needed, then click **Copy & publish** (pinned at the bottom of the left nav) — customizations are published automatically and the publish status is shown in the progress list

## Technical Details

- **Built with**: React 18 + TypeScript + Vite (no UI framework dependencies)
- **PPTB Integration**: Uses `@pptb/types` (`window.dataverseAPI` / `window.toolboxAPI`)
- **Dataverse**: Reads `savedquery`/`userquery`, merges `layoutxml`/`fetchxml`/`layoutjson`, publishes via `PublishXml`
- **Theme aware**: Follows the PPTB light/dark theme

## Installation

This tool is designed to be installed through Power Platform ToolBox. Follow the PPTB documentation for installing tools.

## Development

```bash
# Install dependencies
npm install

# Run development server (demo mode)
npm run dev

# Build for production
npm run build
```

Each production build increments the package's patch version before bundling.

When run locally outside PPTB (`npm run dev`), the tool starts in **demo mode** with an in-memory mock of the Dataverse API and sample tables/views, so the whole flow — including copying — can be exercised in a plain browser. Production builds require PPTB.

## License

GPL-2.0

## Author

Power Maverick

## Reference

This tool is inspired by the [XrmToolBox View Layout Replicator](https://github.com/MscrmTools/MsCrmTools.ViewLayoutReplicator) by MscrmTools.
