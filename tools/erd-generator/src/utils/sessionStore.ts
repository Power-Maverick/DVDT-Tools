import { ERDEditorModel } from "../models/editor";
import { GraphPositions } from "./graphLayout";

export interface PersistedSession {
    version: number;
    solutionUniqueName: string;
    baselineModel: ERDEditorModel | null;
    workingModel: ERDEditorModel;
    positions: GraphPositions;
    visualMode: string;
    edgeType: string;
    hideAttributes: boolean;
    hideRelationshipNames: boolean;
    showChangedOnlyInGraph: boolean;
    showImpactMarkers: boolean;
    includeAttributes: boolean;
    includeRelationships: boolean;
    maxAttributesPerTable: number;
    exportSource: "working" | "baseline";
    exportChangedOnly: boolean;
    selectedTableId: string;
    relationshipTarget: string;
}

export const SESSION_STORAGE_KEY = "pptb.erd.session.v1";
export const SESSION_LIBRARY_KEY = "pptb.erd.sessions.v1";

export const readSessionLibrary = (): Record<string, PersistedSession> => {
    const raw = localStorage.getItem(SESSION_LIBRARY_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as Record<string, PersistedSession>;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

export const writeSessionLibrary = (library: Record<string, PersistedSession>) => {
    localStorage.setItem(SESSION_LIBRARY_KEY, JSON.stringify(library));
};

export const readCurrentSession = (): PersistedSession | null => {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as PersistedSession;
    } catch {
        return null;
    }
};

export const writeCurrentSession = (session: PersistedSession) => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};
