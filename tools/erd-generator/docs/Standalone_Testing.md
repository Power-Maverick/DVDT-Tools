# Standalone Testing Guide

This guide explains how to test the ERD Generator without integrating it into DVDT (Dataverse DevTools).

## Prerequisites

1. Build the project:
   ```bash
   npm install
   npm run build
   ```

2. Have your Dataverse credentials ready:
   - **Environment URL**: Your Dataverse environment URL (e.g., `https://contoso.crm.dynamics.com`)
   - **Access Token**: A valid Azure AD access token for Dataverse API

## Getting an Access Token

You can obtain an access token using various methods:

### Method 1: Using Azure CLI
```bash
az login
az account get-access-token --resource=https://your-org.crm.dynamics.com
```

### Method 2: Using PowerShell
```powershell
Connect-AzAccount
Get-AzAccessToken -ResourceUrl "https://your-org.crm.dynamics.com"
```

### Method 3: From DVDT
If you have DVDT installed, you can get the token from there and use it for standalone testing.

## Running the Standalone Test Page

1. Start a local web server:
   ```bash
   npm run test:standalone
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:8080/test.html
   ```

3. Enter your Dataverse credentials:
   - Environment URL
   - Access Token

4. Click "Load ERD Generator" button

5. The ERD Generator will load and you can:
   - Select a solution from the dropdown
   - Configure diagram options (attributes, relationships, max attributes)
   - Generate ERD in different formats (Mermaid, PlantUML, Graphviz)
   - Toggle between visual and text views (Mermaid only)
   - Download the ERD as a file
   - Copy to clipboard

## How It Works

The standalone test page (`test.html`) creates an iframe that loads the webview UI (`webview.html`) and communicates with it via `postMessage`:

```
test.html (Parent Window)
    ↓ postMessage (setCredentials)
webview.html (Iframe)
    ↓ Loads webview.js
    ↓ Direct API calls to Dataverse
    ↓ Generates ERD
    ↑ postMessage (saveFile, copyToClipboard)
test.html (Handles file download and clipboard)
```

## Troubleshooting

### Issue: "Refused to connect" error
- **Cause**: CSP (Content Security Policy) restrictions
- **Solution**: Make sure you're accessing via `http://localhost:8080` (not `file://`)

### Issue: "401 Unauthorized" errors
- **Cause**: Invalid or expired access token
- **Solution**: Generate a new access token and try again

### Issue: Webview doesn't load
- **Cause**: Build artifacts missing
- **Solution**: Run `npm run build` to generate the dist folder

### Issue: Solutions don't appear
- **Cause**: Token doesn't have proper permissions
- **Solution**: Ensure your token has read permissions for Dataverse metadata

## Differences from DVDT Integration

| Feature | Standalone Test | DVDT Integration |
|---------|----------------|------------------|
| Credentials | Manual input | Provided by DVDT |
| File Save | Browser download | VS Code file picker |
| Clipboard | Browser API | VS Code clipboard |
| UI Container | Browser iframe | VS Code WebView |
| Launch | Manual via browser | Command/menu in DVDT |

## Development Workflow

1. Make changes to source code
2. Run `npm run build` to compile
3. Refresh the test page in browser
4. Test your changes

For continuous development, run:
```bash
npm run dev
```

This will watch for file changes and automatically rebuild.

## Security Notes

- **Never commit access tokens** to git
- Access tokens are temporary and expire
- The test page stores credentials only in memory (not localStorage)
- Use test environments for development

## Next Steps

After testing standalone:
1. Integrate into DVDT using `showERDPanel()` function
2. See [VSCODE_INTEGRATION.md](../VSCODE_INTEGRATION.md) for integration guide
3. See [LOCAL_TESTING.md](../LOCAL_TESTING.md) for testing with DVDT
