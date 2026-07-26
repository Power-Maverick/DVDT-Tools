interface PublishResult {
    success: boolean;
    lines: string[];
}

interface PublishResultModalProps {
    publishResult: PublishResult;
    onClose: () => void;
}

export function PublishResultModal(props: PublishResultModalProps) {
    return (
        <div className="modal-overlay">
            <div className="modal-card">
                <h3>{props.publishResult.success ? "✅ Published successfully" : "⚠️ Published with errors"}</h3>
                <div className={`publish-result ${props.publishResult.success ? "is-success" : "is-error"}`}>
                    {props.publishResult.lines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                    ))}
                    {!props.publishResult.success && <div className="muted-text">Some operations failed. Review errors and re-run publish.</div>}
                </div>
                <button className="btn btn-primary" onClick={props.onClose}>
                    Close
                </button>
            </div>
        </div>
    );
}
