import axios, { AxiosInstance } from 'axios';
import { DataverseAttribute, DataverseRelationship, DataverseSolution, DataverseTable } from '../models/interfaces';
import { ERDEditorModel, ModelDiff, PublishSummary } from '../models/editor';
import { Helper } from './Helper';

/**
 * Configuration for connecting to Dataverse
 */
export interface DataverseConfig {
  /** Dataverse environment URL (e.g., https://org.crm.dynamics.com) */
  environmentUrl: string;
  /** Access token for authentication */
  accessToken?: string;
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
  private isPPTB: boolean;

  constructor(config: DataverseConfig, isPPTB: boolean) {
    this.environmentUrl = config.environmentUrl.replace(/\/$/, '');
    this.apiVersion = config.apiVersion || '9.2';
    this.isPPTB = isPPTB;

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
      const helper = new Helper(this.axiosInstance);

      // Fetch solution details
      const responseSolution = await helper.getOData(`solutions?$filter=uniquename eq '${solutionUniqueName}'&$select=solutionid,friendlyname,uniquename,_publisherid_value,version&$expand=publisherid($select=customizationprefix)`, this.isPPTB)
      console.log("Solution Metadata",responseSolution);
      
      if (!responseSolution || responseSolution.length === 0) {
        throw new Error(`Solution '${solutionUniqueName}' not found`);
      }
      const solutionData = responseSolution[0];
      console.log("Solution Data",solutionData);

      // Publisher Prefix
      const publisherPrefix = solutionData.publisherid?.customizationprefix ?? 'unknown';

      // Fetch solution components (tables)
      const responseComponent = await helper.getOData(`solutioncomponents?$filter=_solutionid_value eq ${solutionData.solutionid} and componenttype eq 1&$select=objectid`, this.isPPTB);
      console.log("Component List",responseComponent);
      
      const tableIds = responseComponent.map((c: any) => c.objectid);
      console.log("Table IDs", tableIds);

      // Fetch tables in parallel
      const tables = await this.fetchTables(tableIds);
      console.log("Tables", tables);

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
   * Fetch multiple tables by their IDs in parallel
   */
  private async fetchTables(tableIds: string[]): Promise<DataverseTable[]> {
    if (tableIds.length === 0) {
      return [];
    }

    // Execute all table fetches in parallel
    const tableFetchPromises = tableIds.map(tableId => 
      this.fetchTable(tableId).catch(error => {
        console.warn(`Failed to fetch table ${tableId}:`, error);
        return null;
      })
    );

    const results = await Promise.all(tableFetchPromises);
    
    // Filter out null results from failed fetches
    return results.filter((table: DataverseTable | null): table is DataverseTable => table !== null);
  }

  /**
   * Fetch a single table by ID
   */
  private async fetchTable(tableId: string): Promise<DataverseTable | null> {
    try {
      const helper = new Helper(this.axiosInstance);
      
      // Fetch entity metadata
      const entity = await window.dataverseAPI.getEntityMetadata(tableId,false,["LogicalName","DisplayName","SchemaName","PrimaryIdAttribute","PrimaryNameAttribute","TableType","IsIntersect"]);
      console.log("Entity Metadata", entity);

      // Fetch attributes
      // Fetch attributes and all relationship types in parallel
      const [responseAttributes, responseOneToMany, responseManyToOne, responseManyToMany] = await Promise.all([
        helper.getOData(`EntityDefinitions(${tableId})/Attributes?$select=LogicalName,DisplayName,AttributeType,IsPrimaryId,IsPrimaryName,RequiredLevel`, this.isPPTB),
        helper.getOData(`EntityDefinitions(${tableId})/OneToManyRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`, this.isPPTB),
        helper.getOData(`EntityDefinitions(${tableId})/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`, this.isPPTB),
        helper.getOData(`EntityDefinitions(${tableId})/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName`, this.isPPTB),
      ]);

      console.log("Entity Attributes", responseAttributes);

      const attributes: DataverseAttribute[] = responseAttributes.map((attr: any) => ({
        logicalName: attr.LogicalName,
        displayName: attr.DisplayName?.UserLocalizedLabel?.Label || attr.LogicalName,
        type: this.mapAttributeType(attr.AttributeType),
        isPrimaryId: attr.IsPrimaryId || false,
        isPrimaryName: attr.IsPrimaryName || false,
        isRequired: attr.RequiredLevel?.Value === 'ApplicationRequired' || attr.RequiredLevel?.Value === 'SystemRequired',
      }));

      // Process relationships from parallel fetch results
      const relationships = this.processRelationships(
        entity.LogicalName,
        responseOneToMany,
        responseManyToOne,
        responseManyToMany
      );

      return {
        logicalName: entity.LogicalName,
        displayName: entity.LogicalName, //entity.DisplayName?.UserLocalizedLabel?.Label || entity.LogicalName,
        schemaName: entity.SchemaName as string,
        primaryIdAttribute: entity.PrimaryIdAttribute as string,
        primaryNameAttribute: entity.PrimaryNameAttribute as string,
        isIntersect: entity.IsIntersect as boolean || false,
        tableType: entity.TableType as string,
        attributes: attributes,
        relationships: relationships,
      };
    } catch (error) {
      console.warn(`Failed to fetch table metadata for ${tableId}:`, error);
      return null;
    }
  }

  /**
   * Process relationships from parallel fetch results
   */
  private processRelationships(
    logicalName: string,
    responseOneToMany: any[],
    responseManyToOne: any[],
    responseManyToMany: any[]
  ): DataverseRelationship[] {
    const relationships: DataverseRelationship[] = [];

    try {
      // Process One-to-Many relationships
      console.log("One-to-Many Relationships", responseOneToMany);
      for (const rel of responseOneToMany) {
        if (rel.ReferencedEntity === logicalName) {
          relationships.push({
            schemaName: rel.SchemaName,
            type: 'OneToMany',
            relatedTable: rel.ReferencingEntity,
            lookupAttribute: rel.ReferencingAttribute,
          });
        }
      }

      // Process Many-to-One relationships
      console.log("Many-to-One Relationships", responseManyToOne);
      for (const rel of responseManyToOne) {
        if (rel.ReferencingEntity === logicalName) {
          relationships.push({
            schemaName: rel.SchemaName,
            type: 'ManyToOne',
            relatedTable: rel.ReferencedEntity,
            lookupAttribute: rel.ReferencingAttribute,
          });
        }
      }

      // Process Many-to-Many relationships
      console.log("Many-to-Many Relationships", responseManyToMany);
      for (const rel of responseManyToMany) {
        const isEntity1 = rel.Entity1LogicalName === logicalName;
        relationships.push({
          schemaName: rel.SchemaName,
          type: 'ManyToMany',
          relatedTable: isEntity1 ? rel.Entity2LogicalName : rel.Entity1LogicalName,
          intersectTable: rel.IntersectEntityName,
        });
      }
    } catch (error) {
      console.warn(`Failed to process relationships for ${logicalName}:`, error);
    }

    return relationships;
  }

  /**
   * @deprecated Use processRelationships instead - relationships are now fetched in parallel with attributes
   * Fetch relationships for a table
   */
  private async fetchRelationships(tableId: string, logicalName: string): Promise<DataverseRelationship[]> {
    const relationships: DataverseRelationship[] = [];
    const helper = new Helper(this.axiosInstance);

    try {
      // Fetch One-to-Many relationships
      const responseOneToMany = await helper.getOData(`EntityDefinitions(${tableId})/OneToManyRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`,this.isPPTB);
      console.log("One-to-Many Relationships", responseOneToMany);
      
      for (const rel of responseOneToMany) {
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
      const responseManyToOne = await helper.getOData(`EntityDefinitions(${tableId})/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`,this.isPPTB);
      console.log("Many-to-One Relationships", responseManyToOne);
      for (const rel of responseManyToOne) {
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
      const responseManyToMany = await helper.getOData(`EntityDefinitions(${tableId})/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName`,this.isPPTB);
      console.log("Many-to-Many Relationships", responseManyToMany);
      for (const rel of responseManyToMany) {
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
      const helper = new Helper(this.axiosInstance);
      const solutions = await helper.getOData(`solutions?$select=uniquename,friendlyname,version&$filter=isvisible eq true&$orderby=friendlyname asc`,this.isPPTB);
      console.log("Solutions", solutions);
      
      return solutions.map((s: any) => ({
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

    async publishModelChanges(baseline: ERDEditorModel, working: ERDEditorModel, diff: ModelDiff): Promise<PublishSummary> {
      const helper = new Helper(this.axiosInstance);
      const results: PublishSummary['results'] = [];
      const tableById = new Map(working.tables.map((table) => [table.id, table]));

      const label = (name: string): Record<string, unknown> => ({
        LocalizedLabels: [{ Label: name, LanguageCode: 1033 }],
      });

      const createEntity = async (tableId: string) => {
        const table = tableById.get(tableId);
        if (!table) return;

        const payload: Record<string, unknown> = {
          '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
          SchemaName: table.schemaName,
          DisplayName: label(table.displayName),
          DisplayCollectionName: label(`${table.displayName}s`),
          Description: label(`Created by ERD Generator for ${table.displayName}`),
          OwnershipType: 'UserOwned',
          IsActivity: false,
        };

        await helper.postOData('EntityDefinitions', payload, this.isPPTB);
        results.push({ name: `Create table ${table.logicalName}`, success: true, message: 'Created' });
      };

      const renameEntity = async (tableId: string) => {
        const table = tableById.get(tableId);
        if (!table) return;
        await helper.patchOData(`EntityDefinitions(LogicalName='${table.logicalName}')`, { DisplayName: label(table.displayName) }, this.isPPTB);
        results.push({ name: `Rename table ${table.logicalName}`, success: true, message: 'Updated display name' });
      };

      const addAttribute = async (tableId: string) => {
        const table = tableById.get(tableId);
        if (!table) return;
        const newAttributes = table.attributes.filter((attribute) => diff.newAttributeIds.has(attribute.id));

        for (const attribute of newAttributes) {
          const payload = this.buildAttributePayload(attribute.logicalName, attribute.displayName, attribute.type, attribute.isRequired);
          await helper.postOData(`EntityDefinitions(LogicalName='${table.logicalName}')/Attributes`, payload, this.isPPTB);
          results.push({ name: `Add attribute ${table.logicalName}.${attribute.logicalName}`, success: true, message: 'Created' });
        }
      };

      const renameAttribute = async (tableId: string) => {
        const table = tableById.get(tableId);
        if (!table) return;
        const renamed = table.attributes.filter((attribute) => diff.renamedAttributeIds.has(attribute.id));

        for (const attribute of renamed) {
          await helper.patchOData(
            `EntityDefinitions(LogicalName='${table.logicalName}')/Attributes(LogicalName='${attribute.logicalName}')`,
            { DisplayName: label(attribute.displayName) },
            this.isPPTB,
          );
          results.push({ name: `Rename attribute ${table.logicalName}.${attribute.logicalName}`, success: true, message: 'Updated display name' });
        }
      };

      const addRelationships = async () => {
        for (const relationship of working.relationships.filter((rel) => diff.newRelationshipIds.has(rel.id))) {
          const fromTable = tableById.get(relationship.fromTableId);
          const toTable = tableById.get(relationship.toTableId);
          if (!fromTable || !toTable) continue;
          const lookupName = relationship.lookupAttribute || `${toTable.logicalName}id`;

          const payload = {
            '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
            SchemaName: relationship.schemaName,
            ReferencedEntity: toTable.logicalName,
            ReferencingEntity: fromTable.logicalName,
            ReferencingAttribute: lookupName,
            Lookup: {
              '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
              SchemaName: lookupName,
              DisplayName: label(lookupName),
              RequiredLevel: {
                Value: 'None',
              },
            },
          };

          await helper.postOData('RelationshipDefinitions', payload as Record<string, unknown>, this.isPPTB);
          results.push({ name: `Create relationship ${relationship.schemaName}`, success: true, message: 'Created' });
        }
      };

      const executeStep = async (fn: () => Promise<void>, fallbackName: string) => {
        try {
          await fn();
        } catch (error: any) {
          results.push({
            name: fallbackName,
            success: false,
            message: error?.response?.data?.error?.message || error?.message || 'Unknown error',
          });
        }
      };

      for (const tableId of diff.newTableIds) {
        await executeStep(() => createEntity(tableId), `Create table ${tableId}`);
      }

      for (const tableId of diff.renamedTableIds) {
        await executeStep(() => renameEntity(tableId), `Rename table ${tableId}`);
      }

      for (const tableId of new Set([...diff.newTableIds, ...diff.renamedTableIds, ...working.tables.map((table) => table.id)])) {
        await executeStep(() => addAttribute(tableId), `Add attributes for ${tableId}`);
        await executeStep(() => renameAttribute(tableId), `Rename attributes for ${tableId}`);
      }

      await executeStep(addRelationships, 'Create relationships');

      await executeStep(async () => {
        if (this.isPPTB && typeof (window.dataverseAPI as any).publishCustomizations === 'function') {
          await (window.dataverseAPI as any).publishCustomizations();
          return;
        }
        await helper.postOData('PublishAllXml', {}, this.isPPTB);
      }, 'Publish customizations');

      return {
        success: results.every((result) => result.success),
        results,
      };
    }

    private buildAttributePayload(logicalName: string, displayName: string, type: string, isRequired: boolean): Record<string, unknown> {
      const requiredLevel = {
        Value: isRequired ? 'ApplicationRequired' : 'None',
      };

      const base = {
        SchemaName: logicalName,
        DisplayName: {
          LocalizedLabels: [{ Label: displayName, LanguageCode: 1033 }],
        },
        RequiredLevel: requiredLevel,
      };

      switch (type.toLowerCase()) {
        case 'int':
        case 'integer':
          return {
            '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
            ...base,
            MinValue: -2147483648,
            MaxValue: 2147483647,
          };
        case 'decimal':
        case 'money':
          return {
            '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
            ...base,
            MinValue: -1000000000,
            MaxValue: 1000000000,
            Precision: 2,
          };
        case 'datetime':
          return {
            '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
            ...base,
            Format: 'DateAndTime',
            ImeMode: 'Auto',
          };
        case 'boolean':
          return {
            '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
            ...base,
            OptionSet: {
              TrueOption: {
                Value: 1,
                Label: {
                  LocalizedLabels: [{ Label: 'Yes', LanguageCode: 1033 }],
                },
              },
              FalseOption: {
                Value: 0,
                Label: {
                  LocalizedLabels: [{ Label: 'No', LanguageCode: 1033 }],
                },
              },
            },
          };
        default:
          return {
            '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
            ...base,
            MaxLength: 200,
            FormatName: {
              Value: 'Text',
            },
          };
      }
    }
  }
}
