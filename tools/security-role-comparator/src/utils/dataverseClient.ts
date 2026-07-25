import {
    CATEGORY_KIND_ORDER,
    EntityDisplayInfo,
    DataverseSolution,
    NON_TABLE_OPERATION,
    operationRank,
    ParsedPrivilege,
    Privilege,
    PrivilegeCategoryKind,
    PrivilegeDepth,
    PRIVILEGE_TYPE_TO_OPERATION,
    RoleEditorLayoutItem,
    RoleEditorLayoutItemType,
    RolePrivilegeDepth,
    SecurityRole,
    parsePrivilegeName,
} from "../models/interfaces";

/** Resolved role-editor-layout lookups used to categorize privileges. */
interface RoleEditorLayoutMaps {
    /** entity logical name (lower) -> parent tab layout item */
    tabByEntityLogicalName: Map<string, RoleEditorLayoutItem>;
    /** privilege name (lower) -> privilege layout item */
    privilegeByName: Map<string, RoleEditorLayoutItem>;
    /** layout item id -> layout item (for parent lookups) */
    itemById: Map<string, RoleEditorLayoutItem>;
    /** whether any usable layout data was found */
    hasData: boolean;
}

/** Authoritative privilege -> entity + operation index built from EntityDefinitions.Privileges. */
interface EntityPrivilegeIndex {
    byPrivilegeId: Map<string, EntityDisplayInfo>;
    byPrivilegeName: Map<string, EntityDisplayInfo>;
    operationByPrivilegeId: Map<string, string>;
    operationByPrivilegeName: Map<string, string>;
    /** True when the bulk metadata query returned at least one privilege mapping. */
    hasData: boolean;
}

/** Normalizes a GUID/name key for map lookups (lowercase, strip braces/whitespace). */
function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/[{}]/g, "");
}

export class DataverseConnector {
    constructor(_envUrl: string) {}
    private readonly entityDisplayCache = new Map<string, EntityDisplayInfo | null>();
    private roleEditorLayoutMaps: RoleEditorLayoutMaps | null = null;
    private entityPrivilegeIndex: EntityPrivilegeIndex | null = null;
    private allRolesCache: SecurityRole[] | null = null;
    private roleIdsBySolutionCache: Map<string, Set<string>> | null = null;

