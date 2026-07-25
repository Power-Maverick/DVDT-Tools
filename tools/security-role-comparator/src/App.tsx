import { Button, Dropdown, MessageBar, MessageBarBody, Option, SearchBox, Spinner, Tooltip } from "@fluentui/react-components";
import {
    AddCircleFilled,
    ArrowSyncRegular,
    DismissCircleRegular,
    OrganizationRegular,
    PeopleRegular,
    PeopleTeamRegular,
    PersonRegular,
    ProhibitedRegular,
    SubtractCircleFilled,
} from "@fluentui/react-icons";
import { ComponentType, CSSProperties, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { DEPTH_LABELS, depthRank, NON_TABLE_OPERATION, ParsedPrivilege, PrivilegeDepth, SecurityRole } from "./models/interfaces";
import "./styles.css";
import { DataverseConnector } from "./utils/dataverseClient";

const MAX_COMPARE_ROLES = 5;
const STORAGE_PREFIX = "security-role-comparator:recent-selections:v1";

/** Ordered list of operation values used by the operation filter (incl. the non-table placeholder). */
const OPERATION_ORDER = ["Create", "Read", "Write", "Delete", "Append", "AppendTo", "Assign", "Share", NON_TABLE_OPERATION];

/** Friendlier labels for operation values (others display as-is). */
const OPERATION_LABELS: Record<string, string> = { AppendTo: "Append To" };
const operationLabel = (op: string) => OPERATION_LABELS[op] ?? op;

/** Sentinel value for the "All" shortcut option in the multi-select filters. */
const ALL_VALUE = "__all__";

/**
 * Computes the next multi-select state when an option is toggled, with an "All" shortcut.
 * State is either [ALL_VALUE] (everything), a concrete subset (in `available` order), or [] (none).
 * - Clicking "All" selects everything, or clears everything if already in "all" mode.
 * - Clicking an individual option while in "all" mode starts a fresh selection of just that option.
 * - Otherwise the individual option is toggled in/out of the current subset.
 */
function toggleMultiSelect(optionValue: string, current: string[], available: string[]): string[] {
    const allMode = current.includes(ALL_VALUE);
    if (optionValue === ALL_VALUE) {
        return allMode ? [] : [ALL_VALUE];
    }
    if (allMode) {
        return [optionValue];
    }
    const set = new Set(current);
    if (set.has(optionValue)) set.delete(optionValue);
    else set.add(optionValue);
    return available.filter((value) => set.has(value));
}

/** True when a value passes a multi-select filter ("all" mode passes everything). */
const passesMultiSelect = (value: string, selected: string[]) => selected.includes(ALL_VALUE) || selected.includes(value);

/** Summary text shown in the multi-select filter's closed state. */
function multiSelectSummary(selected: string[], available: string[], noun: string): string {
    if (selected.includes(ALL_VALUE)) return `All ${noun}`;
    if (selected.length === 0) return `No ${noun}`;
    return `${selected.length} of ${available.length} ${noun}`;
}

/** Row-level filter modes for the comparison grid. */
type DiffFilter = "differences" | "more" | "less" | "same" | "all";

const DIFF_FILTER_OPTIONS: { value: DiffFilter; label: string }[] = [
    { value: "differences", label: "All differences" },
    { value: "more", label: "More than base" },
    { value: "less", label: "Less than base" },
    { value: "same", label: "Same as base" },
    { value: "all", label: "Show all" },
];

type DepthIconInfo = { Icon: ComponentType<{ className?: string; style?: CSSProperties; "aria-label"?: string }>; color: string };

/**
 * Fluent icons chosen to mirror the OOB Dataverse security-role editor depth glyphs,
 * colored to echo that legend (None red, User teal, Business Unit blue, Parent-Child red,
 * Organization green).
 */
const DEPTH_ICON: Record<PrivilegeDepth, DepthIconInfo> = {
    [PrivilegeDepth.None]: { Icon: ProhibitedRegular, color: "#c50f1f" },
    [PrivilegeDepth.Basic]: { Icon: PersonRegular, color: "#038387" },
    [PrivilegeDepth.Local]: { Icon: PeopleRegular, color: "#0f6cbd" },
    [PrivilegeDepth.Deep]: { Icon: PeopleTeamRegular, color: "#d13438" },
    [PrivilegeDepth.Global]: { Icon: OrganizationRegular, color: "#107c10" },
};

interface SavedSelections {
    version: 1;
    baseRoleId: string;
    compareRoleIds: string[];
}

function buildStorageKey(envUrl: string): string {
    try {
        return `${STORAGE_PREFIX}:${new URL(envUrl).origin}`;
    } catch {
        return `${STORAGE_PREFIX}:${envUrl}`;
    }
}

function readSavedSelections(storageKey: string): SavedSelections | null {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<SavedSelections>;
        if (parsed.version !== 1) return null;

        return {
            version: 1,
            baseRoleId: typeof parsed.baseRoleId === "string" ? parsed.baseRoleId : "",
            compareRoleIds: Array.isArray(parsed.compareRoleIds) ? parsed.compareRoleIds.filter((value): value is string => typeof value === "string") : [],
        };
    } catch {
        return null;
    }
}

