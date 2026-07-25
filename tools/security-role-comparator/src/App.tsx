import { Badge, Button, MessageBar, MessageBarBody, SearchBox, Spinner, Tooltip } from "@fluentui/react-components";
import { AddCircleFilled, ArrowSyncRegular, DismissCircleRegular, SubtractCircleFilled } from "@fluentui/react-icons";
import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { DataverseSolution, DEPTH_LABELS, depthRank, ParsedPrivilege, PrivilegeDepth, SecurityRole } from "./models/interfaces";
import "./styles.css";
import { DataverseConnector } from "./utils/dataverseClient";

const MAX_COMPARE_ROLES = 5;
const STORAGE_PREFIX = "security-role-comparator:recent-selections:v1";

/** Row-level filter modes for the comparison grid. */
type DiffFilter = "differences" | "more" | "less" | "same" | "all";

const DIFF_FILTER_OPTIONS: { value: DiffFilter; label: string }[] = [
    { value: "differences", label: "All differences" },
    { value: "more", label: "More than base" },
    { value: "less", label: "Less than base" },
    { value: "same", label: "Same as base" },
    { value: "all", label: "Show all" },
];

const DEPTH_COLORS: Record<PrivilegeDepth, string> = {
    [PrivilegeDepth.None]: "var(--depth-none)",
    [PrivilegeDepth.Basic]: "var(--depth-basic)",
    [PrivilegeDepth.Local]: "var(--depth-local)",
    [PrivilegeDepth.Deep]: "var(--depth-deep)",
    [PrivilegeDepth.Global]: "var(--depth-global)",
};

/** Maps a PrivilegeDepth value to the number of filled dots (0–4). */
const DEPTH_FILLED_COUNT: Record<PrivilegeDepth, number> = {
    [PrivilegeDepth.None]: 0,
    [PrivilegeDepth.Basic]: 1,
    [PrivilegeDepth.Local]: 2,
    [PrivilegeDepth.Deep]: 3,
    [PrivilegeDepth.Global]: 4,
};

interface SavedSelections {
    version: 1;
    solutionId: string;
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
        if (parsed.version !== 1 || typeof parsed.solutionId !== "string") return null;

