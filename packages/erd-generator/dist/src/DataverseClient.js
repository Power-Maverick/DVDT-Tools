"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataverseClient = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Client for interacting with Dataverse Web API
 */
class DataverseClient {
    constructor(config) {
        this.environmentUrl = config.environmentUrl.replace(/\/$/, '');
        this.apiVersion = config.apiVersion || '9.2';
        this.axiosInstance = axios_1.default.create({
            baseURL: `${this.environmentUrl}/api/data/v${this.apiVersion}`,
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0',
            },
        });
    }
    /**
     * Fetch solution metadata from Dataverse
     * @param solutionUniqueName Unique name of the solution
     * @returns Solution with all tables and metadata
     */
    fetchSolution(solutionUniqueName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                // Fetch solution details
                const solutionResponse = yield this.axiosInstance.get(`/solutions?$filter=uniquename eq '${solutionUniqueName}'&$select=friendlyname,uniquename,_publisherid_value,version&$expand=publisherid($select=customizationprefix)`);
                if (!solutionResponse.data.value || solutionResponse.data.value.length === 0) {
                    throw new Error(`Solution '${solutionUniqueName}' not found`);
                }
                const solutionData = solutionResponse.data.value[0];
                // Publisher Prefix
                const publisherPrefix = (_b = (_a = solutionData.publisherid) === null || _a === void 0 ? void 0 : _a.customizationprefix) !== null && _b !== void 0 ? _b : 'unknown';
                // Fetch solution components (tables)
                const componentsResponse = yield this.axiosInstance.get(`/solutioncomponents?$filter=_solutionid_value eq ${solutionData.solutionid} and componenttype eq 1&$select=objectid`);
                const tableIds = componentsResponse.data.value.map((c) => c.objectid);
                console.log('tableIds', tableIds);
                // Fetch tables in parallel
                const tables = yield this.fetchTables(tableIds);
                console.log('tables', tables);
                return {
                    uniqueName: solutionData.uniquename,
                    displayName: solutionData.friendlyname,
                    version: solutionData.version,
                    publisherPrefix: publisherPrefix,
                    tables: tables,
                };
            }
            catch (error) {
                if (error.response) {
                    throw new Error(`Dataverse API error: ${error.response.status} - ${((_d = (_c = error.response.data) === null || _c === void 0 ? void 0 : _c.error) === null || _d === void 0 ? void 0 : _d.message) || error.message}`);
                }
                throw error;
            }
        });
    }
    /**
     * Fetch multiple tables by their IDs
     */
    fetchTables(tableIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const tables = [];
            for (const tableId of tableIds) {
                try {
                    const table = yield this.fetchTable(tableId);
                    if (table) {
                        tables.push(table);
                    }
                }
                catch (error) {
                    console.warn(`Failed to fetch table ${tableId}:`, error);
                }
            }
            return tables;
        });
    }
    /**
     * Fetch a single table by ID
     */
    fetchTable(tableId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Fetch entity metadata
                const entityResponse = yield this.axiosInstance.get(`/EntityDefinitions(${tableId})?$select=LogicalName,DisplayName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute,TableType`);
                const entity = entityResponse.data;
                // Fetch attributes
                const attributesResponse = yield this.axiosInstance.get(`/EntityDefinitions(${tableId})/Attributes?$select=LogicalName,DisplayName,AttributeType,IsPrimaryId,IsPrimaryName,RequiredLevel`);
                const attributes = attributesResponse.data.value.map((attr) => {
                    var _a, _b, _c, _d;
                    return ({
                        logicalName: attr.LogicalName,
                        displayName: ((_b = (_a = attr.DisplayName) === null || _a === void 0 ? void 0 : _a.UserLocalizedLabel) === null || _b === void 0 ? void 0 : _b.Label) || attr.LogicalName,
                        type: this.mapAttributeType(attr.AttributeType),
                        isPrimaryId: attr.IsPrimaryId || false,
                        isPrimaryName: attr.IsPrimaryName || false,
                        isRequired: ((_c = attr.RequiredLevel) === null || _c === void 0 ? void 0 : _c.Value) === 'ApplicationRequired' || ((_d = attr.RequiredLevel) === null || _d === void 0 ? void 0 : _d.Value) === 'SystemRequired',
                    });
                });
                // Fetch relationships
                const relationships = yield this.fetchRelationships(tableId, entity.LogicalName);
                return {
                    logicalName: entity.LogicalName,
                    displayName: ((_b = (_a = entity.DisplayName) === null || _a === void 0 ? void 0 : _a.UserLocalizedLabel) === null || _b === void 0 ? void 0 : _b.Label) || entity.LogicalName,
                    schemaName: entity.SchemaName,
                    primaryIdAttribute: entity.PrimaryIdAttribute,
                    primaryNameAttribute: entity.PrimaryNameAttribute,
                    tableType: entity.TableType,
                    attributes: attributes,
                    relationships: relationships,
                };
            }
            catch (error) {
                console.warn(`Failed to fetch table metadata for ${tableId}:`, error);
                return null;
            }
        });
    }
    /**
     * Fetch relationships for a table
     */
    fetchRelationships(tableId, logicalName) {
        return __awaiter(this, void 0, void 0, function* () {
            const relationships = [];
            try {
                // Fetch One-to-Many relationships
                const oneToManyResponse = yield this.axiosInstance.get(`/EntityDefinitions(${tableId})/OneToManyRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`);
                for (const rel of oneToManyResponse.data.value) {
                    if (rel.ReferencedEntity === logicalName) {
                        relationships.push({
                            schemaName: rel.SchemaName,
                            type: 'OneToMany',
                            relatedTable: rel.ReferencingEntity,
                            lookupAttribute: rel.ReferencingAttribute,
                        });
                    }
                }
                // Fetch Many-to-One relationships
                const manyToOneResponse = yield this.axiosInstance.get(`/EntityDefinitions(${tableId})/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`);
                for (const rel of manyToOneResponse.data.value) {
                    if (rel.ReferencingEntity === logicalName) {
                        relationships.push({
                            schemaName: rel.SchemaName,
                            type: 'ManyToOne',
                            relatedTable: rel.ReferencedEntity,
                            lookupAttribute: rel.ReferencingAttribute,
                        });
                    }
                }
                // Fetch Many-to-Many relationships
                const manyToManyResponse = yield this.axiosInstance.get(`/EntityDefinitions(${tableId})/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName`);
                for (const rel of manyToManyResponse.data.value) {
                    const isEntity1 = rel.Entity1LogicalName === logicalName;
                    relationships.push({
                        schemaName: rel.SchemaName,
                        type: 'ManyToMany',
                        relatedTable: isEntity1 ? rel.Entity2LogicalName : rel.Entity1LogicalName,
                        intersectTable: rel.IntersectEntityName,
                    });
                }
            }
            catch (error) {
                console.warn(`Failed to fetch relationships for ${logicalName}:`, error);
            }
            return relationships;
        });
    }
    /**
     * Map Dataverse attribute types to simplified types
     */
    mapAttributeType(attributeType) {
        const typeMap = {
            'String': 'string',
            'Memo': 'string',
            'Integer': 'int',
            'BigInt': 'int',
            'Decimal': 'decimal',
            'Double': 'decimal',
            'Money': 'money',
            'DateTime': 'datetime',
            'Boolean': 'boolean',
            'Lookup': 'lookup',
            'Customer': 'lookup',
            'Owner': 'lookup',
            'Picklist': 'picklist',
            'State': 'picklist',
            'Status': 'picklist',
            'Uniqueidentifier': 'guid',
        };
        return typeMap[attributeType] || 'string';
    }
    /**
     * List all solutions in the environment
     * @returns Array of solution names
     */
    listSolutions() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const response = yield this.axiosInstance.get(`/solutions?$select=uniquename,friendlyname,version&$filter=isvisible eq true&$orderby=friendlyname asc`);
                return response.data.value.map((s) => ({
                    uniqueName: s.uniquename,
                    displayName: s.friendlyname,
                    version: s.version,
                }));
            }
            catch (error) {
                if (error.response) {
                    throw new Error(`Dataverse API error: ${error.response.status} - ${((_b = (_a = error.response.data) === null || _a === void 0 ? void 0 : _a.error) === null || _b === void 0 ? void 0 : _b.message) || error.message}`);
                }
                throw error;
            }
        });
    }
}
exports.DataverseClient = DataverseClient;
//# sourceMappingURL=DataverseClient.js.map