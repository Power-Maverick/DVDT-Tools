export interface Solution {
    id: string;
    uniqueName: string;
    displayName: string;
    version: string;
}

export interface TableInfo {
    logicalName: string;
    schemaName: string;
    displayName: string;
    objectTypeCode: number;
    metadataId: string;
    primaryNameAttribute: string;
}

export interface ViewInfo {
    id: string;
    name: string;
    description?: string;
    fetchxml: string;
    layoutxml: string;
    layoutjson?: string | null;
    returnedtypecode: string;
    querytype: number;
    isDefault: boolean;
    /** true when the view is a personal view (userquery) instead of a system view (savedquery) */
    isPersonal: boolean;
}

export interface CopyOptions {
    columnLayout: boolean;
    sortOrder: boolean;
    components: boolean;
}

export interface CopyResultItem {
    viewId: string;
    viewName: string;
    status: "pending" | "success" | "error";
    message?: string;
}