    private toQueryPath(queryOrUrl: string): string {
        if (!queryOrUrl.startsWith("http")) {
            return queryOrUrl;
        }

        const url = new URL(queryOrUrl);
        const apiRootMatch = url.pathname.match(/\/api\/data\/v[^/]+\/(.*)/i);
        const relativePath = apiRootMatch?.[1] ?? url.pathname.replace(/^\//, "");
        return `${relativePath}${url.search}`;
    }

    private async fetchAllRecords(queryPath: string): Promise<any[]> {
        const records: any[] = [];
        let nextQuery = queryPath;

        while (nextQuery) {
            const result = await this.executeQuery(nextQuery);
            records.push(...(result.value || []));

            const nextLink = result["@odata.nextLink"] as string | undefined;
            nextQuery = nextLink ? this.toQueryPath(nextLink) : "";
        }

        return records;
    }

    private readLabel(labelValue: any): string | undefined {
        if (typeof labelValue === "string") {
            return labelValue;
        }

        const userLabel = labelValue?.UserLocalizedLabel?.Label;
        if (typeof userLabel === "string" && userLabel.trim()) {
            return userLabel;
        }

        const localizedLabels = labelValue?.LocalizedLabels;
        if (Array.isArray(localizedLabels)) {
            const firstLabel = localizedLabels.find((entry) => typeof entry?.Label === "string" && entry.Label.trim());
            if (firstLabel?.Label) {
                return firstLabel.Label;
            }
        }

        return undefined;
    }

    async fetchEntityDisplayInfo(logicalName: string): Promise<EntityDisplayInfo | null> {
        const normalized = logicalName.trim().toLowerCase();
        if (!normalized) return null;

        if (this.entityDisplayCache.has(normalized)) {
            return this.entityDisplayCache.get(normalized) ?? null;
        }

        try {
            const query = `EntityDefinitions(LogicalName='${normalized}')?$select=LogicalName,SchemaName,DisplayName,IsCustomEntity`;
            // A keyed EntityDefinitions request returns a single object (no `value` array),
            // so read the response directly rather than through fetchAllRecords.
            const row = await this.executeQuery(query);
            if (!row || !row.LogicalName) {
                this.entityDisplayCache.set(normalized, null);
                return null;
            }

            const info: EntityDisplayInfo = {
                logicalName: (row.LogicalName || normalized).toLowerCase(),
                schemaName: row.SchemaName || row.LogicalName || normalized,
                displayName: this.readLabel(row.DisplayName) || row.SchemaName || row.LogicalName || normalized,
                isCustom: row.IsCustomEntity === true,
            };

            this.entityDisplayCache.set(normalized, info);
            return info;
        } catch {
            this.entityDisplayCache.set(normalized, null);
            return null;
        }
    }

    /**
     * Build (and cache) an authoritative privilege -> entity + operation index from the metadata
     * `EntityDefinitions.Privileges` collection. This maps every table privilege to its owning
     * entity and operation regardless of how the privilege name is spelled, which is essential for
     * tables whose privilege names don't match their logical name (e.g. prvReadUser -> systemuser,
     * prvReadActivity -> activitypointer).
     */
    async fetchEntityPrivilegeIndex(): Promise<EntityPrivilegeIndex> {
        if (this.entityPrivilegeIndex) {
            return this.entityPrivilegeIndex;
        }

        const index: EntityPrivilegeIndex = {
            byPrivilegeId: new Map(),
            byPrivilegeName: new Map(),
            operationByPrivilegeId: new Map(),
            operationByPrivilegeName: new Map(),
            hasData: false,
        };

        try {
            const rows = await this.fetchAllRecords(
                `EntityDefinitions?$select=LogicalName,SchemaName,DisplayName,IsCustomEntity,Privileges&LabelLanguages=1033`,
            );
            for (const row of rows) {
                const logicalName = (row.LogicalName || "").toLowerCase();
                if (!logicalName) continue;
                const info: EntityDisplayInfo = {
                    logicalName,
                    schemaName: row.SchemaName || row.LogicalName || logicalName,
                    displayName: this.readLabel(row.DisplayName) || row.SchemaName || row.LogicalName || logicalName,
                    isCustom: row.IsCustomEntity === true,
                };

                const privileges = Array.isArray(row.Privileges) ? row.Privileges : [];
                for (const priv of privileges) {
                    // The Web API may return PrivilegeType as its enum string ("Read") or numeric value.
                    const rawType = priv.PrivilegeType;
                    const operation = typeof rawType === "string" ? rawType : PRIVILEGE_TYPE_TO_OPERATION[Number(rawType)];
                    const validOperation = operation && operation !== "None" ? operation : undefined;

                    if (priv.PrivilegeId) {
                        const id = normalizeKey(String(priv.PrivilegeId));
                        index.byPrivilegeId.set(id, info);
                        if (validOperation) index.operationByPrivilegeId.set(id, validOperation);
                    }
                    if (priv.Name) {
                        const name = normalizeKey(String(priv.Name));
                        index.byPrivilegeName.set(name, info);
                        if (validOperation) index.operationByPrivilegeName.set(name, validOperation);
                    }
                }
            }
        } catch {
            // Metadata unavailable; index stays empty and callers fall back to per-entity lookups.
        }

        index.hasData = index.byPrivilegeId.size > 0 || index.byPrivilegeName.size > 0;
        this.entityPrivilegeIndex = index;
        return index;
    }

    /**
     * Fetch and cache the role editor layout that drives the OOB security role editor grouping
     * (tabs like Core Records / Business Management, plus Miscellaneous and Privacy sections).
     * Degrades gracefully to an empty map set when the table is unavailable.
     */
    async fetchRoleEditorLayoutMaps(): Promise<RoleEditorLayoutMaps> {
        if (this.roleEditorLayoutMaps) {
            return this.roleEditorLayoutMaps;
        }

        const emptyMaps: RoleEditorLayoutMaps = {
            tabByEntityLogicalName: new Map(),
            privilegeByName: new Map(),
            itemById: new Map(),
            hasData: false,
        };

        try {
            const query = `roleeditorlayouts?$select=roleeditorlayoutid,displayname,entitylogicalname,privilegename,itemtype,isprivacyrelated,taborder,_roleeditorlayouthierarchyid_value&$top=5000`;
            const rows = await this.fetchAllRecords(query);

            const items: RoleEditorLayoutItem[] = rows.map((row: any) => ({
                id: row.roleeditorlayoutid,
                displayName: row.displayname || "",
                entityLogicalName: row.entitylogicalname || undefined,
                privilegeName: row.privilegename || undefined,
                itemType: row.itemtype,
                isPrivacyRelated: row.isprivacyrelated === true,
                tabOrder: typeof row.taborder === "number" ? row.taborder : undefined,
                parentId: row._roleeditorlayouthierarchyid_value || undefined,
            }));

            const itemById = new Map<string, RoleEditorLayoutItem>();
            for (const item of items) {
                itemById.set(item.id, item);
            }

            const tabByEntityLogicalName = new Map<string, RoleEditorLayoutItem>();
            const privilegeByName = new Map<string, RoleEditorLayoutItem>();

            for (const item of items) {
                if (item.itemType === RoleEditorLayoutItemType.Entity && item.entityLogicalName) {
                    tabByEntityLogicalName.set(item.entityLogicalName.toLowerCase(), item);
                } else if (item.itemType === RoleEditorLayoutItemType.Privilege && item.privilegeName) {
                    // Prefer keeping the first mapping; privacy-related wins if a duplicate exists.
                    const key = item.privilegeName.toLowerCase();
                    const existing = privilegeByName.get(key);
                    if (!existing || (!existing.isPrivacyRelated && item.isPrivacyRelated)) {
                        privilegeByName.set(key, item);
                    }
                }
            }

            this.roleEditorLayoutMaps = {
                tabByEntityLogicalName,
                privilegeByName,
                itemById,
                hasData: items.length > 0,
            };
            return this.roleEditorLayoutMaps;
        } catch {
            this.roleEditorLayoutMaps = emptyMaps;
            return emptyMaps;
        }
    }

    /**
     * Map every solution to the set of security-role ids it contains. Role membership is unioned
     * from two sources:
     *  1. solutioncomponent (component type 20 = Role) — records roles explicitly added to a
     *     solution, which is how a role appears in unmanaged solutions other than the one that
     *     created it.
     *  2. role.solutionid — the solution that created the role (usually the default/Active
     *     solution), which solutioncomponent may not enumerate.
     */
    async fetchRoleIdsBySolution(): Promise<Map<string, Set<string>>> {
        if (this.roleIdsBySolutionCache) {
            return this.roleIdsBySolutionCache;
        }

        const map = new Map<string, Set<string>>();
        const add = (solutionId?: string, roleId?: string) => {
            const s = solutionId ? String(solutionId).toLowerCase() : "";
            const r = roleId ? String(roleId).toLowerCase() : "";
            if (!s || !r) return;
            let set = map.get(s);
            if (!set) {
                set = new Set<string>();
                map.set(s, set);
            }
            set.add(r);
        };

        // Source 1: explicit solution components (componenttype 20 = Role).
        try {
            const rows = await this.fetchAllRecords(`solutioncomponents?$select=objectid,_solutionid_value&$filter=componenttype eq 20&$top=5000`);
            for (const row of rows) add(row._solutionid_value, row.objectid);
        } catch {
            // solutioncomponents may not be queryable; fall through to owning-solution mapping.
        }

        // Source 2: each role's owning solution.
        try {
            const allRoles = await this.fetchAllRolesRaw();
            for (const role of allRoles) add(role.solutionid, role.roleid);
        } catch {
            // ignore; map may still contain source-1 data
        }

        this.roleIdsBySolutionCache = map;
        return map;
    }

    /** Fetch every security role in the environment (cached), sorted by managed state then name. */
    private async fetchAllRolesRaw(): Promise<SecurityRole[]> {
        if (this.allRolesCache) {
            return this.allRolesCache;
        }

        const selects = [
            "roleid",
            "name",
            "solutionid",
            "ismanaged",
            "_roletemplateid_value",
            "isautoassigned",
            "issytemgenerated",
            "_businessunitid_value",
        ];
        const query = `roles?$select=${selects.join(",")}&$orderby=ismanaged asc,name asc&$top=5000`;
        const rows = await this.fetchAllRecords(query);
        this.allRolesCache = rows.map(
            (row: any): SecurityRole => ({
                roleid: row.roleid,
                name: row.name,
                solutionid: row.solutionid,
                ismanaged: row.ismanaged,
                roletemplateid: row._roletemplateid_value,
                isautoassigned: row.isautoassigned,
                // NB: the role entity's logical name for this column is misspelled in Dataverse.
                issystemgenerated: row.issytemgenerated,
                _businessunitid_value: row._businessunitid_value,
                businessunitName: row["_businessunitid_value@OData.Community.Display.V1.FormattedValue"],
            }),
        );
        return this.allRolesCache;
    }

    /**
     * Fetch solutions that contain at least one security role (via solutioncomponent membership),
     * ordered with unmanaged solutions first.
     */
    async fetchSolutions(): Promise<DataverseSolution[]> {
        const [rows, roleIdsBySolution] = await Promise.all([
            this.fetchAllRecords(
                `solutions?$select=solutionid,friendlyname,uniquename,ismanaged,parentsolutionid&$orderby=ismanaged asc,friendlyname asc,uniquename asc&$top=5000`,
            ),
            this.fetchRoleIdsBySolution(),
        ]);

        return rows
            .filter((row: any) => {
                const id = row.solutionid ? String(row.solutionid).toLowerCase() : "";
                return id && (roleIdsBySolution.get(id)?.size ?? 0) > 0;
            })
            .map(
                (row: any): DataverseSolution => ({
                    solutionid: row.solutionid,
                    friendlyname: row.friendlyname,
                    uniquename: row.uniquename,
                    ismanaged: row.ismanaged,
                    parentsolutionid: row.parentsolutionid,
                }),
            );
    }

    /** Fetch the security roles contained in a solution (via solutioncomponent membership). */
    async fetchRoles(solutionId?: string): Promise<SecurityRole[]> {
        const allRoles = await this.fetchAllRolesRaw();
        if (!solutionId) {
            return allRoles;
        }

        const roleIdsBySolution = await this.fetchRoleIdsBySolution();
        const roleIds = roleIdsBySolution.get(solutionId.toLowerCase());
        if (!roleIds || roleIds.size === 0) {
            return [];
        }
        return allRoles.filter((role) => roleIds.has(role.roleid.toLowerCase()));
    }

    /**
     * Fetch the privileges associated with a role using the OData navigation property.
     * Returns privilege id, name, and access right.
     */
    async fetchRolePrivileges(roleId: string): Promise<Privilege[]> {
        const sanitizedId = this.sanitizeGuid(roleId);
        const query = `roles(${sanitizedId})/roleprivileges_association?$select=privilegeid,name,accessright&$top=5000`;
        const rows = await this.fetchAllRecords(query);
        return rows as Privilege[];
    }

    /**
     * Fetch the privilege depth assignments for a role from the roleprivilegesbase intersect entity.
     * Falls back gracefully if the entity set is not accessible.
     */
    async fetchRolePrivilegeDepths(roleId: string): Promise<RolePrivilegeDepth[]> {
        try {
            const sanitizedId = this.sanitizeGuid(roleId);
            const query = `roleprivilegesbase?$filter=_roleid_value eq ${sanitizedId}&$select=_privilegeid_value,privilegedepthid&$top=5000`;
            const rows = (await this.fetchAllRecords(query)) as Array<{ _privilegeid_value: string; privilegedepthid: number }>;
            return rows.map((row) => ({
                privilegeid: row._privilegeid_value,
                privilegedepthid: row.privilegedepthid as PrivilegeDepth,
            }));
        } catch {
            // roleprivilegesbase may not be directly queryable in all environments;
            // callers will treat all privileges as "Global" depth in that case.
            return [];
        }
    }

    /**
     * Build a unified list of ParsedPrivilege entries for all selected roles.
     * Each entry contains the depth per role so the comparison grid can be rendered.
     */
    async buildComparisonData(roleIds: string[]): Promise<ParsedPrivilege[]> {
        // Fetch privileges and depths for each role in parallel
        const roleData = await Promise.all(
            roleIds.map(async (roleId) => {
                const [privileges, depths] = await Promise.all([this.fetchRolePrivileges(roleId), this.fetchRolePrivilegeDepths(roleId)]);

                // Build a depth map keyed by privilege id
                const depthMap = new Map<string, PrivilegeDepth>();
                for (const d of depths) {
                    depthMap.set(d.privilegeid.toLowerCase(), d.privilegedepthid);
                }

                return { roleId, privileges, depthMap };
            }),
        );

        // Collect all unique privileges across all roles
        const privilegeMap = new Map<string, Privilege>();
        for (const { privileges } of roleData) {
            for (const priv of privileges) {
                if (!privilegeMap.has(priv.privilegeid)) {
                    privilegeMap.set(priv.privilegeid, priv);
                }
            }
        }

        const [layoutMaps, privIndex] = await Promise.all([this.fetchRoleEditorLayoutMaps(), this.fetchEntityPrivilegeIndex()]);

        // Fallback: if the bulk privilege index is unavailable, resolve table entities the old way
        // (per-entity metadata lookup keyed on the logical name parsed from the privilege name) so
        // standard tables still classify correctly instead of collapsing into Miscellaneous.
        const fallbackEntityByLogicalName = new Map<string, EntityDisplayInfo | null>();
        if (!privIndex.hasData) {
            const uniqueLogicalNames = Array.from(
                new Set(
                    Array.from(privilegeMap.values())
                        .map((priv) => parsePrivilegeName(priv.name))
                        .filter((parsed) => parsed.isKnownOperation)
                        .map((parsed) => parsed.entityLogicalName),
                ),
            );
            const entries = await Promise.all(uniqueLogicalNames.map(async (name) => [name, await this.fetchEntityDisplayInfo(name)] as const));
            for (const [name, info] of entries) fallbackEntityByLogicalName.set(name, info);
        }

        // Build the comparison list
        const result: ParsedPrivilege[] = [];
        for (const [privilegeid, priv] of privilegeMap) {
            const parsed = parsePrivilegeName(priv.name);
            const depthByRole: Record<string, PrivilegeDepth> = {};

            const idKey = normalizeKey(privilegeid);
            const nameKey = normalizeKey(priv.name);
            // Resolve the entity + operation authoritatively from metadata; fall back per-entity.
            const entityInfo =
                privIndex.byPrivilegeId.get(idKey) ??
                privIndex.byPrivilegeName.get(nameKey) ??
                (parsed.isKnownOperation ? fallbackEntityByLogicalName.get(parsed.entityLogicalName) ?? null : null);
            const indexOperation = privIndex.operationByPrivilegeId.get(idKey) ?? privIndex.operationByPrivilegeName.get(nameKey);
            const category = this.resolveCategory(priv.name, entityInfo?.logicalName ?? null, entityInfo, layoutMaps);

            let entityLogicalName: string;
            let entitySchemaName: string;
            let entityDisplayName: string;
            let operation: string;

            if (entityInfo) {
                entityLogicalName = entityInfo.logicalName;
                entitySchemaName = entityInfo.schemaName;
                entityDisplayName = entityInfo.displayName;
                operation = indexOperation ?? (parsed.isKnownOperation ? parsed.operation : NON_TABLE_OPERATION);
            } else {
                // Miscellaneous / privacy privileges have no entity/operation split; each is its own row.
                entityLogicalName = priv.name.toLowerCase();
                entitySchemaName = priv.name;
                entityDisplayName = category.layoutDisplayName || parsed.entityToken || priv.name;
                operation = NON_TABLE_OPERATION;
            }

            for (const { roleId, privileges, depthMap } of roleData) {
                const hasPriv = privileges.some((p) => p.privilegeid === privilegeid);
                if (!hasPriv) {
                    depthByRole[roleId] = PrivilegeDepth.None;
                } else {
                    // If depth data was successfully fetched use it; otherwise assume Global
                    const depth = depthMap.get(privilegeid.toLowerCase());
                    depthByRole[roleId] = depth !== undefined ? depth : PrivilegeDepth.Global;
                }
            }

            result.push({
                privilegeid,
                rawName: priv.name,
                entityLogicalName,
                entitySchemaName,
                entityDisplayName,
                entitySearchText: [entityDisplayName, entitySchemaName, entityLogicalName, parsed.entityToken, priv.name, category.label].join(" ").toLowerCase(),
                operation,
                categoryKind: category.kind,
                categoryKey: category.key,
                categoryLabel: category.label,
                categoryOrder: category.order,
                depthByRole,
            });
        }

        // Sort: by category (kind, then order, then label), then entity, then operation.
        result.sort((a, b) => {
            const kindCmp = CATEGORY_KIND_ORDER[a.categoryKind] - CATEGORY_KIND_ORDER[b.categoryKind];
            if (kindCmp !== 0) return kindCmp;
            const orderCmp = a.categoryOrder - b.categoryOrder;
            if (orderCmp !== 0) return orderCmp;
            const labelCmp = a.categoryLabel.localeCompare(b.categoryLabel);
            if (labelCmp !== 0) return labelCmp;
            const entityCmp = a.entityDisplayName.localeCompare(b.entityDisplayName);
            if (entityCmp !== 0) return entityCmp;
            const schemaCmp = a.entitySchemaName.localeCompare(b.entitySchemaName);
            if (schemaCmp !== 0) return schemaCmp;
            return operationRank(a.operation) - operationRank(b.operation);
        });

        return result;
    }

    /**
     * Determine the OOB-style grouping category for a privilege. Table privileges (those that
     * resolve to an entity) group under their entity's role-editor tab; miscellaneous / privacy
     * privileges group under their role-editor section.
     */
    private resolveCategory(
        privilegeName: string,
        entityLogicalName: string | null,
        entityInfo: EntityDisplayInfo | null,
        maps: RoleEditorLayoutMaps,
    ): { kind: PrivilegeCategoryKind; key: string; label: string; order: number; layoutDisplayName?: string } {
        // 1. Table privileges group under their entity's parent tab.
        if (entityLogicalName) {
            const entityItem = maps.tabByEntityLogicalName.get(entityLogicalName);
            if (entityItem) {
                const tab = entityItem.parentId ? maps.itemById.get(entityItem.parentId) : undefined;
                const label = tab?.displayName || "Tables";
                return { kind: "table", key: entityItem.parentId || "tables", label, order: tab?.tabOrder ?? 900, layoutDisplayName: entityItem.displayName };
            }
            // Fallback: entity known but not in the layout -> split custom vs standard tables.
            return entityInfo?.isCustom
                ? { kind: "table", key: "custom-tables", label: "Custom Tables", order: 902 }
                : { kind: "table", key: "standard-tables", label: "Standard Tables", order: 901 };
        }

        // 2. Miscellaneous / privacy privileges are listed explicitly in the layout.
        const privItem = maps.privilegeByName.get(privilegeName.toLowerCase());
        if (privItem) {
            const kind: PrivilegeCategoryKind = privItem.isPrivacyRelated ? "privacy" : "misc";
            const section = privItem.parentId ? maps.itemById.get(privItem.parentId) : undefined;
            const label = section?.displayName || (kind === "privacy" ? "Privacy Related Privileges" : "Miscellaneous Privileges");
            return { kind, key: privItem.parentId || kind, label, order: section?.tabOrder ?? 0, layoutDisplayName: privItem.displayName };
        }

        // 3. Fallback: unclassified non-table privilege.
        return { kind: "misc", key: "misc", label: "Miscellaneous Privileges", order: 999 };
    }

    private sanitizeGuid(rawValue: string): string {
        const trimmed = rawValue.trim().toLowerCase();
        const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
        if (!guidPattern.test(trimmed)) {
            throw new Error("Invalid identifier format detected");
        }
        return trimmed;
    }

    private async executeQuery(queryPath: string): Promise<any> {
        if (!window.dataverseAPI) {
            throw new Error("Dataverse API not available");
        }
        return await window.dataverseAPI.queryData(this.toQueryPath(queryPath));
    }

    static async showMessage(title: string, message: string, severity: "success" | "error" | "warning" | "info"): Promise<void> {
        if (window.toolboxAPI) {
            await window.toolboxAPI.utils.showNotification({ title, body: message, type: severity });
        }
    }
}
