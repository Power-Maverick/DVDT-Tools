export interface SecurityRole {
    roleid: string;
    name: string;
    solutionid?: string;
    ismanaged?: boolean;
    roletemplateid?: string;
    isautoassigned?: number;
    issystemgenerated?: boolean;
    isinherited?: number;
    canbedeleted?: boolean;
    _businessunitid_value?: string;
    businessunitName?: string;
}

export interface DataverseSolution {
    solutionid: string;
    friendlyname?: string;
    uniquename?: string;
    ismanaged?: boolean;
    parentsolutionid?: string;
}

export interface EntityDisplayInfo {
    logicalName: string;
    schemaName: string;
    displayName: string;
    isCustom: boolean;
}

/** Kind of privilege grouping category, mirroring the OOB security role editor. */
export type PrivilegeCategoryKind = "table" | "misc" | "privacy";

/** RoleEditorLayout item types (from the roleeditorlayout_itemtype choice). */
export enum RoleEditorLayoutItemType {
    Root = 1,
    Tab = 2,
    MiscellaneousSection = 3,
    Entity = 4,
    Privilege = 5,
}

/** A single role-editor-layout item (tab, section, entity, or privilege). */
export interface RoleEditorLayoutItem {
    id: string;
    displayName: string;
    entityLogicalName?: string;
    privilegeName?: string;
    itemType: number;
    isPrivacyRelated: boolean;
    tabOrder?: number;
    parentId?: string;
}

/** Maps the Dataverse PrivilegeType enum (from EntityDefinitions.Privileges) to an operation label. */
export const PRIVILEGE_TYPE_TO_OPERATION: Record<number, string> = {
    1: "Create",
    2: "Read",
    3: "Write",
    4: "Delete",
    5: "Assign",
    6: "Share",
    7: "Append",
    8: "AppendTo",
};

/** Placeholder "operation" shown for non-table (miscellaneous / privacy) privileges. */
export const NON_TABLE_OPERATION = "Enable";

export interface Privilege {
    privilegeid: string;
    name: string;
    accessright: number;
}

export interface RolePrivilegeDepth {
    privilegeid: string;
    privilegedepthid: PrivilegeDepth;
}

/** Privilege depth levels as used by Dataverse */
export enum PrivilegeDepth {
    None = 0,
    Basic = 1, // User level
    Local = 2, // Business Unit level
    Deep = 4, // Parent-Child Business Unit level
    Global = 8, // Organization level
}

/** Maps depth enum to a display label */
export const DEPTH_LABELS: Record<PrivilegeDepth, string> = {
    [PrivilegeDepth.None]: "None",
    [PrivilegeDepth.Basic]: "User",
    [PrivilegeDepth.Local]: "Business Unit",
    [PrivilegeDepth.Deep]: "Parent-Child BU",
    [PrivilegeDepth.Global]: "Organization",
};

/** Ordinal rank of a privilege depth (higher = more permission). Handles gaps in the enum values. */
const DEPTH_RANK: Record<number, number> = {
    [PrivilegeDepth.None]: 0,
    [PrivilegeDepth.Basic]: 1,
    [PrivilegeDepth.Local]: 2,
    [PrivilegeDepth.Deep]: 3,
    [PrivilegeDepth.Global]: 4,
};

/** Normalizes any depth value to its ordinal rank; unknown/missing values are treated as None. */
export function depthRank(depth: PrivilegeDepth | number | undefined | null): number {
    if (depth == null) return 0;
    return DEPTH_RANK[depth] ?? 0;
}

/** A resolved privilege entry with entity and operation parsed from the privilege name */
export interface ParsedPrivilege {
    privilegeid: string;
    rawName: string;
    entityLogicalName: string;
    entitySchemaName: string;
    entityDisplayName: string;
    entitySearchText: string;
    operation: string;
    /** Grouping category derived from the role editor layout (or fallback). */
    categoryKind: PrivilegeCategoryKind;
    /** Stable key for the category (layout id or fallback token), used for grouping. */
    categoryKey: string;
    /** Localized category label for display. */
    categoryLabel: string;
    /** Display order of the category within its kind. */
    categoryOrder: number;
    /** Depth per role (keyed by roleid) */
    depthByRole: Record<string, PrivilegeDepth>;
}

/** Sort rank for a category kind: tables first, then miscellaneous, then privacy. */
export const CATEGORY_KIND_ORDER: Record<PrivilegeCategoryKind, number> = {
    table: 0,
    misc: 1,
    privacy: 2,
};

/** Standard privilege operations extracted from privilege names */
export const PRIVILEGE_OPERATIONS = ["Create", "Read", "Write", "Delete", "Append", "AppendTo", "Assign", "Share"] as const;
export type PrivilegeOperation = (typeof PRIVILEGE_OPERATIONS)[number];

/** Canonical display/sort order for operations, matching the built-in role editor (non-table last). */
export const OPERATION_SORT_ORDER = [...PRIVILEGE_OPERATIONS, NON_TABLE_OPERATION];

/** Sort rank for an operation; unknown operations sort after all known ones. */
export function operationRank(operation: string): number {
    const index = OPERATION_SORT_ORDER.indexOf(operation as (typeof OPERATION_SORT_ORDER)[number]);
    return index === -1 ? OPERATION_SORT_ORDER.length : index;
}

/**
 * Operations checked longest-first so more specific prefixes win. Without this, "AppendTo"
 * privileges (e.g. prvAppendTocai_Allocation) would incorrectly match "Append" and leave a
 * bogus "Tocai_Allocation" entity instead of "cai_Allocation".
 */
const OPERATIONS_BY_LENGTH_DESC = [...PRIVILEGE_OPERATIONS].sort((a, b) => b.length - a.length);

/** Parsed details of a privilege name */
export interface ParsedPrivilegeName {
    entityToken: string;
    entityLogicalName: string;
    operation: string;
    /** True when the privilege name matched a known CRUD-style operation prefix. */
    isKnownOperation: boolean;
}

/**
 * Parses a Dataverse privilege name like "prvCreateAccount" into entity + operation.
 * Falls back to a "Miscellaneous" entity for non-standard privilege names.
 */
export function parsePrivilegeName(name: string): ParsedPrivilegeName {
    const stripped = name.startsWith("prv") ? name.substring(3) : name;
    for (const op of OPERATIONS_BY_LENGTH_DESC) {
        if (stripped.startsWith(op)) {
            const entityToken = stripped.substring(op.length) || "Global";
            return {
                entityToken,
                entityLogicalName: entityToken.toLowerCase(),
                operation: op,
                isKnownOperation: true,
            };
        }
    }
    return {
        entityToken: stripped,
        entityLogicalName: stripped.toLowerCase(),
        operation: stripped,
        isKnownOperation: false,
    };
}
