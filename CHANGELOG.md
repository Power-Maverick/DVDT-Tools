# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial monorepo structure with npm workspaces
- ERD Generator package (`@dvdt-tools/erd-generator`)
  - **Standalone operation with Dataverse token authentication**
  - **DataverseClient for fetching solution metadata from Dataverse Web API**
  - **CLI tool for command-line usage**
  - Support for Mermaid diagram format
  - Support for PlantUML diagram format
  - Support for Graphviz DOT format
  - Configurable attributes display
  - Configurable relationships display
  - Support for limiting attributes per table
  - TypeScript types for Dataverse solutions, tables, attributes, and relationships
  - Automatic fetching of solutions, tables, attributes, and relationships
  - List available solutions from Dataverse
- Example files demonstrating ERD generation
  - Standalone mode with Dataverse authentication
  - Programmatic mode with pre-fetched data
  - File saving capabilities
- Comprehensive documentation
  - Integration guide for Dataverse DevTools VS Code extension
- Contributing guidelines

## [1.0.0] - 2024-10-05

### Added
- Initial release
- Repository structure setup
- Basic README and LICENSE files
