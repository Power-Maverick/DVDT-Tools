import plantumlEncoder from "plantuml-encoder";

interface DiagramPreviewProps {
    format: "mermaid" | "plantuml" | "drawio";
    previewMode: "visual" | "text";
    diagram: string;
    mermaidReady: boolean;
    ensureMermaid: () => Promise<void>;
}

export function DiagramPreview(props: DiagramPreviewProps) {
    if (!props.diagram) {
        return <div className="loading-mermaid">No diagram generated yet.</div>;
    }

    if (props.previewMode === "text") {
        return <pre className="diagram-text">{props.diagram}</pre>;
    }

    if (props.format === "mermaid") {
        if (!props.mermaidReady) return <div className="loading-mermaid">Loading mermaid renderer...</div>;
        return (
            <div
                className="mermaid"
                ref={(el) => {
                    (async () => {
                        if (!el) return;
                        try {
                            await props.ensureMermaid();
                            if (window.mermaid) {
                                const renderId = `erd-mermaid-${Math.random().toString(36).slice(2)}`;
                                const result = await window.mermaid.render(renderId, props.diagram);
                                el.innerHTML = result.svg;
                                if (result.bindFunctions) {
                                    result.bindFunctions(el);
                                }
                            }
                        } catch (err) {
                            console.error("Mermaid render error", err);
                            el.innerHTML = `<div class=\"loading-mermaid\">Cannot render Mermaid. ${(err as Error).message}</div>`;
                        }
                    })();
                }}
            />
        );
    }

    if (props.format === "plantuml") {
        return (
            <div
                className="diagram-visual"
                ref={(el) => {
                    (async () => {
                        if (!el) return;
                        try {
                            const encoded = plantumlEncoder.encode(props.diagram);
                            const response = await fetch(`https://www.plantuml.com/plantuml/svg/${encoded}`);
                            if (!response.ok) throw new Error(`PlantUML HTTP ${response.status}`);
                            const svgText = await response.text();
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(svgText, "image/svg+xml");
                            const svg = doc.querySelector("svg");
                            if (!svg) throw new Error("No SVG returned from PlantUML.");
                            svg.querySelectorAll("script").forEach((node) => node.remove());
                            svg.querySelectorAll("*").forEach((node) => {
                                Array.from(node.attributes).forEach((attr) => {
                                    if (attr.name.toLowerCase().startsWith("on")) {
                                        node.removeAttribute(attr.name);
                                    }
                                });
                            });
                            el.innerHTML = "";
                            el.appendChild(svg);
                        } catch (err) {
                            el.innerHTML = `<div class=\"loading-mermaid\">Cannot render PlantUML. ${(err as Error).message}</div>`;
                        }
                    })();
                }}
            />
        );
    }

    return (
        <div
            className="diagram-visual"
            ref={(el) => {
                if (!el) return;
                const iframe = document.createElement("iframe");
                iframe.style.width = "100%";
                iframe.style.height = "600px";
                iframe.style.border = "1px solid var(--border-color)";
                iframe.style.borderRadius = "6px";
                iframe.src = `https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=ERD#R${encodeURIComponent(props.diagram)}`;
                el.innerHTML = "";
                el.appendChild(iframe);
            }}
        />
    );
}
