/**
 * In-browser mock of window.dataverseAPI / window.toolboxAPI so the tool can be
 * exercised locally (npm run dev) without Power Platform ToolBox.
 *
 * Only the API surface this tool uses is implemented. Updates mutate the
 * in-memory store, so copying layouts visibly "works" in demo mode.
 */

interface MockView {
    savedqueryid: string;
    name: string;
    description?: string;
    returnedtypecode: string;
    querytype: number;
    isdefault: boolean;
    fetchxml: string;
    layoutxml: string;
    layoutjson: string | null;
    statecode: number;
}

interface MockUserView {
    userqueryid: string;
    name: string;
    description?: string;
    returnedtypecode: string;
    querytype: number;
    fetchxml: string;
    layoutxml: string;
    statecode: number;
}

interface MockAttribute {
    LogicalName: string;
    DisplayName: { UserLocalizedLabel: { Label: string }; LocalizedLabels: { Label: string; LanguageCode: number }[] };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function label(text: string) {
    return { UserLocalizedLabel: { Label: text }, LocalizedLabels: [{ Label: text, LanguageCode: 1033 }] };
}

function attr(logicalName: string, displayName: string): MockAttribute {
    return { LogicalName: logicalName, DisplayName: label(displayName) };
}

function grid(primaryKey: string, cells: Array<[string, number] | [string, number, boolean]>, gridAttrs = 'jump="name" select="1" icon="1" preview="1"'): string {
    const cellsXml = cells.map(([name, width, hidden]) => `<cell name="${name}" width="${width}"${hidden ? ' ishidden="1"' : ""} />`).join("");
    return `<grid name="resultset" object="1" ${gridAttrs}><row name="result" id="${primaryKey}">${cellsXml}</row></grid>`;
}

function fetchXml(entity: string, attributes: string[], orders: Array<[string, boolean]>, filterXml = "", linkXml = ""): string {
    const attrsXml = attributes.map((a) => `<attribute name="${a}" />`).join("");
    const ordersXml = orders.map(([a, desc]) => `<order attribute="${a}" descending="${desc}" />`).join("");
    return `<fetch version="1.0" output-format="xml-platform" mapping="logical"><entity name="${entity}">${attrsXml}${ordersXml}${filterXml}${linkXml}</entity></fetch>`;
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SOLUTIONS = [
    { solutionid: "a1000000-0000-0000-0000-000000000001", friendlyname: "Common Data Services Default Solution", uniquename: "Cr123Default", version: "1.0.0.0", ismanaged: false, isvisible: true },
    { solutionid: "a1000000-0000-0000-0000-000000000002", friendlyname: "Contoso Sales Core", uniquename: "contoso_salescore", version: "2.4.1.0", ismanaged: false, isvisible: true },
    { solutionid: "a1000000-0000-0000-0000-000000000003", friendlyname: "Contoso Service Desk", uniquename: "contoso_servicedesk", version: "1.7.0.2", ismanaged: true, isvisible: true },
    { solutionid: "a1000000-0000-0000-0000-000000000004", friendlyname: "Project Tracker", uniquename: "contoso_projecttracker", version: "0.9.3.0", ismanaged: false, isvisible: true },
];

const MOCK_USER_ID = "c0000000-0000-0000-0000-000000000001";
// Simulates a maker having picked a preferred solution in the maker portal — not the
// alphabetically-first one, so demo mode exercises the "honor the user's choice" path.
const MOCK_PREFERRED_SOLUTION_ID = "a1000000-0000-0000-0000-000000000002";

const ENTITIES = [
    {
        MetadataId: "e0000000-0000-0000-0000-00000000000a",
        LogicalName: "account",
        SchemaName: "Account",
        DisplayName: label("Account"),
        ObjectTypeCode: 1,
        PrimaryNameAttribute: "name",
        IsValidForAdvancedFind: true,
        IsCustomizable: { Value: true },
    },
    {
        MetadataId: "e0000000-0000-0000-0000-00000000000b",
        LogicalName: "contact",
        SchemaName: "Contact",
        DisplayName: label("Contact"),
        ObjectTypeCode: 2,
        PrimaryNameAttribute: "fullname",
        IsValidForAdvancedFind: true,
        IsCustomizable: { Value: true },
    },
    {
        MetadataId: "e0000000-0000-0000-0000-00000000000c",
        LogicalName: "opportunity",
        SchemaName: "Opportunity",
        DisplayName: label("Opportunity"),
        ObjectTypeCode: 3,
        PrimaryNameAttribute: "name",
        IsValidForAdvancedFind: true,
        IsCustomizable: { Value: true },
    },
    {
        MetadataId: "e0000000-0000-0000-0000-00000000000d",
        LogicalName: "incident",
        SchemaName: "Incident",
        DisplayName: label("Case"),
        ObjectTypeCode: 112,
        PrimaryNameAttribute: "title",
        IsValidForAdvancedFind: true,
        IsCustomizable: { Value: true },
    },
    {
        MetadataId: "e0000000-0000-0000-0000-00000000000e",
        LogicalName: "contoso_project",
        SchemaName: "contoso_Project",
        DisplayName: label("Project"),
        ObjectTypeCode: 10001,
        PrimaryNameAttribute: "contoso_name",
        IsValidForAdvancedFind: true,
        IsCustomizable: { Value: true },
    },
    {
        MetadataId: "e0000000-0000-0000-0000-00000000000f",
        LogicalName: "contoso_projecttask",
        SchemaName: "contoso_ProjectTask",
        DisplayName: label("Project Task"),
        ObjectTypeCode: 10002,
        PrimaryNameAttribute: "contoso_name",
        IsValidForAdvancedFind: true,
        IsCustomizable: { Value: true },
    },
];

const SOLUTION_COMPONENTS: Record<string, string[]> = {
    "a1000000-0000-0000-0000-000000000001": ENTITIES.map((e) => e.MetadataId),
    "a1000000-0000-0000-0000-000000000002": ["e0000000-0000-0000-0000-00000000000a", "e0000000-0000-0000-0000-00000000000b", "e0000000-0000-0000-0000-00000000000c"],
    "a1000000-0000-0000-0000-000000000003": ["e0000000-0000-0000-0000-00000000000b", "e0000000-0000-0000-0000-00000000000d"],
    "a1000000-0000-0000-0000-000000000004": ["e0000000-0000-0000-0000-00000000000e", "e0000000-0000-0000-0000-00000000000f"],
};

const ATTRIBUTES: Record<string, MockAttribute[]> = {
    account: [
        attr("name", "Account Name"),
        attr("accountnumber", "Account Number"),
        attr("primarycontactid", "Primary Contact"),
        attr("telephone1", "Main Phone"),
        attr("emailaddress1", "Email"),
        attr("address1_city", "City"),
        attr("address1_stateorprovince", "State/Province"),
        attr("revenue", "Annual Revenue"),
        attr("numberofemployees", "Number of Employees"),
        attr("ownerid", "Owner"),
        attr("createdon", "Created On"),
        attr("modifiedon", "Modified On"),
        attr("statecode", "Status"),
        attr("industrycode", "Industry"),
        attr("websiteurl", "Website"),
    ],
    contact: [
        attr("fullname", "Full Name"),
        attr("firstname", "First Name"),
        attr("lastname", "Last Name"),
        attr("emailaddress1", "Email"),
        attr("telephone1", "Business Phone"),
        attr("mobilephone", "Mobile Phone"),
        attr("parentcustomerid", "Company Name"),
        attr("jobtitle", "Job Title"),
        attr("address1_city", "City"),
        attr("ownerid", "Owner"),
        attr("createdon", "Created On"),
        attr("modifiedon", "Modified On"),
    ],
    opportunity: [
        attr("name", "Topic"),
        attr("customerid", "Potential Customer"),
        attr("estimatedvalue", "Est. Revenue"),
        attr("estimatedclosedate", "Est. Close Date"),
        attr("closeprobability", "Probability"),
        attr("salesstage", "Sales Stage"),
        attr("ownerid", "Owner"),
        attr("createdon", "Created On"),
        attr("modifiedon", "Modified On"),
    ],
    incident: [
        attr("title", "Case Title"),
        attr("ticketnumber", "Case Number"),
        attr("customerid", "Customer"),
        attr("prioritycode", "Priority"),
        attr("statuscode", "Status Reason"),
        attr("caseorigincode", "Origin"),
        attr("ownerid", "Owner"),
        attr("createdon", "Created On"),
    ],
    contoso_project: [
        attr("contoso_name", "Project Name"),
        attr("contoso_projectcode", "Project Code"),
        attr("contoso_startdate", "Start Date"),
        attr("contoso_enddate", "End Date"),
        attr("contoso_budget", "Budget"),
        attr("contoso_status", "Project Status"),
        attr("ownerid", "Owner"),
        attr("createdon", "Created On"),
        attr("modifiedon", "Modified On"),
    ],
    contoso_projecttask: [
        attr("contoso_name", "Task Name"),
        attr("contoso_projectid", "Project"),
        attr("contoso_duedate", "Due Date"),
        attr("contoso_effort", "Effort (hours)"),
        attr("contoso_complete", "Complete"),
        attr("ownerid", "Owner"),
        attr("createdon", "Created On"),
    ],
};

let viewIdSeed = 0;
function nextViewId(): string {
    viewIdSeed += 1;
    return `b${String(viewIdSeed).padStart(7, "0")}-0000-0000-0000-000000000000`;
}

function makeViews(
    entity: string,
    primaryKey: string,
    primaryName: string,
    defs: Array<{
        name: string;
        querytype: number;
        isdefault?: boolean;
        cells: Array<[string, number]>;
        orders?: Array<[string, boolean]>;
        filter?: string;
        link?: string;
        layoutjson?: boolean;
        description?: string;
    }>,
): MockView[] {
    return defs.map((d) => ({
        savedqueryid: nextViewId(),
        name: d.name,
        description: d.description,
        returnedtypecode: entity,
        querytype: d.querytype,
        isdefault: d.isdefault ?? false,
        fetchxml: fetchXml(
            entity,
            Array.from(new Set([primaryKey.replace("id", "id"), ...d.cells.map(([c]) => c).filter((c) => !c.includes("."))])),
            d.orders ?? [[primaryName, false]],
            d.filter ?? "",
            d.link ?? "",
        ),
        layoutxml: grid(primaryKey, d.cells),
        layoutjson: d.layoutjson ? JSON.stringify({ Name: "resultset", Object: 1, CustomControlDescriptions: [{ ControlDescription: "PowerApps.CoreControls.Grid" }] }) : null,
        statecode: 0,
    }));
}

const ACCOUNT_LINK = `<link-entity name="contact" from="contactid" to="primarycontactid" link-type="outer" alias="primarycontact"><attribute name="emailaddress1" /><filter><condition attribute="statecode" operator="eq" value="0" /></filter></link-entity>`;

const SYSTEM_VIEWS: MockView[] = [
    ...makeViews("account", "accountid", "name", [
        {
            name: "Active Accounts",
            querytype: 0,
            isdefault: true,
            cells: [
                ["name", 300],
                ["telephone1", 130],
                ["address1_city", 130],
                ["primarycontactid", 180],
                ["primarycontact.emailaddress1", 200],
            ],
            orders: [["name", false]],
            filter: `<filter type="and"><condition attribute="statecode" operator="eq" value="0" /></filter>`,
            link: ACCOUNT_LINK,
            layoutjson: true,
            description: "Default view: all active accounts.",
        },
        {
            name: "My Active Accounts",
            querytype: 0,
            cells: [
                ["name", 250],
                ["telephone1", 120],
                ["emailaddress1", 180],
                ["modifiedon", 130],
            ],
            orders: [["modifiedon", true]],
            filter: `<filter type="and"><condition attribute="ownerid" operator="eq-userid" /><condition attribute="statecode" operator="eq" value="0" /></filter>`,
        },
        {
            name: "Accounts by Revenue",
            querytype: 0,
            cells: [
                ["name", 280],
                ["revenue", 140],
                ["numberofemployees", 120],
                ["industrycode", 150],
                ["ownerid", 160],
            ],
            orders: [["revenue", true]],
        },
        {
            name: "Accounts by Number",
            querytype: 0,
            cells: [
                ["accountnumber", 130],
                ["name", 280],
                ["ownerid", 150],
            ],
            orders: [["accountnumber", false]],
            description: "First column is not the primary name — selecting a lookup view as target should warn.",
        },
        {
            name: "Account Advanced Find View",
            querytype: 1,
            cells: [
                ["name", 300],
                ["accountnumber", 120],
                ["telephone1", 130],
                ["ownerid", 150],
            ],
        },
        {
            name: "Account Associated View",
            querytype: 2,
            cells: [
                ["name", 250],
                ["telephone1", 130],
                ["address1_city", 120],
            ],
        },
        {
            name: "Quick Find Active Accounts",
            querytype: 4,
            cells: [
                ["name", 250],
                ["telephone1", 130],
                ["emailaddress1", 180],
            ],
            filter: `<filter type="and" isquickfindfields="1"><condition attribute="name" operator="like" value="{0}" /></filter>`,
        },
        {
            name: "Account Lookup View",
            querytype: 64,
            cells: [
                ["name", 250],
                ["address1_city", 120],
            ],
        },
    ]),
    ...makeViews("contact", "contactid", "fullname", [
        {
            name: "Active Contacts",
            querytype: 0,
            isdefault: true,
            cells: [
                ["fullname", 250],
                ["emailaddress1", 200],
                ["parentcustomerid", 180],
                ["telephone1", 130],
            ],
        },
        {
            name: "My Connections",
            querytype: 0,
            cells: [
                ["fullname", 220],
                ["jobtitle", 160],
                ["mobilephone", 130],
            ],
        },
        {
            name: "Contacts Lookup View",
            querytype: 64,
            cells: [
                ["fullname", 220],
                ["emailaddress1", 200],
            ],
        },
        {
            name: "Quick Find Active Contacts",
            querytype: 4,
            cells: [
                ["fullname", 220],
                ["emailaddress1", 200],
                ["telephone1", 130],
            ],
        },
        {
            name: "Contacts Associated View",
            querytype: 2,
            cells: [
                ["fullname", 220],
                ["emailaddress1", 200],
                ["jobtitle", 150],
            ],
        },
    ]),
    ...makeViews("opportunity", "opportunityid", "name", [
        {
            name: "Open Opportunities",
            querytype: 0,
            isdefault: true,
            cells: [
                ["name", 280],
                ["customerid", 180],
                ["estimatedvalue", 130],
                ["estimatedclosedate", 130],
                ["salesstage", 130],
            ],
            orders: [["estimatedclosedate", false]],
        },
        {
            name: "Closing Next Month",
            querytype: 0,
            cells: [
                ["name", 260],
                ["estimatedvalue", 130],
                ["closeprobability", 110],
                ["ownerid", 150],
            ],
            orders: [["estimatedvalue", true]],
        },
        {
            name: "Opportunity Lookup View",
            querytype: 64,
            cells: [
                ["name", 260],
                ["customerid", 180],
            ],
        },
        {
            name: "Opportunity Advanced Find View",
            querytype: 1,
            cells: [
                ["name", 280],
                ["customerid", 180],
                ["estimatedvalue", 130],
            ],
        },
    ]),
    ...makeViews("incident", "incidentid", "title", [
        {
            name: "Active Cases",
            querytype: 0,
            isdefault: true,
            cells: [
                ["title", 280],
                ["ticketnumber", 120],
                ["prioritycode", 100],
                ["customerid", 180],
                ["createdon", 130],
            ],
            orders: [["createdon", true]],
        },
        {
            name: "My Active Cases",
            querytype: 0,
            cells: [
                ["title", 280],
                ["prioritycode", 100],
                ["statuscode", 130],
            ],
        },
        {
            name: "Case Lookup View",
            querytype: 64,
            cells: [
                ["ticketnumber", 120],
                ["title", 280],
            ],
        },
        {
            name: "Cases Associated View",
            querytype: 2,
            cells: [
                ["title", 260],
                ["ticketnumber", 120],
                ["statuscode", 130],
            ],
        },
    ]),
    ...makeViews("contoso_project", "contoso_projectid", "contoso_name", [
        {
            name: "Active Projects",
            querytype: 0,
            isdefault: true,
            cells: [
                ["contoso_name", 280],
                ["contoso_projectcode", 120],
                ["contoso_startdate", 120],
                ["contoso_enddate", 120],
                ["contoso_status", 130],
            ],
        },
        {
            name: "Projects over Budget",
            querytype: 0,
            cells: [
                ["contoso_name", 260],
                ["contoso_budget", 130],
                ["ownerid", 150],
            ],
            orders: [["contoso_budget", true]],
        },
        {
            name: "Project Lookup View",
            querytype: 64,
            cells: [
                ["contoso_name", 260],
                ["contoso_projectcode", 120],
            ],
        },
        {
            name: "Project Quick Find",
            querytype: 4,
            cells: [
                ["contoso_name", 260],
                ["contoso_projectcode", 120],
            ],
        },
    ]),
    ...makeViews("contoso_projecttask", "contoso_projecttaskid", "contoso_name", [
        {
            name: "All Project Tasks",
            querytype: 0,
            isdefault: true,
            cells: [
                ["contoso_name", 280],
                ["contoso_projectid", 180],
                ["contoso_duedate", 120],
                ["contoso_complete", 100],
            ],
        },
        {
            name: "Task Associated View",
            querytype: 2,
            cells: [
                ["contoso_name", 260],
                ["contoso_duedate", 120],
            ],
        },
        { name: "Task Lookup View", querytype: 64, cells: [["contoso_name", 260]] },
    ]),
];

const PERSONAL_VIEWS: MockUserView[] = [
    {
        userqueryid: nextViewId(),
        name: "West Region Accounts (mine)",
        returnedtypecode: "account",
        querytype: 0,
        fetchxml: fetchXml(
            "account",
            ["name", "address1_stateorprovince", "revenue"],
            [["name", false]],
            `<filter type="and"><condition attribute="address1_stateorprovince" operator="eq" value="WA" /></filter>`,
        ),
        layoutxml: grid("accountid", [
            ["name", 280],
            ["address1_stateorprovince", 120],
            ["revenue", 130],
        ]),
        statecode: 0,
    },
    {
        userqueryid: nextViewId(),
        name: "My VIP Contacts",
        returnedtypecode: "contact",
        querytype: 0,
        fetchxml: fetchXml("contact", ["fullname", "emailaddress1", "mobilephone"], [["fullname", false]]),
        layoutxml: grid("contactid", [
            ["fullname", 240],
            ["emailaddress1", 200],
            ["mobilephone", 130],
        ]),
        statecode: 0,
    },
];

// ---------------------------------------------------------------------------
// Mock API implementation
// ---------------------------------------------------------------------------

function getFilterValue(query: string, pattern: RegExp): string | undefined {
    return pattern.exec(query)?.[1];
}

export function installMockAPI(): void {
    const dataverseAPI: any = {
        async getEntitySetName(logicalName: string): Promise<string> {
            const irregular: Record<string, string> = {
                solution: "solutions",
                solutioncomponent: "solutioncomponents",
                savedquery: "savedqueries",
                userquery: "userqueries",
            };
            return irregular[logicalName] ?? `${logicalName}s`;
        },

        async getAllEntitiesMetadata(): Promise<{ value: unknown[] }> {
            await delay(400);
            return { value: ENTITIES };
        },

        async getEntityRelatedMetadata(entityLogicalName: string, relatedPath: string): Promise<{ value: unknown[] }> {
            await delay(200);
            if (relatedPath === "Attributes") {
                return { value: ATTRIBUTES[entityLogicalName] ?? [] };
            }
            return { value: [] };
        },

        async queryData(odataQuery: string): Promise<{ value: unknown[] }> {
            await delay(300);

            if (odataQuery.startsWith("solutions?")) {
                // Mirrors the real "isvisible eq true and ismanaged eq false" filter this tool sends.
                return { value: SOLUTIONS.filter((s) => s.ismanaged === false) };
            }

            if (odataQuery.startsWith("usersettingscollection?")) {
                const userId = getFilterValue(odataQuery, /systemuserid eq ([0-9a-f-]+)/i);
                if (userId !== MOCK_USER_ID) return { value: [] };
                return { value: [{ systemuserid: MOCK_USER_ID, preferredsolution: { solutionid: MOCK_PREFERRED_SOLUTION_ID } }] };
            }

            if (odataQuery.startsWith("solutioncomponents?")) {
                const solutionId = getFilterValue(odataQuery, /_solutionid_value eq ([0-9a-f-]+)/i);
                const ids = (solutionId && SOLUTION_COMPONENTS[solutionId]) || [];
                return { value: ids.map((objectid) => ({ objectid })) };
            }

            if (odataQuery.startsWith("savedqueries?")) {
                const entity = getFilterValue(odataQuery, /returnedtypecode eq '([^']+)'/);
                return { value: SYSTEM_VIEWS.filter((v) => v.returnedtypecode === entity) };
            }

            if (odataQuery.startsWith("userqueries?")) {
                const entity = getFilterValue(odataQuery, /returnedtypecode eq '([^']+)'/);
                return { value: PERSONAL_VIEWS.filter((v) => v.returnedtypecode === entity) };
            }

            return { value: [] };
        },

        async retrieve(entityLogicalName: string, id: string): Promise<Record<string, unknown>> {
            await delay(150);
            if (entityLogicalName === "savedquery") {
                const view = SYSTEM_VIEWS.find((v) => v.savedqueryid === id);
                if (view) return view as unknown as Record<string, unknown>;
            }
            if (entityLogicalName === "userquery") {
                const view = PERSONAL_VIEWS.find((v) => v.userqueryid === id);
                if (view) return view as unknown as Record<string, unknown>;
            }
            throw new Error(`Record not found: ${entityLogicalName} ${id}`);
        },

        async update(entityLogicalName: string, id: string, record: Record<string, unknown>): Promise<void> {
            await delay(500);
            if (record.fetchxml && !record.returnedtypecode) {
                throw new Error("Dataverse update failed: 0x80040216: An unexpected error occurred.");
            }
            const view: any =
                entityLogicalName === "savedquery" ? SYSTEM_VIEWS.find((v) => v.savedqueryid === id) : entityLogicalName === "userquery" ? PERSONAL_VIEWS.find((v) => v.userqueryid === id) : undefined;
            if (!view) {
                throw new Error(`Record not found: ${entityLogicalName} ${id}`);
            }
            Object.assign(view, record);
            console.info(`[mock] Updated ${entityLogicalName} '${view.name}'`, record);
        },

        async publishCustomizations(tableLogicalName?: string): Promise<void> {
            await delay(800);
            console.info(`[mock] Published customizations for ${tableLogicalName ?? "all"}`);
        },

        async execute(request: { operationName: string; operationType: string }): Promise<Record<string, unknown>> {
            await delay(100);
            if (request.operationName === "WhoAmI") {
                return { UserId: MOCK_USER_ID };
            }
            throw new Error(`Mock does not implement operation '${request.operationName}'`);
        },
    };

    const toolboxAPI: any = {
        connections: {
            async getActiveConnection() {
                return { url: "https://contoso-demo.crm.dynamics.com", name: "Contoso Demo (mock)" };
            },
        },
        utils: {
            async showNotification(options: { title: string; body: string; type: string }) {
                console.info(`[mock notification] ${options.type}: ${options.title} — ${options.body}`);
            },
            async getCurrentTheme() {
                return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
            },
        },
        events: {
            on() {
                /* no-op */
            },
            off() {
                /* no-op */
            },
        },
    };

    (window as any).dataverseAPI = dataverseAPI;
    (window as any).toolboxAPI = toolboxAPI;
    (window as any).__PPTB_MOCK__ = true;
}
