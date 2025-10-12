# Getting Started: ERD Generator Tool

This guide will help you install, build, and open the ERD Generator panel locally, and integrate it into Dataverse DevTools (DVDT).

## Who this is for

- You want to try the ERD Generator locally
- You plan to integrate it into the DVDT VS Code extension
- You’re new to VS Code WebView tools and want a simple path

## Prerequisites

- VS Code 1.85+ (stable)
- Node.js 18+ and npm 9+
- A Dataverse environment and an account with read access to solutions/metadata
- Optional: DVDT extension (for integration testing)

Verify versions:

```pwsh
node -v
npm -v
```

## Project layout

```
tools/erd-generator/
	src/                 # Source code (exports, integration, client, generator)
	  components/        # ERDGenerator (turns metadata into Mermaid/PlantUML/DOT)
	  dvdtIntegration/   # VS Code glue: showERDPanel + WebView wiring
	  models/            # Shared TypeScript interfaces/types for metadata & API
	  utils/             # DataverseClient for Web API calls (solutions/metadata)
	ui/                  # WebView HTML template
	dist/webview/        # Bundled WebView JS (built by webpack)
	webpack.config.js    # WebView bundling config
	package.json         # Scripts for build/dev
	docs/                # This guide and more
```

## 1) Install dependencies

From the ERD tool directory:

```pwsh
cd tools/erd-generator
npm install
```

## 2) Build once (extension + webview)

```pwsh
npm run build
```

This produces TypeScript output and a bundled `dist/webview/webview.js` referenced by the WebView HTML.

## 3) Run in watch mode (developer experience)

Use two watches with a single command:

```pwsh
npm run dev
```

- Rebuilds the extension code on save
- Re-bundles the WebView on save

## 4) Open the ERD panel (minimal integration)

The ERD tool exposes a single helper `showERDPanel(extensionUri, environmentUrl, accessToken)` that opens the WebView panel. You can call it from any VS Code extension (DVDT or a scratch extension).

Minimal example:

```ts
import * as vscode from 'vscode';
import { showERDPanel } from '@dvdt-tools/erd-generator';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('example.openERD', async () => {
		// Replace with your values or retrieval logic
		const environmentUrl = '<https://your-org.crm.dynamics.com>';
		const accessToken = '<AAD access token with Dataverse scope>';

		showERDPanel(context.extensionUri, environmentUrl, accessToken);
	});

	context.subscriptions.push(disposable);
}
```

What the ERD panel does for you:
- Lists solutions from your Dataverse environment
- Lets you pick a solution and generate ERD
- Exports to Mermaid / PlantUML / Graphviz
- Supports download and copy-to-clipboard

## 5) Integrate with Dataverse DevTools (DVDT)

If you’re working inside DVDT, call the helper where you already have the environment + token. Example:

```ts
import { showERDPanel } from '@dvdt-tools/erd-generator';

// Inside a DVDT command/menu handler
showERDPanel(context.extensionUri, dvdtConfig.getCurrentEnvironment(), await dvdtAuth.getAccessToken());
```

For a fuller walkthrough (icons, menus, tips), see: [DVDT_Integration.md](./DVDT_Integration.md)

## 6) Local testing options

Pick the flow that fits your setup. See details in [Local_Testing.md](./Local_Testing.md).

- Link into your extension during development

	```pwsh
	# From ERD tool folder
	npm link

	# In your extension folder (DVDT or scratch)
	npm link @dvdt-tools/erd-generator
	```

- Or reference this folder as a file dependency in your extension’s package.json

	```json
	{
		"dependencies": {
			"@dvdt-tools/erd-generator": "file:../path/to/tools/erd-generator"
		}
	}
	```

## Troubleshooting

- WebView is blank
	- Ensure `npm run build` or `npm run dev` ran without errors
	- Confirm `dist/webview/webview.js` exists
	- Check VS Code Developer Tools console (Help → Toggle Developer Tools)

- “Please connect to a Dataverse environment first”
	- `environmentUrl` or `accessToken` was undefined/empty
	- Acquire a fresh token with the correct Dataverse scopes

- Solutions don’t load
	- Verify your account has rights to read solutions and metadata
	- Ensure the token audience/scope matches your Dataverse org

- TypeScript path/module errors
	- Run a clean build: `rm -rf dist && npm run build`
	- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`

## Build details

- `npm run build:extension` compiles the TypeScript sources for the integration/API
- `npm run build:webview` bundles the WebView app with webpack to `dist/webview/webview.js`
- `ui/webview.html` is the page template; at runtime the script URL is injected


