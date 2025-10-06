# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial monorepo structure with npm workspaces
- ERD Generator package (`@dvdt-tools/erd-generator`)
  - **VS Code WebView integration** - embeddable panel for Dataverse DevTools (~10 lines of code)
  - **Self-contained WebView UI** - complete UI that runs in VS Code panels
  - **Minimal integration design** - DVDT provides credentials, ERD tool handles everything else
  - Support for Mermaid diagram format
  - Support for PlantUML diagram format
  - Support for Graphviz DOT format
  - Configurable attributes display
  - Configurable relationships display
  - Support for limiting attributes per table
  - TypeScript types for Dataverse solutions, tables, attributes, and relationships
  - Automatic fetching of solutions, tables, attributes, and relationships
  - List available solutions from Dataverse
  - File saving and clipboard operations
- Comprehensive documentation
  - VS Code WebView integration guide (VSCODE_INTEGRATION.md)
  - Package documentation
- Contributing guidelines

### Removed
- CLI tool (not needed for DVDT integration)
- Standalone web server (not needed for DVDT integration)
- Example files for standalone usage
- Express and nodemon dependencies

## [1.0.0] - 2024-10-05

### Added
- Initial release
- Repository structure setup
- Basic README and LICENSE files
