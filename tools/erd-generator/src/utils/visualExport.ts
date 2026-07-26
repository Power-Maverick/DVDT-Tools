import { ReactFlowInstance } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";
import plantumlEncoder from "plantuml-encoder";
import { ERDEditorModel } from "../models/editor";
import { GraphPositions } from "./graphLayout";

export type OutputFormat = "flow" | "mermaid" | "plantuml" | "drawio";
export type ExportMode = "text" | "visual" | "both";
export type VisualExportType = "html" | "svg" | "png";

export interface VisualExportArtifact {
    fileName: string;
    contents?: string;
    mimeType?: string;
    blob?: Blob;
}

export interface FlowExportPayload {
    version: number;
    exportedAt: string;
    source: string;
    changedOnly: boolean;
    model: ERDEditorModel;
    positions: GraphPositions;
}

export const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");

const parseDataUrl = (dataUrl: string): { mimeType: string; isBase64: boolean; data: string } | null => {
    if (!dataUrl.startsWith("data:")) return null;

    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex < 0) return null;

    const header = dataUrl.slice(5, commaIndex);
    const data = dataUrl.slice(commaIndex + 1);
    const headerParts = header.split(";").filter(Boolean);
    const isBase64 = headerParts.includes("base64");
    const mimeType = headerParts.find((part) => part !== "base64") || "text/plain;charset=utf-8";
    return { mimeType, isBase64, data };
};

export const decodeDataUrlText = (value: string): string => {
    const parsed = parseDataUrl(value);
    if (!parsed) return value;

    if (parsed.isBase64) {
        const binary = atob(parsed.data);
        return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    }

    return decodeURIComponent(parsed.data.replace(/\+/g, "%20"));
};

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return new Blob([dataUrl], { type: "text/plain;charset=utf-8" });

    if (parsed.isBase64) {
        const binary = atob(parsed.data);
        return new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], { type: parsed.mimeType });
    }

    return new Blob([decodeURIComponent(parsed.data.replace(/\+/g, "%20"))], { type: parsed.mimeType });
};

