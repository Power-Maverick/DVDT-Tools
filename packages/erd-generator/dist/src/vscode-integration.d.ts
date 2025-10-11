import * as vscode from 'vscode';
/**
 * ERD Tool WebView Panel for Dataverse DevTools Integration
 *
 * This class provides a minimal integration point for DVDT.
 * The webview handles all Dataverse API calls directly using the bundled JavaScript.
 */
export declare class ERDToolPanel {
    private environmentUrl;
    private accessToken;
    static currentPanel: ERDToolPanel | undefined;
    private static readonly viewType;
    private readonly _panel;
    private readonly _extensionUri;
    private _disposables;
    /**
     * Create or show the ERD tool panel
     *
     * @param extensionUri - The extension URI from DVDT's context
     * @param environmentUrl - Dataverse environment URL
     * @param accessToken - Dataverse access token
     */
    static createOrShow(extensionUri: vscode.Uri, environmentUrl: string, accessToken: string): void;
    private constructor();
    private setCredentials;
    private handleSaveFile;
    private _update;
    private _getHtmlForWebview;
    dispose(): void;
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
export declare function showERDPanel(extensionUri: vscode.Uri, environmentUrl: string, accessToken: string): void;
//# sourceMappingURL=vscode-integration.d.ts.map