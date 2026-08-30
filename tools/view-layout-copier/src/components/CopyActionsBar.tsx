import { CopyOptions, CopyResultItem, ViewInfo } from "../models/interfaces";

interface CopyActionsBarProps {
    options: CopyOptions;
    sourceView?: ViewInfo;
    targetCount: number;
    /** names of selected lookup-view targets when the source's first column is not the primary name attribute */
    lookupBlockedViews: string[];
    primaryNameAttribute: string;
    isCopying: boolean;
    results: CopyResultItem[];
    publishStatus: "pending" | "success" | "error" | null;
    publishMessage?: string;
    onCopy: () => void;
    onReset: () => void;
}

export function CopyActionsBar({
    options,
    sourceView,
    targetCount,
    lookupBlockedViews,
    primaryNameAttribute,
    isCopying,
    results,
    publishStatus,
    publishMessage,
    onCopy,
    onReset,
}: CopyActionsBarProps) {
    const nothingToCopy = !options.columnLayout && !options.sortOrder && !options.components;
    const canCopy = !!sourceView && targetCount > 0 && lookupBlockedViews.length === 0 && !nothingToCopy && !isCopying;

    return (
        <section className="panel copy-actions-bar">
            {lookupBlockedViews.length > 0 && (
                <div className="warning-box" role="alert">
                    <strong>Lookup view update blocked</strong>
                    <p>
                        A lookup view should always have <code>{primaryNameAttribute}</code> (the primary name column) as its <em>first</em> column, otherwise lookups will have difficulty working on
                        forms. The source layout's first column is different, so the column layout cannot be applied to:
                    </p>
                    <ul>
                        {lookupBlockedViews.map((name) => (
                            <li key={name}>{name}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="copy-actions">
                <button type="button" className="btn btn-primary" onClick={onCopy} disabled={!canCopy}>
                    {isCopying ? "Copying…" : `Copy & publish (${targetCount})`}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onReset} disabled={isCopying}>
                    Reset
                </button>
            </div>
            {nothingToCopy && <div className="list-hint">Enable at least one copy option on the Configuration tab.</div>}

            {(results.length > 0 || publishStatus) && (
                <div className="progress-list">
                    {results.map((item) => (
                        <div key={item.viewId} className={`progress-item ${item.status}`}>
                            <span className="status-icon" aria-hidden="true">
                                {item.status === "success" && "✓"}
                                {item.status === "error" && "✕"}
                                {item.status === "pending" && "…"}
                            </span>
                            <span className="progress-body">
                                <span className="progress-name">{item.viewName}</span>
                                {item.message && <span className="progress-message">{item.message}</span>}
                            </span>
                        </div>
                    ))}
                    {publishStatus && (
                        <div className={`progress-item publish-item ${publishStatus}`}>
                            <span className="status-icon" aria-hidden="true">
                                {publishStatus === "success" && "✓"}
                                {publishStatus === "error" && "✕"}
                                {publishStatus === "pending" && "…"}
                            </span>
                            <span className="progress-body">
                                <span className="progress-name">Publish</span>
                                {publishMessage && <span className="progress-message">{publishMessage}</span>}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
