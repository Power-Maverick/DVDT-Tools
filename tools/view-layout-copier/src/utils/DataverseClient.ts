import { Solution, TableInfo, ViewInfo } from "../models/interfaces";

/** Escape OData string literals to prevent query injection */
function escapeODataString(value: string): string {
    return value.replace(/'/g, "''");
}

function extractLabel(value: any): string {
    return value?.UserLocalizedLabel?.Label || value?.LocalizedLabels?.[0]?.Label || "";
}

export interface ViewUpdatePayload {
    fetchxml?: string;
    layoutxml?: string;
    layoutjson?: string;
    returnedtypecode?: string;
}

export class DataverseClient {
    /** List visible, unmanaged solutions (the only ones this tool can write to), alphabetized by display name */
    async listSolutions(): Promise<Solution[]> {
        const entitySetName = await window.dataverseAPI.getEntitySetName("solution");
        const response = await window.dataverseAPI.queryData(
            `${entitySetName}?$select=solutionid,friendlyname,uniquename,version&$filter=isvisible eq true and ismanaged eq false&$orderby=friendlyname asc`,
        );

        return response.value.map((s: any) => ({
            id: s.solutionid,
            uniqueName: s.uniquename,
            displayName: s.friendlyname,
            version: s.version,
        }));
    }

    /**
     * The solution the current user has selected as their default/preferred solution in the
     * maker portal (usersettings.preferredsolution), if any. Returns null if unset, unavailable,
     * or the lookup fails for any reason — callers should fall back to their own default.
     */
    async getPreferredSolutionId(): Promise<string | null> {
        try {
            const who = await window.dataverseAPI.execute({ operationName: "WhoAmI", operationType: "function" });
            const userId = who.UserId as string | undefined;
            if (!userId) return null;

            // usersettings' entity set name ("usersettingscollection") doesn't follow normal
            // pluralization rules, so it's hardcoded here rather than derived.
            const response = await window.dataverseAPI.queryData(
                `usersettingscollection?$select=systemuserid&$filter=systemuserid eq ${escapeODataString(userId)}&$expand=preferredsolution($select=solutionid)`,
            );

            const solutionId = (response.value[0] as any)?.preferredsolution?.solutionid;
            return typeof solutionId === "string" ? solutionId : null;
        } catch (error) {
            console.warn("Could not determine the user's preferred solution:", error);
            return null;
        }
    }

    /** Get the MetadataIds of the tables contained in a solution */
    async listSolutionTableIds(solutionId: string): Promise<Set<string>> {
        const entitySetName = await window.dataverseAPI.getEntitySetName("solutioncomponent");
        const response = await window.dataverseAPI.queryData(`${entitySetName}?$select=objectid&$filter=_solutionid_value eq ${escapeODataString(solutionId)} and componenttype eq 1`);
        return new Set(response.value.map((c: any) => String(c.objectid).toLowerCase()));
    }

    /** List all tables usable by this tool, alphabetized by display name */
    async listTables(): Promise<TableInfo[]> {
        const response = await window.dataverseAPI.getAllEntitiesMetadata([
            "LogicalName",
            "SchemaName",
            "DisplayName",
            "ObjectTypeCode",
            "MetadataId",
            "PrimaryNameAttribute",
            "IsValidForAdvancedFind",
            "IsCustomizable",
        ]);

        return response.value
            .filter((e: any) => e.IsValidForAdvancedFind === true && e.IsCustomizable?.Value === true)
            .map((e: any) => ({
                logicalName: e.LogicalName,
                schemaName: e.SchemaName || e.LogicalName,
                displayName: extractLabel(e.DisplayName) || e.LogicalName,
                objectTypeCode: e.ObjectTypeCode,
                metadataId: String(e.MetadataId).toLowerCase(),
                primaryNameAttribute: e.PrimaryNameAttribute || "name",
            }))
            .sort((a: TableInfo, b: TableInfo) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
    }

    /** List system views (savedquery) and personal views (userquery) for a table */
    async listViews(tableLogicalName: string): Promise<ViewInfo[]> {
        const escapedName = escapeODataString(tableLogicalName);

        const savedQuerySet = await window.dataverseAPI.getEntitySetName("savedquery");
        const systemViewsPromise = (async () => {
            const filter = `$filter=returnedtypecode eq '${escapedName}' and statecode eq 0&$orderby=name asc`;
            try {
                return await window.dataverseAPI.queryData(`${savedQuerySet}?$select=savedqueryid,name,description,fetchxml,layoutxml,layoutjson,querytype,isdefault&${filter}`);
            } catch {
                // Older environments may not expose layoutjson — retry without it
                return await window.dataverseAPI.queryData(`${savedQuerySet}?$select=savedqueryid,name,description,fetchxml,layoutxml,querytype,isdefault&${filter}`);
            }
        })();

        // Personal views are optional — the user may lack read privileges on userquery
        const personalViewsPromise = (async () => {
            try {
                const userQuerySet = await window.dataverseAPI.getEntitySetName("userquery");
                return await window.dataverseAPI.queryData(
                    `${userQuerySet}?$select=userqueryid,name,description,fetchxml,layoutxml,querytype&$filter=returnedtypecode eq '${escapedName}' and statecode eq 0&$orderby=name asc`,
                );
            } catch (error) {
                console.warn("Could not load personal views:", error);
                return { value: [] };
            }
        })();

        const [systemViews, personalViews] = await Promise.all([systemViewsPromise, personalViewsPromise]);

        const views: ViewInfo[] = [
            ...systemViews.value.map((v: any) => ({
                id: v.savedqueryid,
                name: v.name,
                description: v.description || undefined,
                fetchxml: v.fetchxml,
                layoutxml: v.layoutxml,
                layoutjson: v.layoutjson ?? null,
                returnedtypecode: tableLogicalName,
                querytype: v.querytype ?? 0,
                isDefault: v.isdefault === true,
                isPersonal: false,
            })),
            ...personalViews.value.map((v: any) => ({
                id: v.userqueryid,
                name: v.name,
                description: v.description || undefined,
                fetchxml: v.fetchxml,
                layoutxml: v.layoutxml,
                layoutjson: null,
                returnedtypecode: tableLogicalName,
                querytype: v.querytype ?? 0,
                isDefault: false,
                isPersonal: true,
            })),
        ];

        // Views without a layout (e.g. some offline templates) can't participate in layout copying
        return views.filter((v) => !!v.layoutxml);
    }

    /** Map of attribute logical name -> display name, for the layout preview */
    async listAttributeDisplayNames(tableLogicalName: string): Promise<Map<string, string>> {
        const response: any = await window.dataverseAPI.getEntityRelatedMetadata(tableLogicalName, "Attributes", ["LogicalName", "DisplayName"]);
        const map = new Map<string, string>();
        for (const attr of response.value ?? []) {
            map.set(attr.LogicalName, extractLabel(attr.DisplayName) || attr.LogicalName);
        }
        return map;
    }

    /** Update a system or personal view with the merged layout/fetch changes */
    async updateView(view: ViewInfo, payload: ViewUpdatePayload): Promise<void> {
        const entityName = view.isPersonal ? "userquery" : "savedquery";
        const updatePayload = payload.fetchxml ? { ...payload, returnedtypecode: view.returnedtypecode } : payload;
        await window.dataverseAPI.update(entityName, view.id, updatePayload as Record<string, unknown>);
    }

    /** Publish the table once after all system view updates (personal views don't need publishing) */
    async publishTable(tableLogicalName: string): Promise<void> {
        await window.dataverseAPI.publishCustomizations(tableLogicalName);
    }
}
