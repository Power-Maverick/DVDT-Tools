import * as vscode from 'vscode';
import { pathUi, pathWebview } from '../utils/Constants';

/**
 * ERD Tool WebView Panel for Dataverse DevTools Integration
 * 
 * This class provides a minimal integration point for DVDT.
 * The webview handles all Dataverse API calls directly using the bundled JavaScript.
 */
export class ERDToolPanel {
    public static currentPanel: ERDToolPanel | undefined;
    private static readonly viewType = 'erdGenerator';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    /**
     * Create or show the ERD tool panel
     * 
     * @param extensionUri - The extension URI from DVDT's context
     * @param environmentUrl - Dataverse environment URL
     * @param accessToken - Dataverse access token
     */
    public static createOrShow(
        extensionUri: vscode.Uri,
        environmentUrl: string,
        accessToken: string
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ERDToolPanel.currentPanel) {
            ERDToolPanel.currentPanel._panel.reveal(column);
            // Update credentials
            ERDToolPanel.currentPanel.setCredentials(environmentUrl, accessToken);
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            ERDToolPanel.viewType,
            'ERD Generator',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, ...pathWebview),
                    vscode.Uri.joinPath(extensionUri, ...pathUi)
                ]
            }
        );

        ERDToolPanel.currentPanel = new ERDToolPanel(panel, extensionUri, environmentUrl, accessToken);
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        private environmentUrl: string,
        private accessToken: string
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview (only for file operations and clipboard)
        this._panel.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case 'saveFile':
                        await this.handleSaveFile(message.content, message.fileName);
                        break;

                    case 'copyToClipboard':
                        await vscode.env.clipboard.writeText(message.content);
                        vscode.window.showInformationMessage('ERD copied to clipboard');
                        break;
                }
            },
            null,
            this._disposables
        );

        // Send credentials to webview after it loads
        // Small delay to ensure webview is ready
        setTimeout(() => {
            this.setCredentials(this.environmentUrl, this.accessToken);
        }, 100);
    }

    private setCredentials(environmentUrl: string, accessToken: string) {
        this.environmentUrl = environmentUrl;
        this.accessToken = accessToken;
        
        this._panel.webview.postMessage({
            command: 'setCredentials',
            environmentUrl: environmentUrl,
            accessToken: accessToken
        });
    }

    private async handleSaveFile(content: string, fileName: string) {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(fileName),
            filters: {
                'Mermaid': ['mmd'],
                'PlantUML': ['puml'],
                'Graphviz': ['dot'],
                'All Files': ['*']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content));
            vscode.window.showInformationMessage(`ERD saved to ${uri.fsPath}`);
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get URIs for the bundled React files
        const indexJsUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this._extensionUri,
            ...pathWebview,
            'index.js'
        ));
        
        const indexCssUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this._extensionUri,
            ...pathWebview,
            'index.css'
        ));

        // Load Mermaid from CDN for visualization
        const mermaidScript = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';

        // Create HTML content
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} https://cdn.jsdelivr.net 'unsafe-eval'; img-src https: data:;">
    <title>Dataverse ERD Generator</title>
    <link rel="stylesheet" href="${indexCssUri}">
    <script src="${mermaidScript}"></script>
    <script>
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                themeVariables: {
                    primaryColor: '#0e639c',
                    primaryTextColor: '#fff',
                    primaryBorderColor: '#007acc',
                    lineColor: '#007acc',
                    secondaryColor: '#3a3d41',
                    tertiaryColor: '#1e1e1e'
                }
            });
        }
    </script>
</head>
<body>
    <div id="root"></div>
    <script src="${indexJsUri}"></script>
</body>
</html>`;

        return html;
    }

    public dispose() {
        ERDToolPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}

/**
 * Public function to show the ERD panel
 * DVDT calls this function directly to open the ERD Generator.
 * 
 * DVDT Integration Example:
 * 
 * import { showERDPanel } from '@dvdt-tools/erd-generator';
 * 
 * // In your DVDT code, call this when user wants to generate ERD
 * showERDPanel(context.extensionUri, environmentUrl, accessToken);
 * 
 * @param extensionUri - The extension URI from DVDT's context
 * @param environmentUrl - Dataverse environment URL
 * @param accessToken - Dataverse access token
 */
export function showERDPanel(
    extensionUri: vscode.Uri,
    environmentUrl: string,
    accessToken: string
) {
    if (!environmentUrl || !accessToken) {
        vscode.window.showErrorMessage('Please connect to a Dataverse environment first');
        return;
    }

    try {
        ERDToolPanel.createOrShow(extensionUri, environmentUrl, accessToken);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to open ERD Generator: ${error.message}`);
    }
}
