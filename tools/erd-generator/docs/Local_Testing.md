# Local Testing Guide

This guide explains how to locally test the ERD Generator tool by integrating it with a local copy of Dataverse DevTools (DVDT).

## Prerequisites

Before you begin, ensure you have:

- **Node.js** (v14 or higher) and **npm** installed
- **Git** installed
- A local clone of **Dataverse DevTools** repository
- A local clone of **DVDT-Tools** repository (this repo)
- Access to a **Dataverse environment** for testing

## Setup Instructions

### Step 1: Prepare DVDT-Tools

1. **Clone and build DVDT-Tools:**

```bash
# Clone the repository (if not already done)
git clone https://github.com/Power-Maverick/DVDT-Tools.git
cd DVDT-Tools

# Install dependencies
npm install

# Build the ERD generator package
npm run build
```

2. **Create an npm link for local development:**

```bash
# Navigate to the ERD generator package
cd tools/erd-generator

# Create a global symlink
npm link
```

This creates a global symlink to your local ERD generator package, allowing other projects to use it.

### Step 2: Prepare Dataverse DevTools

1. **Clone Dataverse DevTools (if not already done):**

```bash
# In a separate directory
git clone https://github.com/Power-Maverick/DataverseDevTools.git
cd DataverseDevTools
```

2. **Install dependencies:**

```bash
npm install
```

3. **Link the ERD generator package:**

```bash
# Link to your local ERD generator
npm link @dvdt-tools/erd-generator
```

This creates a symlink from DVDT's `node_modules/@dvdt-tools/erd-generator` to your local development version.

### Step 3: Integrate ERD Tool into DVDT

1. **Open the DVDT extension file** (typically `src/extension.ts` or similar):

```bash
# Open in your preferred editor
code src/extension.ts
```

2. **Add the import statement** at the top of the file:

```typescript
import { registerERDTool } from '@dvdt-tools/erd-generator';
```

3. **Register the ERD tool in the `activate` function:**

```typescript
export function activate(context: vscode.ExtensionContext) {
    // ... existing DVDT code ...

    // Register ERD Generator Tool
    registerERDTool(context, {
        getEnvironmentUrl: () => {
            // Replace with your actual method to get environment URL
            // Example: return dvdtConfig.getCurrentEnvironment();
            return 'https://your-org.crm.dynamics.com';
        },
        getAccessToken: () => {
            // Replace with your actual method to get access token
            // Example: return dvdtAuth.getAccessToken();
            return 'your-access-token-here';
        }
    });

    // ... rest of DVDT code ...
}
```

**Note:** You'll need to replace the `getEnvironmentUrl` and `getAccessToken` functions with the actual methods from DVDT that retrieve these values.

4. **Add a command to open the ERD tool** (optional but recommended):

In your `package.json` commands section:

```json
{
  "command": "dvdt.openERDGenerator",
  "title": "DVDT: Open ERD Generator"
}
```

Then in your extension code:

```typescript
context.subscriptions.push(
    vscode.commands.registerCommand('dvdt.openERDGenerator', () => {
        // The panel will be created automatically when registerERDTool is called
        vscode.window.showInformationMessage('ERD Generator opened!');
    })
);
```

### Step 4: Test the Integration

1. **Compile DVDT:**

```bash
# In the DataverseDevTools directory
npm run compile
```

2. **Launch the Extension Development Host:**

   - Press `F5` in VS Code (or use "Run > Start Debugging")
   - This opens a new VS Code window with your extension loaded

3. **Test the ERD Generator:**

   - Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
   - Type "DVDT: Open ERD Generator" (or whatever command you registered)
   - The ERD Generator webview panel should open

4. **Verify Functionality:**

   - **Step 1 - Connect:** Verify the environment URL is populated
   - **Step 2 - Solutions:** Click "Connect & List Solutions" to see available solutions
   - **Step 3 - Generate:** Select a solution and generate an ERD
   - **Configuration:** Test changing config options (attributes, relationships, max attributes)
   - **Download/Copy:** Test downloading source files and copying to clipboard

## Development Workflow

### Making Changes to ERD Tool

When you make changes to the ERD generator code:

1. **Rebuild the ERD generator:**

```bash
# In DVDT-Tools/tools/erd-generator
npm run build
```

2. **Reload the Extension Development Host:**
   - In the Extension Development Host window, press `Ctrl+R` (or `Cmd+R`)
   - Or use "Developer: Reload Window" from Command Palette

### Making Changes to Webview UI

When you modify `ui/webview.html`:

1. **No rebuild needed** - HTML changes are loaded directly
2. **Reload the Extension Development Host** to see changes
3. You may need to close and reopen the ERD panel

### Debugging

**Enable VS Code debugging:**

1. **In DVDT's `launch.json`:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

2. **Set breakpoints** in the ERD tool code
3. **Open Developer Tools** for the webview:
   - In the webview panel, press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
   - Run "Developer: Open Webview Developer Tools"
   - Use Console tab to debug JavaScript issues

**Check logs:**

