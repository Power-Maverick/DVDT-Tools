"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERDToolPanel = void 0;
exports.showERDPanel = showERDPanel;
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
/**
 * ERD Tool WebView Panel for Dataverse DevTools Integration
 *
 * This class provides a minimal integration point for DVDT.
 * The webview handles all Dataverse API calls directly using the bundled JavaScript.
 */
class ERDToolPanel {
    /**
     * Create or show the ERD tool panel
     *
     * @param extensionUri - The extension URI from DVDT's context
     * @param environmentUrl - Dataverse environment URL
     * @param accessToken - Dataverse access token
     */
    static createOrShow(extensionUri, environmentUrl, accessToken) {
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
        const panel = vscode.window.createWebviewPanel(ERDToolPanel.viewType, 'ERD Generator', column || vscode.ViewColumn.One, {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(extensionUri, 'node_modules', '@dvdt-tools', 'erd-generator', 'dist', 'webview'),
                vscode.Uri.joinPath(extensionUri, 'node_modules', '@dvdt-tools', 'erd-generator', 'ui')
            ]
        });
        ERDToolPanel.currentPanel = new ERDToolPanel(panel, extensionUri, environmentUrl, accessToken);
    }
    constructor(panel, extensionUri, environmentUrl, accessToken) {
        this.environmentUrl = environmentUrl;
        this.accessToken = accessToken;
        this._disposables = [];
        this._panel = panel;
        this._extensionUri = extensionUri;
        // Set the webview's initial html content
        this._update();
        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview (only for file operations and clipboard)
        this._panel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
            switch (message.command) {
                case 'saveFile':
                    yield this.handleSaveFile(message.content, message.fileName);
                    break;
                case 'copyToClipboard':
                    yield vscode.env.clipboard.writeText(message.content);
                    vscode.window.showInformationMessage('ERD copied to clipboard');
                    break;
            }
        }), null, this._disposables);
        // Send credentials to webview after it loads
        // Small delay to ensure webview is ready
        setTimeout(() => {
            this.setCredentials(this.environmentUrl, this.accessToken);
        }, 100);
    }
    setCredentials(environmentUrl, accessToken) {
        this.environmentUrl = environmentUrl;
        this.accessToken = accessToken;
        this._panel.webview.postMessage({
            command: 'setCredentials',
            environmentUrl: environmentUrl,
            accessToken: accessToken
        });
    }
    handleSaveFile(content, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = yield vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(fileName),
                filters: {
                    'Mermaid': ['mmd'],
                    'PlantUML': ['puml'],
                    'Graphviz': ['dot'],
                    'All Files': ['*']
                }
            });
            if (uri) {
                yield vscode.workspace.fs.writeFile(uri, Buffer.from(content));
                vscode.window.showInformationMessage(`ERD saved to ${uri.fsPath}`);
            }
        });
    }
    _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }
    _getHtmlForWebview(webview) {
        // Get path to webview.html template
        const webviewHtmlPath = vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@dvdt-tools', 'erd-generator', 'ui', 'webview.html');
        // Get path to bundled webview JavaScript
        const webviewJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@dvdt-tools', 'erd-generator', 'dist', 'webview', 'webview.js'));
        // Read the HTML file
        let html = fs.readFileSync(webviewHtmlPath.fsPath, 'utf8');
        console.log(webview.cspSource);
        // Replace placeholders
        html = html.replace('{{cspSource}}', webview.cspSource);
        html = html.replace('{{webviewJsUri}}', webviewJsUri.toString());
        return html;
    }
    dispose() {
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
exports.ERDToolPanel = ERDToolPanel;
ERDToolPanel.viewType = 'erdGenerator';
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
function showERDPanel(extensionUri, environmentUrl, accessToken) {
    if (!environmentUrl || !accessToken) {
        vscode.window.showErrorMessage('Please connect to a Dataverse environment first');
        return;
    }
    try {
        ERDToolPanel.createOrShow(extensionUri, environmentUrl, accessToken);
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to open ERD Generator: ${error.message}`);
    }
}
//# sourceMappingURL=vscode-integration.js.map