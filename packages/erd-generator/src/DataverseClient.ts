import axios, { AxiosInstance } from 'axios';
import { DataverseSolution, DataverseTable, DataverseAttribute, DataverseRelationship } from './types';

/**
 * Configuration for connecting to Dataverse
 */
export interface DataverseConfig {
  /** Dataverse environment URL (e.g., https://org.crm.dynamics.com) */
  environmentUrl: string;
  /** Access token for authentication */
  accessToken: string;
  /** API version to use (default: 9.2) */
  apiVersion?: string;
}

/**
 * Client for interacting with Dataverse Web API
 */
export class DataverseClient {
  private axiosInstance: AxiosInstance;
  private environmentUrl: string;
  private apiVersion: string;

  constructor(config: DataverseConfig) {
    this.environmentUrl = config.environmentUrl.replace(/\/$/, '');
    this.apiVersion = config.apiVersion || '9.2';

    this.axiosInstance = axios.create({
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
  async fetchSolution(solutionUniqueName: string): Promise<DataverseSolution> {
    try {
      // Fetch solution details
      const solutionResponse = await this.axiosInstance.get(
        `/solutions?$filter=uniquename eq '${solutionUniqueName}'&$select=uniquename,friendlyname,version,publisherid`
      );

      if (!solutionResponse.data.value || solutionResponse.data.value.length === 0) {
        throw new Error(`Solution '${solutionUniqueName}' not found`);
      }

      const solutionData = solutionResponse.data.value[0];

      // Fetch publisher prefix
      const publisherResponse = await this.axiosInstance.get(
        `/publishers(${solutionData.publisherid})?$select=customizationprefix`
      );
      const publisherPrefix = publisherResponse.data.customizationprefix || 'unknown';

      // Fetch solution components (tables)
      const componentsResponse = await this.axiosInstance.get(
        `/solutioncomponents?$filter=_solutionid_value eq ${solutionData.solutionid} and componenttype eq 1&$select=objectid`
      );

      const tableIds = componentsResponse.data.value.map((c: any) => c.objectid);
      
      // Fetch tables in parallel
      const tables = await this.fetchTables(tableIds);

      return {
        uniqueName: solutionData.uniquename,
        displayName: solutionData.friendlyname,
        version: solutionData.version,
        publisherPrefix: publisherPrefix,
        tables: tables,
      };
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Dataverse API error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetch multiple tables by their IDs
   */
  private async fetchTables(tableIds: string[]): Promise<DataverseTable[]> {
    const tables: DataverseTable[] = [];

    for (const tableId of tableIds) {
      try {
        const table = await this.fetchTable(tableId);
        if (table) {
          tables.push(table);
        }
      } catch (error) {
        console.warn(`Failed to fetch table ${tableId}:`, error);
      }
    }

    return tables;
  }

  /**
   * Fetch a single table by ID
   */
  private async fetchTable(tableId: string): Promise<DataverseTable | null> {
    try {
      // Fetch entity metadata
      const entityResponse = await this.axiosInstance.get(
        `/EntityDefinitions(${tableId})?$select=LogicalName,DisplayName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute,TableType`
      );

      const entity = entityResponse.data;

      // Fetch attributes
      const attributesResponse = await this.axiosInstance.get(
        `/EntityDefinitions(${tableId})/Attributes?$select=LogicalName,DisplayName,AttributeType,IsPrimaryId,IsPrimaryName,RequiredLevel,MaxLength`
      );

      const attributes: DataverseAttribute[] = attributesResponse.data.value.map((attr: any) => ({
        logicalName: attr.LogicalName,
        displayName: attr.DisplayName?.UserLocalizedLabel?.Label || attr.LogicalName,
        type: this.mapAttributeType(attr.AttributeType),
        isPrimaryId: attr.IsPrimaryId || false,
        isPrimaryName: attr.IsPrimaryName || false,
        isRequired: attr.RequiredLevel?.Value === 'ApplicationRequired' || attr.RequiredLevel?.Value === 'SystemRequired',
        maxLength: attr.MaxLength,
      }));

      // Fetch relationships
      const relationships = await this.fetchRelationships(tableId, entity.LogicalName);

      return {
        logicalName: entity.LogicalName,
        displayName: entity.DisplayName?.UserLocalizedLabel?.Label || entity.LogicalName,
        schemaName: entity.SchemaName,
        primaryIdAttribute: entity.PrimaryIdAttribute,
        primaryNameAttribute: entity.PrimaryNameAttribute,
        tableType: entity.TableType,
        attributes: attributes,
        relationships: relationships,
      };
    } catch (error) {
      console.warn(`Failed to fetch table metadata for ${tableId}:`, error);
      return null;
    }
  }

  /**
   * Fetch relationships for a table
   */
  private async fetchRelationships(tableId: string, logicalName: string): Promise<DataverseRelationship[]> {
    const relationships: DataverseRelationship[] = [];

    try {
      // Fetch One-to-Many relationships
      const oneToManyResponse = await this.axiosInstance.get(
        `/EntityDefinitions(${tableId})/OneToManyRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`
      );

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
      const manyToOneResponse = await this.axiosInstance.get(
        `/EntityDefinitions(${tableId})/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`
      );

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
      const manyToManyResponse = await this.axiosInstance.get(
        `/EntityDefinitions(${tableId})/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName`
      );

      for (const rel of manyToManyResponse.data.value) {
        const isEntity1 = rel.Entity1LogicalName === logicalName;
        relationships.push({
          schemaName: rel.SchemaName,
          type: 'ManyToMany',
          relatedTable: isEntity1 ? rel.Entity2LogicalName : rel.Entity1LogicalName,
          intersectTable: rel.IntersectEntityName,
        });
      }
    } catch (error) {
      console.warn(`Failed to fetch relationships for ${logicalName}:`, error);
    }

    return relationships;
  }

  /**
   * Map Dataverse attribute types to simplified types
   */
  private mapAttributeType(attributeType: string): string {
    const typeMap: { [key: string]: string } = {
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
  async listSolutions(): Promise<Array<{ uniqueName: string; displayName: string; version: string }>> {
    try {
      const response = await this.axiosInstance.get(
        `/solutions?$select=uniquename,friendlyname,version&$filter=isvisible eq true&$orderby=friendlyname asc`
      );

      return response.data.value.map((s: any) => ({
        uniqueName: s.uniquename,
        displayName: s.friendlyname,
        version: s.version,
      }));
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Dataverse API error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }
}