```typescript
// Add console logs in vscode-integration.ts
console.log('ERD Tool registered');
console.log('Environment URL:', environmentUrl);
console.log('Solutions fetched:', solutions);
```

## Troubleshooting

### Issue: "Module not found: @dvdt-tools/erd-generator"

**Solution:**
- Ensure you ran `npm link` in the ERD generator directory
- Ensure you ran `npm link @dvdt-tools/erd-generator` in DVDT directory
- Try unlinking and relinking:
  ```bash
  # In DataverseDevTools
  npm unlink @dvdt-tools/erd-generator
  npm link @dvdt-tools/erd-generator
  ```

### Issue: Changes not reflected

**Solution:**
- Rebuild the ERD generator: `npm run build` in `DVDT-Tools/tools/erd-generator`
- Reload the Extension Development Host window
- Close and reopen the ERD panel

### Issue: "Cannot find module 'vscode'"

**Solution:**
- Make sure you have `@types/vscode` installed in DVDT:
  ```bash
  npm install --save-dev @types/vscode
  ```

### Issue: Webview shows blank screen

**Solution:**
- Check Developer Tools console for errors
- Verify `webview.html` path is correct in `vscode-integration.ts`
- Ensure Content Security Policy allows required resources

### Issue: Authentication errors

**Solution:**
- Verify `getEnvironmentUrl()` returns correct URL (with https://)
- Verify `getAccessToken()` returns valid, non-expired token
- Test token manually using a REST client or browser
- Check Dataverse environment is accessible

## Testing Checklist

Use this checklist to verify full functionality:

- [ ] Extension loads without errors
- [ ] ERD panel opens via command
- [ ] Environment URL is correctly populated
- [ ] Access token is valid
- [ ] Solutions list loads successfully
- [ ] Solution selection works
- [ ] Format selector (Mermaid/PlantUML/Graphviz) works
- [ ] Configuration options update:
  - [ ] Include Attributes checkbox
  - [ ] Include Relationships checkbox
  - [ ] Max Attributes per Table input
- [ ] ERD generation succeeds
- [ ] Generated diagram displays correctly
- [ ] Download source file works
- [ ] Copy to clipboard works
- [ ] Error messages display appropriately
- [ ] "Generate Another" button works
- [ ] UI follows VS Code theme

## Advanced: Testing with Mock Data

If you don't have access to a Dataverse environment, you can mock the credentials:

```typescript
registerERDTool(context, {
    getEnvironmentUrl: () => {
        // Return mock URL for testing UI
        return 'https://mock-org.crm.dynamics.com';
    },
    getAccessToken: () => {
        // Return mock token - will fail on actual API calls
        // but allows UI testing
        return 'mock-token-for-ui-testing';
    }
});
```

**Note:** This will only allow testing the UI flow. Actual solution fetching and ERD generation will fail without valid credentials.

## Uninstalling/Cleanup

When you're done testing:

1. **Unlink from DVDT:**

```bash
# In DataverseDevTools directory
npm unlink @dvdt-tools/erd-generator
npm install  # Reinstall normal dependencies
```

2. **Unlink global package:**

```bash
# In DVDT-Tools/tools/erd-generator
npm unlink
```

3. **Remove integration code from DVDT** (if you want to revert changes)

## Publishing and Production Use

When ready to use the ERD tool in production:

1. **Publish the ERD generator to npm:**

```bash
# In DVDT-Tools/tools/erd-generator
npm publish
```

2. **Install in DVDT normally:**

```bash
# In DataverseDevTools
npm install @dvdt-tools/erd-generator
```

3. **Keep the same integration code** - no changes needed!

## Getting Help

If you encounter issues:

1. Check the console logs in VS Code Developer Tools
2. Check the Extension Host log output
3. Review the [VSCODE_INTEGRATION.md](./VSCODE_INTEGRATION.md) guide
4. Open an issue on the DVDT-Tools GitHub repository

## Example Integration Code

Here's a complete example of integrating the ERD tool into DVDT's `extension.ts`:

```typescript
import * as vscode from 'vscode';
import { registerERDTool } from '@dvdt-tools/erd-generator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Dataverse DevTools is now active');

    // ... existing DVDT initialization code ...

    // Register ERD Generator Tool
    try {
        registerERDTool(context, {
            getEnvironmentUrl: () => {
                // Use DVDT's environment configuration
                const config = vscode.workspace.getConfiguration('dvdt');
                return config.get<string>('environmentUrl') || '';
            },
            getAccessToken: async () => {
                // Use DVDT's authentication system
                // This is pseudo-code - adjust to your auth implementation
                const authProvider = getAuthProvider();
                return await authProvider.getAccessToken();
            }
        });
        
        console.log('ERD Generator tool registered successfully');
    } catch (error) {
        console.error('Failed to register ERD Generator:', error);
        vscode.window.showErrorMessage('Failed to load ERD Generator tool');
    }

    // ... rest of DVDT code ...
}

export function deactivate() {
    // Cleanup if needed
}
```

---

**Happy Testing! 🚀**

For more information, see:
- [VS Code Integration Guide](./VSCODE_INTEGRATION.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Package README](./tools/erd-generator/README.md)
