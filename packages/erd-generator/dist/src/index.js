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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.showERDPanel = exports.DataverseClient = exports.ERDGenerator = void 0;
var ERDGenerator_1 = require("./ERDGenerator");
Object.defineProperty(exports, "ERDGenerator", { enumerable: true, get: function () { return ERDGenerator_1.ERDGenerator; } });
var DataverseClient_1 = require("./DataverseClient");
Object.defineProperty(exports, "DataverseClient", { enumerable: true, get: function () { return DataverseClient_1.DataverseClient; } });
__exportStar(require("./types"), exports);
// VS Code integration (optional import)
var vscode_integration_1 = require("./vscode-integration");
Object.defineProperty(exports, "showERDPanel", { enumerable: true, get: function () { return vscode_integration_1.showERDPanel; } });
//# sourceMappingURL=index.js.map