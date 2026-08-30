import { ViewInfo } from "./interfaces";

/**
 * SavedQuery.QueryType values
 * https://learn.microsoft.com/en-us/power-apps/developer/data-platform/saved-queries
 */
export const QUERY_TYPE = {
    MAIN_APPLICATION_VIEW: 0,
    ADVANCED_SEARCH: 1,
    SUB_GRID: 2,
    QUICK_FIND_SEARCH: 4,
    REPORTING: 8,
    OFFLINE_FILTERS: 16,
    LOOKUP_VIEW: 64,
    SM_APPOINTMENT_BOOK_VIEW: 128,
    OUTLOOK_FILTERS: 256,
    ADDRESS_BOOK_FILTERS: 512,
    MAIN_APPLICATION_VIEW_WITHOUT_SUBJECT: 1024,
    OTHER: 2048,
    INTERACTIVE_WORKFLOW_VIEW: 4096,
    OFFLINE_TEMPLATE: 8192,
    CUSTOM_DEFINED_VIEW: 16384,
} as const;

interface ViewTypeMeta {
    label: string;
    /** css badge modifier class */
    tone: "default" | "public" | "personal" | "lookup" | "quickfind" | "associated" | "advancedfind" | "other";
}

const QUERY_TYPE_META: Record<number, ViewTypeMeta> = {
    [QUERY_TYPE.MAIN_APPLICATION_VIEW]: { label: "Public View", tone: "public" },
    [QUERY_TYPE.ADVANCED_SEARCH]: { label: "Advanced Find View", tone: "advancedfind" },
    [QUERY_TYPE.SUB_GRID]: { label: "Associated View", tone: "associated" },
    [QUERY_TYPE.QUICK_FIND_SEARCH]: { label: "Quick Find View", tone: "quickfind" },
    [QUERY_TYPE.REPORTING]: { label: "Reporting View", tone: "other" },
    [QUERY_TYPE.OFFLINE_FILTERS]: { label: "Offline Filters", tone: "other" },
    [QUERY_TYPE.LOOKUP_VIEW]: { label: "Lookup View", tone: "lookup" },
    [QUERY_TYPE.SM_APPOINTMENT_BOOK_VIEW]: { label: "Appointment Book View", tone: "other" },
    [QUERY_TYPE.OUTLOOK_FILTERS]: { label: "Outlook Filters", tone: "other" },
    [QUERY_TYPE.ADDRESS_BOOK_FILTERS]: { label: "Address Book Filters", tone: "other" },
    [QUERY_TYPE.MAIN_APPLICATION_VIEW_WITHOUT_SUBJECT]: { label: "Main App View", tone: "public" },
    [QUERY_TYPE.OTHER]: { label: "Other View", tone: "other" },
    [QUERY_TYPE.INTERACTIVE_WORKFLOW_VIEW]: { label: "Interactive Experience View", tone: "other" },
    [QUERY_TYPE.OFFLINE_TEMPLATE]: { label: "Offline Template", tone: "other" },
    [QUERY_TYPE.CUSTOM_DEFINED_VIEW]: { label: "Custom Defined View", tone: "other" },
};

export function getViewTypeLabel(view: Pick<ViewInfo, "querytype" | "isDefault" | "isPersonal">): string {
    if (view.isPersonal) {
        return "Personal View";
    }
    if (view.querytype === QUERY_TYPE.MAIN_APPLICATION_VIEW && view.isDefault) {
        return "Default Public View";
    }
    return QUERY_TYPE_META[view.querytype]?.label ?? `View (type ${view.querytype})`;
}

export function getViewTypeTone(view: Pick<ViewInfo, "querytype" | "isDefault" | "isPersonal">): ViewTypeMeta["tone"] {
    if (view.isPersonal) {
        return "personal";
    }
    if (view.querytype === QUERY_TYPE.MAIN_APPLICATION_VIEW && view.isDefault) {
        return "default";
    }
    return QUERY_TYPE_META[view.querytype]?.tone ?? "other";
}

export function isLookupView(view: Pick<ViewInfo, "querytype">): boolean {
    return view.querytype === QUERY_TYPE.LOOKUP_VIEW;
}

/** Grid components are not supported by personal or special-purpose search views. */
export function supportsComponents(view: Pick<ViewInfo, "querytype" | "isPersonal">): boolean {
    return (
        !view.isPersonal &&
        view.querytype !== QUERY_TYPE.ADVANCED_SEARCH &&
        view.querytype !== QUERY_TYPE.QUICK_FIND_SEARCH &&
        view.querytype !== QUERY_TYPE.LOOKUP_VIEW
    );
}

/** Sort order used to present views: default public first, then public, then the rest, personal last */
export function viewTypeRank(view: Pick<ViewInfo, "querytype" | "isDefault" | "isPersonal">): number {
    if (view.isPersonal) return 90;
    if (view.querytype === QUERY_TYPE.MAIN_APPLICATION_VIEW) return view.isDefault ? 0 : 1;
    switch (view.querytype) {
        case QUERY_TYPE.ADVANCED_SEARCH:
            return 10;
        case QUERY_TYPE.SUB_GRID:
            return 20;
        case QUERY_TYPE.QUICK_FIND_SEARCH:
            return 30;
        case QUERY_TYPE.LOOKUP_VIEW:
            return 40;
        default:
            return 50;
    }
}
