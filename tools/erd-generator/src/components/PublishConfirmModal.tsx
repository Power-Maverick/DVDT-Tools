interface PublishReview {
    newTables: string[];
    renamedTables: string[];
    newAttributes: string[];
    renamedAttributes: string[];
    newRelationships: string[];
}

interface PublishConfirmModalProps {
    changeCount: number;
    publishReview: PublishReview | null;
    onCancel: () => void;
    onConfirmPublish: () => void;
}

export function PublishConfirmModal(props: PublishConfirmModalProps) {
    return (
        <div className="modal-overlay">
            <div className="modal-card modal-card-review">
                <h3>Publish changes</h3>
                <p>Review {props.changeCount} change(s) before publishing to Dataverse.</p>
                {props.publishReview && (
                    <div className="publish-review">
                        {props.publishReview.newTables.length > 0 && (
                            <div>
                                <div className="publish-review-title">New tables ({props.publishReview.newTables.length})</div>
                                {props.publishReview.newTables.map((item) => (
                                    <div key={`new-table-${item}`} className="publish-review-item">
                                        + {item}
                                    </div>
                                ))}
                            </div>
                        )}
                        {props.publishReview.renamedTables.length > 0 && (
                            <div>
                                <div className="publish-review-title">Renamed tables ({props.publishReview.renamedTables.length})</div>
                                {props.publishReview.renamedTables.map((item) => (
                                    <div key={`renamed-table-${item}`} className="publish-review-item">
                                        ~ {item}
                                    </div>
                                ))}
                            </div>
                        )}
                        {props.publishReview.newAttributes.length > 0 && (
                            <div>
                                <div className="publish-review-title">New attributes ({props.publishReview.newAttributes.length})</div>
                                {props.publishReview.newAttributes.map((item) => (
                                    <div key={`new-attr-${item}`} className="publish-review-item">
                                        + {item}
                                    </div>
                                ))}
                            </div>
                        )}
                        {props.publishReview.renamedAttributes.length > 0 && (
                            <div>
                                <div className="publish-review-title">Renamed attributes ({props.publishReview.renamedAttributes.length})</div>
                                {props.publishReview.renamedAttributes.map((item) => (
                                    <div key={`renamed-attr-${item}`} className="publish-review-item">
                                        ~ {item}
                                    </div>
                                ))}
                            </div>
                        )}
                        {props.publishReview.newRelationships.length > 0 && (
                            <div>
                                <div className="publish-review-title">New relationships ({props.publishReview.newRelationships.length})</div>
                                {props.publishReview.newRelationships.map((item) => (
                                    <div key={`new-rel-${item}`} className="publish-review-item">
                                        + {item}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <div className="panel-row">
                    <button className="btn btn-secondary" onClick={props.onCancel}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={props.onConfirmPublish}>
                        Confirm Publish
                    </button>
                </div>
            </div>
        </div>
    );
}