function saveSavedSelections(storageKey: string, selections: SavedSelections): void {
    try {
        window.localStorage.setItem(storageKey, JSON.stringify(selections));
    } catch {
        // Browser storage may be unavailable or disabled; persistence is optional.
    }
}

function getRoleGroupLabel(isManaged: boolean): string {
    return isManaged ? "Managed Roles" : "Unmanaged Roles";
}

function getRoleDisplayName(role: SecurityRole, duplicateNames: Set<string>): string {
    // Disambiguate same-named roles by business unit; otherwise show the plain role name.
    if (duplicateNames.has(role.name) && role.businessunitName) {
        return `${role.name} · ${role.businessunitName}`;
    }
    return role.name;
}

function normalizeSelections(preferredIds: string[], validIds: Set<string>, disallowIds: Set<string> = new Set<string>()): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const id of preferredIds) {
        if (!id || !validIds.has(id) || disallowIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        normalized.push(id);
        if (normalized.length === MAX_COMPARE_ROLES) break;
    }

    return normalized;
}

/** Renders the Fluent icon representing a privilege depth level. */
function DepthIcon({ depth }: { depth: PrivilegeDepth }) {
    const { Icon, color } = DEPTH_ICON[depth] ?? DEPTH_ICON[PrivilegeDepth.None];
    return (
        <Tooltip content={DEPTH_LABELS[depth]} relationship="label">
            <Icon className="depth-icon" style={{ color }} aria-label={DEPTH_LABELS[depth]} />
        </Tooltip>
    );
}

