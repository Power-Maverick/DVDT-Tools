import * as vscode from 'vscode';
import * as path from 'path';
import { DataverseClient } from './DataverseClient';
import { ERDGenerator } from './ERDGenerator';

/**
 * ERD Tool WebView Panel for Dataverse DevTools Integration
 * 
 * This class provides a minimal integration point for DVDT.
 * DVDT only needs to:
 * 1. Import this class
 * 2. Call ERDToolPanel.createOrShow(context, environmentUrl, accessToken)
 * 3. That's it!
 */
export class ERDToolPanel {
    public static currentPanel: ERDToolPanel | undefined;
    private static readonly viewType = 'erdGenerator';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    /**
     * Create or show the ERD tool panel
     * This is the only method DVDT needs to call
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
                    vscode.Uri.joinPath(extensionUri, 'node_modules', '@dvdt-tools', 'erd-generator', 'ui')
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

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'requestCredentials':
                        this.setCredentials(this.environmentUrl, this.accessToken);
                        break;

                    case 'listSolutions':
                        await this.handleListSolutions();
                        break;

                    case 'generateERD':
                        await this.handleGenerateERD(message.solutionName, message.format);
                        break;

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

    private async handleListSolutions() {
        try {
            const client = new DataverseClient({
                environmentUrl: this.environmentUrl,
                accessToken: this.accessToken
            });

            const solutions = await client.listSolutions();

            this._panel.webview.postMessage({
                command: 'solutionsLoaded',
                solutions: solutions
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                command: 'solutionsError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Failed to load solutions: ${error.message}`);
        }
    }

    private async handleGenerateERD(solutionName: string, format: string) {
        try {
            const client = new DataverseClient({
                environmentUrl: this.environmentUrl,
                accessToken: this.accessToken
            });

            const solution = await client.fetchSolution(solutionName);
            
            const generator = new ERDGenerator({
                format: format as any,
                includeAttributes: true,
                includeRelationships: true,
                maxAttributesPerTable: 10
            });

            const diagram = generator.generate(solution);

            this._panel.webview.postMessage({
                command: 'erdGenerated',
                diagram: diagram
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                command: 'erdError',
                error: error.message
            });
            vscode.window.showErrorMessage(`Failed to generate ERD: ${error.message}`);
        }
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
        // Get path to webview.html
        const webviewPath = vscode.Uri.joinPath(
            this._extensionUri,
            'node_modules',
            '@dvdt-tools',
            'erd-generator',
            'ui',
            'webview.html'
        );

        // Read the HTML file
        const fs = require('fs');
        let html = fs.readFileSync(webviewPath.fsPath, 'utf8');

        // Update CSP to work with VS Code
        html = html.replace(
            'default-src \'none\';',
            `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'unsafe-inline' ${webview.cspSource};`
        );

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
 * Helper function to register the ERD tool command in DVDT
 * 
 * DVDT Integration Example:
 * 
 * import { registerERDTool } from '@dvdt-tools/erd-generator/vscode';
 * 
 * export function activate(context: vscode.ExtensionContext) {
 *     // Your existing DVDT activation code...
 *     
 *     // Register ERD tool - that's it!
 *     registerERDTool(context, {
 *         getEnvironmentUrl: () => yourConfigService.getCurrentEnvironment(),
 *         getAccessToken: () => yourAuthService.getAccessToken()
 *     });
 * }
 */
export function registerERDTool(
    context: vscode.ExtensionContext,
    credentialProvider: {
        getEnvironmentUrl: () => string | Promise<string>;
        getAccessToken: () => string | Promise<string>;
    }
) {
    const command = vscode.commands.registerCommand('dvdt.generateERD', async () => {
        try {
            const environmentUrl = await credentialProvider.getEnvironmentUrl();
            const accessToken = await credentialProvider.getAccessToken();

            if (!environmentUrl || !accessToken) {
                vscode.window.showErrorMessage('Please connect to a Dataverse environment first');
                return;
            }

            ERDToolPanel.createOrShow(context.extensionUri, environmentUrl, accessToken);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to open ERD Generator: ${error.message}`);
        }
    });

    context.subscriptions.push(command);
}