export const saveBlob = (fileName: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

export const saveTextWithFallback = async (fileName: string, contents: string, mimeType = "text/plain;charset=utf-8") => {
    const saveFileFn = window.toolboxAPI?.utils && (window.toolboxAPI.utils as any).saveFile;

    if (typeof saveFileFn === "function") {
        await saveFileFn(fileName, contents);
        return;
    }

    saveBlob(fileName, new Blob([contents], { type: mimeType }));
};

export const buildFlowHtmlDocument = (baseName: string, svgMarkup: string): string => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    body { margin: 0; padding: 16px; font-family: Segoe UI, sans-serif; background: #f8fafc; }
    .flow-export-surface { display: inline-block; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: auto; }
    .flow-export-surface svg { display: block; width: 100%; height: auto; }
  </style>
</head>
<body>
    <div class="flow-export-surface">${svgMarkup}</div>
</body>
</html>`;

export const buildMermaidHtmlDocument = (baseName: string, diagram: string): string => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    body { margin: 0; padding: 16px; font-family: Segoe UI, sans-serif; background: #f8fafc; }
    .mermaid { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  </style>
</head>
<body>
  <div class="mermaid">${escapeHtml(diagram)}</div>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: true, theme: "default" });
  </script>
</body>
</html>`;

export const buildPlantUmlHtmlDocument = (baseName: string, encodedDiagramUrl: string): string => `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    body { margin: 0; padding: 16px; font-family: Segoe UI, sans-serif; background: #f8fafc; }
    .frame { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; overflow: auto; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="frame"><img src="${encodedDiagramUrl}" alt="PlantUML Diagram" /></div>
</body>
</html>`;

export const buildDrawIoHtmlDocument = (baseName: string, diagram: string): string => {
    const drawioUrl = `https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=ERD#R${encodeURIComponent(diagram)}`;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(baseName)}</title>
  <style>
    html, body { margin: 0; height: 100%; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe src="${drawioUrl}" title="Draw.io Diagram"></iframe>
</body>
</html>`;
};

export const svgToPngBlob = async (svgMarkup: string): Promise<Blob> => {
    const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(svgBlob);

    try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Failed to convert SVG to PNG."));
            img.src = objectUrl;
        });

        const width = Math.max(1, Math.ceil(image.width || 1200));
        const height = Math.max(1, Math.ceil(image.height || 800));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas 2D context unavailable.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("Failed to encode PNG.");
        return blob;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
};

export const getFlowVisualExportArtifact = async (
    canvasNode: HTMLElement | null,
    reactFlowInstance: ReactFlowInstance<any, any> | null,
    visualType: VisualExportType,
    baseName: string,
): Promise<{ fileName: string; contents?: string; mimeType?: string; blob?: Blob }> => {
    if (!canvasNode) {
        throw new Error("Flow canvas not found for visual export.");
    }

    const previousViewport = reactFlowInstance?.toObject().viewport;
    if (reactFlowInstance) {
        await reactFlowInstance.fitView({ padding: 0.2, duration: 0 });
        await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    }

    const restoreViewport = async () => {
        if (!reactFlowInstance || !previousViewport) return;
        await reactFlowInstance.setViewport(previousViewport, { duration: 0 });
    };

    try {
        if (visualType === "html") {
            const svgDataUrl = await toSvg(canvasNode, { cacheBust: true, pixelRatio: 2, width: canvasNode.scrollWidth, height: canvasNode.scrollHeight });
            return {
                fileName: `${baseName}.html`,
                contents: buildFlowHtmlDocument(baseName, decodeDataUrlText(svgDataUrl)),
                mimeType: "text/html;charset=utf-8",
            };
        }

        if (visualType === "svg") {
            const svgDataUrl = await toSvg(canvasNode, { cacheBust: true, pixelRatio: 2, width: canvasNode.scrollWidth, height: canvasNode.scrollHeight });
            return {
                fileName: `${baseName}.svg`,
                contents: decodeDataUrlText(svgDataUrl),
                mimeType: "image/svg+xml;charset=utf-8",
            };
        }

        const pngDataUrl = await toPng(canvasNode, { cacheBust: true, pixelRatio: 2, width: canvasNode.scrollWidth, height: canvasNode.scrollHeight });
        return {
            fileName: `${baseName}.png`,
            blob: await dataUrlToBlob(pngDataUrl),
        };
    } finally {
        await restoreViewport();
    }
};

export const getDiagramVisualExportArtifact = async (
    format: OutputFormat,
    diagram: string,
    baseName: string,
    visualType: VisualExportType,
    canvasNode: HTMLElement | null,
    reactFlowInstance: ReactFlowInstance<any, any> | null,
): Promise<{ fileName: string; contents?: string; mimeType?: string; blob?: Blob }> => {
    if (format === "flow") {
        return getFlowVisualExportArtifact(canvasNode, reactFlowInstance, visualType, baseName);
    }

    if (format === "mermaid") {
        if (visualType === "svg" || visualType === "png") {
            if (!window.mermaid) {
                throw new Error("Mermaid renderer is unavailable.");
            }
            const renderId = `export-mermaid-${Math.random().toString(36).slice(2)}`;
            const result = await window.mermaid.render(renderId, diagram);

            if (visualType === "svg") {
                return { fileName: `${baseName}.svg`, contents: result.svg, mimeType: "image/svg+xml;charset=utf-8" };
            }

            return { fileName: `${baseName}.png`, blob: await svgToPngBlob(result.svg) };
        }

        return {
            fileName: `${baseName}.html`,
            contents: buildMermaidHtmlDocument(baseName, diagram),
            mimeType: "text/html;charset=utf-8",
        };
    }

    if (format === "plantuml") {
        const encoded = plantumlEncoder.encode(diagram);
        if (visualType === "svg") {
            const response = await fetch(`https://www.plantuml.com/plantuml/svg/${encoded}`);
            if (!response.ok) throw new Error(`PlantUML HTTP ${response.status}`);
            return { fileName: `${baseName}.svg`, contents: await response.text(), mimeType: "image/svg+xml;charset=utf-8" };
        }

        if (visualType === "png") {
            const response = await fetch(`https://www.plantuml.com/plantuml/png/${encoded}`);
            if (!response.ok) throw new Error(`PlantUML HTTP ${response.status}`);
            return { fileName: `${baseName}.png`, blob: await response.blob() };
        }

        return {
            fileName: `${baseName}.html`,
            contents: buildPlantUmlHtmlDocument(baseName, `https://www.plantuml.com/plantuml/svg/${encoded}`),
            mimeType: "text/html;charset=utf-8",
        };
    }

    if (visualType !== "html") {
        throw new Error("Draw.io visual export currently supports HTML only.");
    }

    return {
        fileName: `${baseName}.html`,
        contents: buildDrawIoHtmlDocument(baseName, diagram),
        mimeType: "text/html;charset=utf-8",
    };
};