export default function App() {
    const [roles, setRoles] = useState<SecurityRole[]>([]);
    const [loadingEnvironment, setLoadingEnvironment] = useState(false);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [baseRoleId, setBaseRoleId] = useState<string>("");
    const [compareRoleIds, setCompareRoleIds] = useState<string[]>([""]);
    const [comparing, setComparing] = useState(false);
    const [comparisonData, setComparisonData] = useState<ParsedPrivilege[]>([]);
    const [comparedRoleIds, setComparedRoleIds] = useState<string[]>([]);
    const [error, setError] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [diffFilter, setDiffFilter] = useState<DiffFilter>("differences");
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedOperations, setSelectedOperations] = useState<string[]>([]);
    const connectorRef = useRef<DataverseConnector | null>(null);
    const storageKeyRef = useRef<string>("");
    const initializedRef = useRef(false);

    useEffect(() => {
        void loadEnvironment();
    }, []);

    useEffect(() => {
        if (!initializedRef.current || !storageKeyRef.current) return;

        saveSavedSelections(storageKeyRef.current, {
            version: 1,
            baseRoleId,
            compareRoleIds: compareRoleIds.filter((id) => id !== ""),
        });
    }, [baseRoleId, compareRoleIds]);

    const applySelectionDefaults = (availableRoles: SecurityRole[], savedSelections: SavedSelections | null) => {
        const validRoleIds = new Set(availableRoles.map((role) => role.roleid));

        const baseId = savedSelections?.baseRoleId && validRoleIds.has(savedSelections.baseRoleId) ? savedSelections.baseRoleId : "";
        const compareIds = savedSelections ? normalizeSelections(savedSelections.compareRoleIds, validRoleIds, new Set(baseId ? [baseId] : [])) : [];

        setBaseRoleId(baseId);
        setCompareRoleIds(compareIds.length > 0 ? compareIds : [""]);
    };

    const loadEnvironment = async () => {
        setLoadingEnvironment(true);
        setError("");

        try {
            if (!window.toolboxAPI) throw new Error("Toolbox API not available");
            const conn = await window.toolboxAPI.connections.getActiveConnection();
            if (!conn?.url) throw new Error("No active connection found. Please connect to a Dataverse environment first.");

            connectorRef.current = new DataverseConnector(conn.url);
            storageKeyRef.current = buildStorageKey(conn.url);

            const savedSelections = readSavedSelections(storageKeyRef.current);
            const fetchedRoles = await connectorRef.current.fetchRoles();
            setRoles(fetchedRoles);
            applySelectionDefaults(fetchedRoles, savedSelections);

            setComparisonData([]);
            setComparedRoleIds([]);
            initializedRef.current = fetchedRoles.length > 0;

            if (!fetchedRoles.length) {
                setError("No security roles were found in the connected environment.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to load security roles");
        } finally {
            setLoadingEnvironment(false);
            setLoadingRoles(false);
        }
    };

    const addCompareSlot = () => {
        if (compareRoleIds.length < MAX_COMPARE_ROLES) {
            setCompareRoleIds((prev) => [...prev, ""]);
        }
    };

    const removeCompareSlot = (index: number) => {
        setCompareRoleIds((prev) => prev.filter((_, i) => i !== index));
    };

    const setCompareRole = (index: number, value: string) => {
        setCompareRoleIds((prev) => prev.map((id, i) => (i === index ? value : id)));
    };

    const canCompare = !!baseRoleId && compareRoleIds.some((id) => id !== "");

    const runComparisonWith = async (baseId: string, compareIds: string[]) => {
        if (!connectorRef.current) return;
        const activeCompareIds = compareIds.filter((id) => id !== "");
        if (!baseId || activeCompareIds.length === 0) return;

        setComparing(true);
        setError("");
        setComparisonData([]);
        try {
            const allIds = [baseId, ...activeCompareIds];
            const data = await connectorRef.current.buildComparisonData(allIds);
            setComparisonData(data);
            setComparedRoleIds(allIds);
        } catch (err: any) {
            setError(err.message || "Comparison failed");
            await DataverseConnector.showMessage("Error", err.message || "Comparison failed", "error");
        } finally {
            setComparing(false);
        }
    };

    const runComparison = () => runComparisonWith(baseRoleId, compareRoleIds);

    // Swap a compare-slot role with the current base role, then refresh the comparison.
    const setCompareRoleAsBase = async (index: number) => {
        const promotedRoleId = compareRoleIds[index];
        if (!promotedRoleId) return;
        const nextCompareIds = compareRoleIds.map((id, i) => (i === index ? baseRoleId : id));
        setBaseRoleId(promotedRoleId);
        setCompareRoleIds(nextCompareIds);
        await runComparisonWith(promotedRoleId, nextCompareIds);
    };

    const getRoleName = (roleId: string) => roles.find((r) => r.roleid === roleId)?.name ?? roleId;

    const getEntityLabel = (priv: ParsedPrivilege) => `${priv.entityDisplayName} (${priv.entitySchemaName})`;

    const unmanagedRoles = roles.filter((role) => !role.ismanaged);
    const managedRoles = roles.filter((role) => role.ismanaged);
    const duplicateRoleNames = useMemo(() => {
        const counts = new Map<string, number>();
        for (const role of roles) {
            counts.set(role.name, (counts.get(role.name) ?? 0) + 1);
        }
        return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([name]) => name));
    }, [roles]);

    const baseRoleForResults = comparedRoleIds[0];

    const getRowDiff = (priv: ParsedPrivilege) => {
        const baseRank = depthRank(priv.depthByRole[baseRoleForResults]);
        let hasMore = false;
        let hasLess = false;
        for (let i = 1; i < comparedRoleIds.length; i++) {
            const rank = depthRank(priv.depthByRole[comparedRoleIds[i]]);
            if (rank > baseRank) hasMore = true;
            else if (rank < baseRank) hasLess = true;
        }
        return { hasMore, hasLess };
    };

    const matchesDiffFilter = (priv: ParsedPrivilege) => {
        if (diffFilter === "all") return true;
        const { hasMore, hasLess } = getRowDiff(priv);
        switch (diffFilter) {
            case "differences":
                return hasMore || hasLess;
            case "more":
                return hasMore;
            case "less":
                return hasLess;
            case "same":
                return !hasMore && !hasLess;
            default:
                return true;
        }
    };

    // Distinct category labels present in the data, preserving the connector's ordering.
    const availableCategories = useMemo(() => {
        const seen: string[] = [];
        const set = new Set<string>();
        for (const priv of comparisonData) {
            if (!set.has(priv.categoryLabel)) {
                set.add(priv.categoryLabel);
                seen.push(priv.categoryLabel);
            }
        }
        return seen;
    }, [comparisonData]);

    // Operations present in the data, in a stable canonical order.
    const availableOperations = useMemo(() => {
        const present = new Set(comparisonData.map((priv) => priv.operation));
        return OPERATION_ORDER.filter((op) => present.has(op));
    }, [comparisonData]);

    // Default both multiselect filters to "all" whenever a new comparison is run.
    useEffect(() => {
        setSelectedCategories([ALL_VALUE]);
        setSelectedOperations([ALL_VALUE]);
    }, [comparisonData]); // eslint-disable-line react-hooks/exhaustive-deps

    const filteredData = comparisonData.filter((priv) => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            if (!priv.entitySearchText.includes(term) && !priv.operation.toLowerCase().includes(term) && !priv.rawName.toLowerCase().includes(term)) {
                return false;
            }
        }
        if (!passesMultiSelect(priv.categoryLabel, selectedCategories)) return false;
        if (!passesMultiSelect(priv.operation, selectedOperations)) return false;
        return matchesDiffFilter(priv);
    });

    // Two-level grouping: category (OOB tab / section) -> entity (or single misc privilege row).
    const categoryGroups = useMemo(() => {
        const categories = new Map<string, { key: string; label: string; kind: string; entityGroups: Map<string, ParsedPrivilege[]> }>();
        for (const priv of filteredData) {
            let category = categories.get(priv.categoryKey);
            if (!category) {
                category = { key: priv.categoryKey, label: priv.categoryLabel, kind: priv.categoryKind, entityGroups: new Map() };
                categories.set(priv.categoryKey, category);
            }
            const rows = category.entityGroups.get(priv.entityLogicalName);
            if (rows) rows.push(priv);
            else category.entityGroups.set(priv.entityLogicalName, [priv]);
        }
        // filteredData preserves the connector's category/entity/operation ordering, so Map
        // insertion order already reflects the intended display order.
        return Array.from(categories.values()).map((category) => ({
            key: category.key,
            label: category.label,
            kind: category.kind,
            entityGroups: Array.from(category.entityGroups.entries()).map(([entityKey, rows]) => ({ entityKey, rows })),
        }));
    }, [filteredData]);

    const columnCount = 2 + comparedRoleIds.length;
    const hasResults = comparisonData.length > 0;


    return (
        <div className="src-root">
            <div className="selector-bar">
                <div className="selector-row">
                    <div className="role-selector-group">
                        <label className="role-label base-label">Base Role</label>
                        <div className="select-wrapper">
                            <select className="role-select" value={baseRoleId} onChange={(e) => setBaseRoleId(e.target.value)} disabled={loadingEnvironment || loadingRoles}>
                                <option value="">— Select base role —</option>
                                <optgroup label={getRoleGroupLabel(false)}>
                                    {unmanagedRoles.map((role) => (
                                        <option key={role.roleid} value={role.roleid}>
                                            {getRoleDisplayName(role, duplicateRoleNames)}
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label={getRoleGroupLabel(true)}>
                                    {managedRoles.map((role) => (
                                        <option key={role.roleid} value={role.roleid}>
                                            {getRoleDisplayName(role, duplicateRoleNames)}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    <div className="compare-slots">
                        {compareRoleIds.map((id, idx) => (
                            <div key={idx} className="role-selector-group">
                                <label className="role-label">
                                    Compare {idx + 1}
                                    {id && (
                                        <button type="button" className="set-base-link" onClick={() => void setCompareRoleAsBase(idx)} title="Swap this role with the base role and re-compare">
                                            (Set as Base)
                                        </button>
                                    )}
                                </label>
                                <div className="select-wrapper compare-select-row">
                                    <select
                                        className="role-select"
                                        value={id}
                                        onChange={(e) => setCompareRole(idx, e.target.value)}
                                        disabled={loadingEnvironment || loadingRoles}
                                    >
                                        <option value="">— Select role —</option>
                                        <optgroup label={getRoleGroupLabel(false)}>
                                            {unmanagedRoles
                                                .filter((role) => role.roleid !== baseRoleId && !compareRoleIds.some((cid, ci) => ci !== idx && cid === role.roleid))
                                                .map((role) => (
                                                    <option key={role.roleid} value={role.roleid}>
                                                        {getRoleDisplayName(role, duplicateRoleNames)}
                                                    </option>
                                                ))}
                                        </optgroup>
                                        <optgroup label={getRoleGroupLabel(true)}>
                                            {managedRoles
                                                .filter((role) => role.roleid !== baseRoleId && !compareRoleIds.some((cid, ci) => ci !== idx && cid === role.roleid))
                                                .map((role) => (
                                                    <option key={role.roleid} value={role.roleid}>
                                                        {getRoleDisplayName(role, duplicateRoleNames)}
                                                    </option>
                                                ))}
                                        </optgroup>
                                    </select>
                                    {compareRoleIds.length > 1 && (
                                        <button
                                            type="button"
                                            className="remove-slot-btn"
                                            onClick={() => removeCompareSlot(idx)}
                                            title="Remove"
                                            aria-label="Remove compare role"
                                        >
                                            <DismissCircleRegular />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {compareRoleIds.length < MAX_COMPARE_ROLES && (
                            <button className="add-slot-btn" onClick={addCompareSlot} disabled={loadingEnvironment || loadingRoles}>
                                + Add Role
                            </button>
                        )}
                    </div>

                    <div className="selector-actions">
                        {loadingEnvironment || loadingRoles ? (
                            <Spinner size="tiny" label="Loading selections…" labelPosition="after" />
                        ) : (
                            <Button appearance="subtle" icon={<ArrowSyncRegular />} onClick={() => void loadEnvironment()} title="Refresh selections" size="small" />
                        )}
                        <Button appearance="primary" onClick={runComparison} disabled={!canCompare || comparing || loadingEnvironment || loadingRoles} size="medium">
                            {comparing ? <Spinner size="tiny" /> : "Compare"}
                        </Button>
                    </div>
                </div>
            </div>

            {error && (
                <MessageBar intent="error" className="error-bar">
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            )}

            {hasResults && (
                <div className="filter-bar">
                    <SearchBox
                        placeholder="Filter by entity display name, schema name, or operation…"
                        value={searchTerm}
                        onChange={(_e, data) => setSearchTerm(data.value)}
                        size="small"
                        className="search-box"
                    />
                    <Dropdown
                        className="multi-filter"
                        size="small"
                        multiselect
                        placeholder="Groups"
                        selectedOptions={selectedCategories}
                        value={multiSelectSummary(selectedCategories, availableCategories, "groups")}
                        onOptionSelect={(_e, data) => setSelectedCategories((prev) => toggleMultiSelect(data.optionValue ?? "", prev, availableCategories))}
                        aria-label="Filter by group"
                    >
                        <Option value={ALL_VALUE}>All groups</Option>
                        {availableCategories.map((label) => (
                            <Option key={label} value={label}>
                                {label}
                            </Option>
                        ))}
                    </Dropdown>
                    <Dropdown
                        className="multi-filter"
                        size="small"
                        multiselect
                        placeholder="Operations"
                        selectedOptions={selectedOperations}
                        value={multiSelectSummary(selectedOperations, availableOperations, "operations")}
                        onOptionSelect={(_e, data) => setSelectedOperations((prev) => toggleMultiSelect(data.optionValue ?? "", prev, availableOperations))}
                        aria-label="Filter by operation"
                    >
                        <Option value={ALL_VALUE}>All operations</Option>
                        {availableOperations.map((op) => (
                            <Option key={op} value={op}>
                                {operationLabel(op)}
                            </Option>
                        ))}
                    </Dropdown>
                    <select
                        className="diff-filter-select"
                        value={diffFilter}
                        onChange={(e) => setDiffFilter(e.target.value as DiffFilter)}
                        aria-label="Row filter"
                    >
                        {DIFF_FILTER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <span className="result-count">
                        {filteredData.length} / {comparisonData.length} privileges
                    </span>
                </div>
            )}

            {hasResults && (
                <div className="table-container">
                    <table className="comparison-table">
                        <thead>
                            <tr>
                                <th className="col-entity" rowSpan={2}>
                                    Entity
                                </th>
                                <th className="col-operation" rowSpan={2}>
                                    Operation
                                </th>
                                {comparedRoleIds.map((rid, i) => (
                                    <th key={rid} className={`col-role ${i === 0 ? "col-base" : ""}`} title={getRoleName(rid)}>
                                        <span className="role-col-name">{getRoleName(rid)}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {categoryGroups.map((category) =>
                                category.entityGroups.map((group, groupIdx) => {
                                    const isFirstGroup = groupIdx === 0;
                                    return group.rows.map((priv, rowIdx) => (
                                        <Fragment key={priv.privilegeid}>
                                            {isFirstGroup && rowIdx === 0 && (
                                                <tr className="category-row">
                                                    <td className="category-cell" colSpan={columnCount}>
                                                        {category.label}
                                                        <span className="category-kind-tag">{category.kind === "table" ? "Tables" : category.kind === "privacy" ? "Privacy" : "Misc"}</span>
                                                    </td>
                                                </tr>
                                            )}
                                            <tr className={rowIdx % 2 === 0 ? "row-even" : "row-odd"}>
                                                {rowIdx === 0 && (
                                                    <td className="col-entity entity-cell" rowSpan={group.rows.length}>
                                                        <div className="entity-cell-content" title={getEntityLabel(priv)}>
                                                            <span className="entity-display-name">{priv.entityDisplayName}</span>
                                                            <span className="entity-schema-name">{priv.entitySchemaName}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="col-operation">{operationLabel(priv.operation)}</td>
                                                {comparedRoleIds.map((rid, ci) => {
                                                    const depth = priv.depthByRole[rid] ?? PrivilegeDepth.None;
                                                    const baseRank = depthRank(priv.depthByRole[comparedRoleIds[0]]);
                                                    const rank = depthRank(depth);
                                                    const direction = ci === 0 ? "none" : rank > baseRank ? "more" : rank < baseRank ? "less" : "none";
                                                    return (
                                                        <td key={rid} className={`col-role-cell ${ci === 0 ? "col-base-cell" : ""}`}>
                                                            {direction === "more" && (
                                                                <Tooltip content="More permission than base" relationship="label">
                                                                    <AddCircleFilled className="diff-icon diff-more" aria-label="More permission than base" />
                                                                </Tooltip>
                                                            )}
                                                            {direction === "less" && (
                                                                <Tooltip content="Less permission than base" relationship="label">
                                                                    <SubtractCircleFilled className="diff-icon diff-less" aria-label="Less permission than base" />
                                                                </Tooltip>
                                                            )}
                                                            <DepthIcon depth={depth} />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </Fragment>
                                    ));
                                }),
                            )}
                            {categoryGroups.length === 0 && (
                                <tr>
                                    <td colSpan={columnCount} className="empty-row">
                                        No privileges match the current filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {hasResults && (
                <div className="legend-bar">
                    {(Object.entries(DEPTH_LABELS) as [string, string][]).map(([depth, label]) => (
                        <span key={depth} className="legend-item">
                            <DepthIcon depth={Number(depth) as PrivilegeDepth} />
                            <span className="legend-label">{label}</span>
                        </span>
                    ))}
                    <span className="legend-item">
                        <AddCircleFilled className="diff-icon diff-more" />
                        <span className="legend-label">More than base</span>
                    </span>
                    <span className="legend-item">
                        <SubtractCircleFilled className="diff-icon diff-less" />
                        <span className="legend-label">Less than base</span>
                    </span>
                </div>
            )}

            {!hasResults && !comparing && !loadingRoles && !loadingEnvironment && !error && (
                <div className="empty-state">
                    <p>
                        Choose a base role and one or more comparison roles, then click <strong>Compare</strong>.
                    </p>
                </div>
            )}
        </div>
    );
}
