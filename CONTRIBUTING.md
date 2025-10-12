# Contributing to DVDT-Tools

Thank you for your interest in contributing to DVDT-Tools! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Setting Up Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/DVDT-Tools.git
   cd DVDT-Tools
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build all tools:
   ```bash
   npm run build
   ```

## Development Workflow

### Project Structure

This is a monorepo managed with npm workspaces. Each tool lives in its own package under `tools/`:

```
DVDT-Tools/
├── tools/
│   ├── erd-generator/    # ERD generation tool
│   └── [future-tool]/     # Future tools will go here
├── package.json           # Root package with workspaces
└── tsconfig.json         # Shared TypeScript config
```

### Making Changes

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes in the appropriate package

3. Build and test your changes:
   ```bash
   npm run build
   npm run test
   ```

4. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add new feature"
   ```

### Commit Message Guidelines

We follow conventional commit messages:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `test:` - Test additions or modifications
- `refactor:` - Code refactoring

### Adding a New Tool

To add a new tool to the monorepo:

1. Create a new directory under `tools/`:
   ```bash
   mkdir -p tools/your-tool/src
   ```

2. Create `package.json` in the new package:
   ```json
   {
     "name": "@dvdt-tools/your-tool",
     "version": "1.0.0",
     "description": "Description of your tool",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "test": "echo \"No tests yet\"",
       "dev": "tsc --watch"
     },
     "keywords": ["dataverse", "power-platform"],
     "author": "Power-Maverick",
     "license": "GPL-2.0"
   }
   ```

3. Create `tsconfig.json`:
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src/**/*"]
   }
   ```

4. Add your source code in the `src/` directory

5. Build and test:
   ```bash
   npm install
   npm run build
   ```

## Pull Request Process

1. Update the README.md with details of changes if applicable
2. Update the package version following semantic versioning
3. Create a Pull Request with a clear description of changes
4. Wait for review and address any feedback
5. Once approved, your PR will be merged

## Code Style

- Use TypeScript for all new code
- Follow the existing code style
- Include JSDoc comments for public APIs
- Keep functions small and focused
- Write self-documenting code

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Add integration tests where appropriate

## Questions?

If you have questions, feel free to:
- Open an issue on GitHub
- Reach out to the maintainers

## License

By contributing, you agree that your contributions will be licensed under the GPL-2.0 License.