        return {
            version: 1,
            solutionId: parsed.solutionId,
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

function getSolutionDisplayName(solution: DataverseSolution): string {
    return solution.friendlyname?.trim() || solution.uniquename?.trim() || solution.solutionid;
}

function getSolutionGroupLabel(isManaged: boolean): string {
    return isManaged ? "Managed Solutions" : "Unmanaged Solutions";
}

function getRoleGroupLabel(isManaged: boolean): string {
    return isManaged ? "Managed Roles" : "Unmanaged Roles";
}

function getRoleOriginLabel(role: SecurityRole): string {
    if (Boolean(role.isautoassigned)) return "Auto-assigned";
    if (role.issystemgenerated) return "System";
    if (role.roletemplateid) return "Template";
    return "Custom";
}

function getRoleDisplayName(role: SecurityRole, duplicateNames: Set<string>): string {
    const parts = [role.name];
    if (duplicateNames.has(role.name) && role.businessunitName) {
        parts.push(role.businessunitName);
    }
    parts.push(getRoleOriginLabel(role));
    return parts.join(" · ");
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

/** Renders 4 dots indicating the privilege depth (filled up to the depth level). */
function DepthDots({ depth }: { depth: PrivilegeDepth }) {
    const filledCount = DEPTH_FILLED_COUNT[depth] ?? 0;
    const color = DEPTH_COLORS[depth];
    return (
        <Tooltip content={DEPTH_LABELS[depth]} relationship="label">
            <span className="depth-dots" aria-label={DEPTH_LABELS[depth]}>
                {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="depth-dot" style={{ background: i < filledCount ? color : "var(--dot-empty)" }} />
                ))}
            </span>
        </Tooltip>
    );
}

export default function App() {
    const [solutions, setSolutions] = useState<DataverseSolution[]>([]);
    const [roles, setRoles] = useState<SecurityRole[]>([]);
    const [selectedSolutionId, setSelectedSolutionId] = useState<string>("");
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
            solutionId: selectedSolutionId,
            baseRoleId,
            compareRoleIds: compareRoleIds.filter((id) => id !== ""),
        });
    }, [baseRoleId, compareRoleIds, selectedSolutionId]);

    const applySelectionDefaults = (availableRoles: SecurityRole[], savedSelections: SavedSelections | null, solutionId: string) => {
        const validRoleIds = new Set(availableRoles.map((role) => role.roleid));

        const baseId =
            savedSelections?.solutionId === solutionId && savedSelections.baseRoleId && validRoleIds.has(savedSelections.baseRoleId)
                ? savedSelections.baseRoleId
                : "";

        const compareIds =
            savedSelections?.solutionId === solutionId
                ? normalizeSelections(savedSelections.compareRoleIds, validRoleIds, new Set(baseId ? [baseId] : []))
                : [];

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
            const fetchedSolutions = await connectorRef.current.fetchSolutions();
            setSolutions(fetchedSolutions);

            const validSolutionIds = new Set(fetchedSolutions.map((solution) => solution.solutionid));
            const preferredSolutionId =
                savedSelections?.solutionId && validSolutionIds.has(savedSelections.solutionId)
                    ? savedSelections.solutionId
                    : fetchedSolutions.find((solution) => !solution.ismanaged)?.solutionid ?? fetchedSolutions[0]?.solutionid ?? "";

            setSelectedSolutionId(preferredSolutionId);

            const fetchedRoles = preferredSolutionId ? await connectorRef.current.fetchRoles(preferredSolutionId) : [];
            setRoles(fetchedRoles);
            applySelectionDefaults(fetchedRoles, savedSelections, preferredSolutionId);

            setComparisonData([]);
            setComparedRoleIds([]);
            initializedRef.current = fetchedSolutions.length > 0;

            if (!fetchedSolutions.length) {
                setError("No solutions containing security roles were found in the connected environment.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to load security roles");
        } finally {
            setLoadingEnvironment(false);
            setLoadingRoles(false);
        }
    };

    const loadRolesForSolution = async (solutionId: string) => {
        if (!connectorRef.current) return;

        setLoadingRoles(true);
        setError("");

        try {
            const fetchedRoles = solutionId ? await connectorRef.current.fetchRoles(solutionId) : [];
            setRoles(fetchedRoles);
            setComparisonData([]);
            setComparedRoleIds([]);
            setBaseRoleId("");
            setCompareRoleIds([""]);

            if (!fetchedRoles.length) {
                setError("No roles were found for the selected solution.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to load roles for the selected solution");
        } finally {
            setLoadingRoles(false);
        }
    };

    const handleSolutionChange = async (nextSolutionId: string) => {
        setSelectedSolutionId(nextSolutionId);
        await loadRolesForSolution(nextSolutionId);
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

    const canCompare = !!selectedSolutionId && !!baseRoleId && compareRoleIds.some((id) => id !== "");

    const runComparison = async () => {
        if (!canCompare || !connectorRef.current) return;
        setComparing(true);
        setError("");
        setComparisonData([]);
        try {
            const activeCompareIds = compareRoleIds.filter((id) => id !== "");
            const allIds = [baseRoleId, ...activeCompareIds];
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

    const getRoleName = (roleId: string) => roles.find((r) => r.roleid === roleId)?.name ?? roleId;

    const getEntityLabel = (priv: ParsedPrivilege) => `${priv.entityDisplayName} (${priv.entitySchemaName})`;

    const selectedSolution = solutions.find((solution) => solution.solutionid === selectedSolutionId);
    const unmanagedSolutions = solutions.filter((solution) => !solution.ismanaged);
    const managedSolutions = solutions.filter((solution) => solution.ismanaged);
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

    const filteredData = comparisonData.filter((priv) => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            if (!priv.entitySearchText.includes(term) && !priv.operation.toLowerCase().includes(term) && !priv.rawName.toLowerCase().includes(term)) {
                return false;
            }
        }
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
                <div className="solution-panel">
                    <div className="role-selector-group solution-selector-group">
                        <label className="role-label base-label">Solution</label>
                        <div className="select-wrapper">
                            <select
                                className="role-select"
                                value={selectedSolutionId}
                                onChange={(e) => void handleSolutionChange(e.target.value)}
                                disabled={loadingEnvironment || loadingRoles}
                            >
                                <option value="">— Select solution —</option>
                                <optgroup label={getSolutionGroupLabel(false)}>
                                    {unmanagedSolutions.map((solution) => (
                                        <option key={solution.solutionid} value={solution.solutionid}>
                                            {getSolutionDisplayName(solution)}
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label={getSolutionGroupLabel(true)}>
                                    {managedSolutions.map((solution) => (
                                        <option key={solution.solutionid} value={solution.solutionid}>
                                            {getSolutionDisplayName(solution)}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    <div className="solution-subtext">
                        <span className="field-note">Selections are remembered per environment in this browser.</span>
                        {selectedSolution && <span className="field-meta">Loaded from: {getSolutionDisplayName(selectedSolution)}</span>}
                    </div>
                </div>

                <div className="selector-content">
                    <div className="role-selector-group">
                        <label className="role-label base-label">Base Role</label>
                        <div className="select-wrapper">
                            <select className="role-select" value={baseRoleId} onChange={(e) => setBaseRoleId(e.target.value)} disabled={loadingEnvironment || loadingRoles || !selectedSolutionId}>
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
                                <label className="role-label">Compare {idx + 1}</label>
                                <div className="select-wrapper compare-select-row">
                                    <select
                                        className="role-select"
                                        value={id}
                                        onChange={(e) => setCompareRole(idx, e.target.value)}
                                        disabled={loadingEnvironment || loadingRoles || !selectedSolutionId}
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
                            <button className="add-slot-btn" onClick={addCompareSlot} disabled={loadingEnvironment || loadingRoles || !selectedSolutionId}>
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
                                        {i === 0 && (
                                            <Badge appearance="tint" color="brand" size="small" className="base-badge">
                                                Base
                                            </Badge>
                                        )}
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
                                                <td className="col-operation">{priv.operation}</td>
                                                {comparedRoleIds.map((rid, ci) => {
                                                    const depth = priv.depthByRole[rid] ?? PrivilegeDepth.None;
                                                    const baseRank = depthRank(priv.depthByRole[comparedRoleIds[0]]);
                                                    const rank = depthRank(depth);
                                                    const direction = ci === 0 ? "none" : rank > baseRank ? "more" : rank < baseRank ? "less" : "none";
                                                    return (
                                                        <td key={rid} className={`col-role-cell ${ci === 0 ? "col-base-cell" : ""}`}>
                                                            <div className="cell-content">
                                                                <span className="diff-icon-slot">
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
                                                                </span>
                                                                <DepthDots depth={depth} />
                                                            </div>
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
                            <DepthDots depth={Number(depth) as PrivilegeDepth} />
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
                        Select a solution, then choose a base role and one or more comparison roles before clicking <strong>Compare</strong>.
                    </p>
                </div>
            )}
        </div>
    );
}
