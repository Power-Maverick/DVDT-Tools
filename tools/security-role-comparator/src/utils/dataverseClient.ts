import {
    CATEGORY_KIND_ORDER,
    EntityDisplayInfo,
    DataverseSolution,
    ParsedPrivilege,
    Privilege,
    PrivilegeCategoryKind,
    PrivilegeDepth,
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

export class DataverseConnector {
    constructor(_envUrl: string) {}
    private readonly entityDisplayCache = new Map<string, EntityDisplayInfo | null>();
    private roleEditorLayoutMaps: RoleEditorLayoutMaps | null = null;

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
            const rows = await this.fetchAllRecords(query);
            const row = rows[0];
            if (!row) {
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
     * Fetch all solutions from the environment, ordered with unmanaged solutions first.
     */
    async fetchSolutions(): Promise<DataverseSolution[]> {
        const query = `solutions?$select=solutionid,friendlyname,uniquename,ismanaged,parentsolutionid&$orderby=ismanaged asc,friendlyname asc,uniquename asc&$top=5000`;
        const rows = await this.fetchAllRecords(query);
        return rows.map(
            (row: any): DataverseSolution => ({
                solutionid: row.solutionid,
                friendlyname: row.friendlyname,
                uniquename: row.uniquename,
                ismanaged: row.ismanaged,
                parentsolutionid: row.parentsolutionid,
            }),
        );
    }

    /** Fetch all security roles from the environment, sorted by name. */
    async fetchRoles(solutionId?: string): Promise<SecurityRole[]> {
        const selects = [
            "roleid",
            "name",
            "solutionid",
            "ismanaged",
            "roletemplateid",
            "isautoassigned",
            "issystemgenerated",
            "isinherited",
            "canbedeleted",
            "_businessunitid_value",
        ];
        const filter = solutionId ? `&$filter=solutionid eq ${this.sanitizeGuid(solutionId)}` : "";
        const query = `roles?$select=${selects.join(",")}${filter}&$orderby=ismanaged asc,name asc&$top=5000`;
        const rows = await this.fetchAllRecords(query);
        return rows.map(
            (row: any): SecurityRole => ({
                roleid: row.roleid,
                name: row.name,
                solutionid: row.solutionid,
                ismanaged: row.ismanaged,
                roletemplateid: row.roletemplateid,
                isautoassigned: row.isautoassigned,
                issystemgenerated: row.issystemgenerated,
                isinherited: row.isinherited,
                canbedeleted: row.canbedeleted,
                _businessunitid_value: row._businessunitid_value,
                businessunitName: row["_businessunitid_value@OData.Community.Display.V1.FormattedValue"],
            }),
        );
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

        // Only table (CRUD-style) privileges resolve to an entity definition; skip metadata
        // lookups for miscellaneous privileges to avoid a flood of 404s.
        const uniqueEntityLogicalNames = Array.from(
            new Set(
                Array.from(privilegeMap.values())
                    .map((priv) => parsePrivilegeName(priv.name))
                    .filter((parsed) => parsed.isKnownOperation)
                    .map((parsed) => parsed.entityLogicalName),
            ),
        );
        const [layoutMaps, entityInfoEntries] = await Promise.all([
            this.fetchRoleEditorLayoutMaps(),
            Promise.all(uniqueEntityLogicalNames.map(async (logicalName) => [logicalName, await this.fetchEntityDisplayInfo(logicalName)] as const)),
        ]);
        const entityInfoByLogicalName = new Map<string, EntityDisplayInfo | null>(entityInfoEntries);

        // Build the comparison list
        const result: ParsedPrivilege[] = [];
        for (const [privilegeid, priv] of privilegeMap) {
            const parsed = parsePrivilegeName(priv.name);
            const depthByRole: Record<string, PrivilegeDepth> = {};
            const entityInfo = entityInfoByLogicalName.get(parsed.entityLogicalName) ?? null;
            const category = this.resolveCategory(priv.name, parsed, entityInfo, layoutMaps);

            let entityLogicalName: string;
            let entitySchemaName: string;
            let entityDisplayName: string;
            let operation: string;

            if (category.kind === "table") {
                entityLogicalName = entityInfo?.logicalName ?? parsed.entityLogicalName;
                entitySchemaName = entityInfo?.schemaName ?? parsed.entityToken;
                entityDisplayName = entityInfo?.displayName ?? category.layoutDisplayName ?? parsed.entityToken;
                operation = parsed.operation;
            } else {
                // Miscellaneous / privacy privileges have no entity/operation split; each is its own row.
                entityLogicalName = priv.name.toLowerCase();
                entitySchemaName = priv.name;
                entityDisplayName = category.layoutDisplayName || parsed.entityToken || priv.name;
                operation = "";
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
            return a.operation.localeCompare(b.operation);
        });

        return result;
    }

    /**
     * Determine the OOB-style grouping category for a privilege using the role editor layout,
     * falling back to entity-definition metadata (custom vs standard tables) when the layout
     * doesn't cover the privilege.
     */
    private resolveCategory(
        privilegeName: string,
        parsed: ReturnType<typeof parsePrivilegeName>,
        entityInfo: EntityDisplayInfo | null,
        maps: RoleEditorLayoutMaps,
    ): { kind: PrivilegeCategoryKind; key: string; label: string; order: number; layoutDisplayName?: string } {
        // 1. Miscellaneous / privacy privileges are listed explicitly in the layout.
        const privItem = maps.privilegeByName.get(privilegeName.toLowerCase());
        if (privItem) {
            const kind: PrivilegeCategoryKind = privItem.isPrivacyRelated ? "privacy" : "misc";
            const section = privItem.parentId ? maps.itemById.get(privItem.parentId) : undefined;
            const label = section?.displayName || (kind === "privacy" ? "Privacy Related Privileges" : "Miscellaneous Privileges");
            return { kind, key: privItem.parentId || kind, label, order: section?.tabOrder ?? 0, layoutDisplayName: privItem.displayName };
        }

        // 2. Table privileges are grouped under their entity's parent tab.
        const entityItem = maps.tabByEntityLogicalName.get(parsed.entityLogicalName);
        if (entityItem) {
            const tab = entityItem.parentId ? maps.itemById.get(entityItem.parentId) : undefined;
            const label = tab?.displayName || "Tables";
            return { kind: "table", key: entityItem.parentId || "tables", label, order: tab?.tabOrder ?? 900, layoutDisplayName: entityItem.displayName };
        }

        // 3. Fallback: a resolved entity definition -> table, split custom vs standard.
        if (entityInfo) {
            return entityInfo.isCustom
                ? { kind: "table", key: "custom-tables", label: "Custom Tables", order: 902 }
                : { kind: "table", key: "standard-tables", label: "Standard Tables", order: 901 };
        }

        // 4. Fallback: unclassified non-table privilege.
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
