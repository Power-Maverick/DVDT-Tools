import axios, { AxiosInstance } from 'axios';
import { ERDEditorModel, ModelDiff, PublishSummary } from '../models/editor';
import { DataverseAttribute, DataverseRelationship, DataverseSolution, DataverseTable } from '../models/interfaces';
import { Helper } from './Helper';

export interface DataverseConfig {
  environmentUrl: string;
  accessToken?: string;
  apiVersion?: string;
}

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
        Authorization: config.accessToken ? ['Bearer', config.accessToken].join(' ') : '',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    });
  }

  async fetchSolution(solutionUniqueName: string): Promise<DataverseSolution> {
    try {
      const helper = new Helper(this.axiosInstance);

      const responseSolution = await helper.getOData(
        `solutions?$filter=uniquename eq '${solutionUniqueName}'&$select=solutionid,friendlyname,uniquename,_publisherid_value,version&$expand=publisherid($select=customizationprefix)`,
        this.isPPTB,
      );

      if (!responseSolution || responseSolution.length === 0) {
        throw new Error(`Solution '${solutionUniqueName}' not found`);
      }

      const solutionData = responseSolution[0];
      const publisherPrefix = solutionData.publisherid?.customizationprefix ?? 'new';

      const responseComponent = await helper.getOData(
        `solutioncomponents?$filter=_solutionid_value eq ${solutionData.solutionid} and componenttype eq 1&$select=objectid`,
        this.isPPTB,
      );

      const tableIds = responseComponent.map((c: any) => c.objectid);
      const tables = await this.fetchTables(tableIds);

      return {
        uniqueName: solutionData.uniquename,
        displayName: solutionData.friendlyname,
        version: solutionData.version,
        publisherPrefix,
        tables,
      };
    } catch (error: any) {
      if (error.response) {
        throw new Error(`Dataverse API error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`);
      }
      throw error;
    }
  }

  private async fetchTables(tableIds: string[]): Promise<DataverseTable[]> {
    if (tableIds.length === 0) return [];

    const tableFetchPromises = tableIds.map((tableId) =>
      this.fetchTable(tableId).catch((error) => {
        console.warn(`Failed to fetch table ${tableId}:`, error);
        return null;
      }),
    );

    const results = await Promise.all(tableFetchPromises);
    return results.filter((table: DataverseTable | null): table is DataverseTable => table !== null);
  }

  private async fetchTable(tableId: string): Promise<DataverseTable | null> {
    try {
      const helper = new Helper(this.axiosInstance);

      const entity = await window.dataverseAPI.getEntityMetadata(tableId, false, [
        'LogicalName',
        'DisplayName',
        'SchemaName',
        'PrimaryIdAttribute',
        'PrimaryNameAttribute',
        'TableType',
        'IsIntersect',
      ]);

      const [responseAttributes, responseOneToMany, responseManyToOne, responseManyToMany] = await Promise.all([
        helper.getOData(`EntityDefinitions(${tableId})/Attributes?$select=LogicalName,DisplayName,AttributeType,IsPrimaryId,IsPrimaryName,RequiredLevel`, this.isPPTB),
        helper.getOData(`EntityDefinitions(${tableId})/OneToManyRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`, this.isPPTB),
        helper.getOData(`EntityDefinitions(${tableId})/ManyToOneRelationships?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute`, this.isPPTB),
        helper.getOData(`EntityDefinitions(${tableId})/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,IntersectEntityName`, this.isPPTB),
      ]);

      const attributes: DataverseAttribute[] = responseAttributes.map((attr: any) => ({
        logicalName: attr.LogicalName,
        displayName: attr.DisplayName?.UserLocalizedLabel?.Label || attr.LogicalName,
        type: this.mapAttributeType(attr.AttributeType),
        isPrimaryId: attr.IsPrimaryId || false,
        isPrimaryName: attr.IsPrimaryName || false,
        isRequired: attr.RequiredLevel?.Value === 'ApplicationRequired' || attr.RequiredLevel?.Value === 'SystemRequired',
      }));

      const relationships = this.processRelationships(entity.LogicalName, responseOneToMany, responseManyToOne, responseManyToMany);

      return {
        logicalName: entity.LogicalName,
        displayName: entity.LogicalName,
        schemaName: entity.SchemaName as string,
        primaryIdAttribute: entity.PrimaryIdAttribute as string,
        primaryNameAttribute: entity.PrimaryNameAttribute as string,
        isIntersect: (entity.IsIntersect as boolean) || false,
        tableType: entity.TableType as string,
        attributes,
        relationships,
      };
    } catch (error) {
      console.warn(`Failed to fetch table metadata for ${tableId}:`, error);
      return null;
    }
  }

  private processRelationships(
    logicalName: string,
    responseOneToMany: any[],
    responseManyToOne: any[],
    responseManyToMany: any[],
  ): DataverseRelationship[] {
    const relationships: DataverseRelationship[] = [];

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

    for (const rel of responseManyToMany) {
      const isEntity1 = rel.Entity1LogicalName === logicalName;
      relationships.push({
        schemaName: rel.SchemaName,
        type: 'ManyToMany',
        relatedTable: isEntity1 ? rel.Entity2LogicalName : rel.Entity1LogicalName,
        intersectTable: rel.IntersectEntityName,
      });
    }

    return relationships;
  }

  private mapAttributeType(attributeType: string): string {
    const typeMap: Record<string, string> = {
      String: 'string',
      Memo: 'string',
      Integer: 'int',
      BigInt: 'int',
      Decimal: 'decimal',
      Double: 'decimal',
      Money: 'money',
      DateTime: 'datetime',
      Boolean: 'boolean',
      Lookup: 'lookup',
      Customer: 'lookup',
      Owner: 'lookup',
      Picklist: 'picklist',
      State: 'picklist',
      Status: 'picklist',
      Uniqueidentifier: 'guid',
    };

    return typeMap[attributeType] || 'string';
  }

  async listSolutions(): Promise<Array<{ uniqueName: string; displayName: string; version: string }>> {
    try {
      const helper = new Helper(this.axiosInstance);
      const solutions = await helper.getOData(
        `solutions?$select=uniquename,friendlyname,version&$filter=isvisible eq true&$orderby=friendlyname asc`,
        this.isPPTB,
      );

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
  }

  async publishModelChanges(_baseline: ERDEditorModel, working: ERDEditorModel, diff: ModelDiff): Promise<PublishSummary> {
    const helper = new Helper(this.axiosInstance);
    const results: PublishSummary['results'] = [];
    const tableById = new Map(working.tables.map((table) => [table.id, table]));

    const label = (name: string): Record<string, unknown> => ({
      LocalizedLabels: [{ Label: name, LanguageCode: 1033 }],
    });

    const executeStep = async (name: string, fn: () => Promise<void>) => {
      try {
        await fn();
        results.push({ name, success: true, message: 'Success' });
      } catch (error: any) {
        results.push({
          name,
          success: false,
          message: error?.response?.data?.error?.message || error?.message || 'Unknown error',
        });
      }
    };

    for (const tableId of diff.newTableIds) {
      await executeStep(`Create table ${tableId}`, async () => {
        const table = tableById.get(tableId);
        if (!table) return;

        await helper.postOData(
          'EntityDefinitions',
          {
            '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
            SchemaName: table.schemaName,
            DisplayName: label(table.displayName),
            DisplayCollectionName: label(`${table.displayName}s`),
            Description: label(`Created by ERD Generator for ${table.displayName}`),
            OwnershipType: 'UserOwned',
            IsActivity: false,
          },
          this.isPPTB,
        );
      });
    }

    for (const tableId of diff.renamedTableIds) {
      await executeStep(`Rename table ${tableId}`, async () => {
        const table = tableById.get(tableId);
        if (!table) return;

        await helper.patchOData(`EntityDefinitions(LogicalName='${table.logicalName}')`, { DisplayName: label(table.displayName) }, this.isPPTB);
      });
    }

    for (const table of working.tables) {
      for (const attribute of table.attributes.filter((attr) => diff.newAttributeIds.has(attr.id))) {
        await executeStep(`Add attribute ${table.logicalName}.${attribute.logicalName}`, async () => {
          const payload = this.buildAttributePayload(attribute.logicalName, attribute.displayName, attribute.type, attribute.isRequired);
          await helper.postOData(`EntityDefinitions(LogicalName='${table.logicalName}')/Attributes`, payload, this.isPPTB);
        });
      }

      for (const attribute of table.attributes.filter((attr) => diff.renamedAttributeIds.has(attr.id))) {
        await executeStep(`Rename attribute ${table.logicalName}.${attribute.logicalName}`, async () => {
          await helper.patchOData(
            `EntityDefinitions(LogicalName='${table.logicalName}')/Attributes(LogicalName='${attribute.logicalName}')`,
            { DisplayName: label(attribute.displayName) },
            this.isPPTB,
          );
        });
      }
    }

    for (const relationship of working.relationships.filter((rel) => diff.newRelationshipIds.has(rel.id))) {
      await executeStep(`Create relationship ${relationship.schemaName}`, async () => {
        const fromTable = tableById.get(relationship.fromTableId);
        const toTable = tableById.get(relationship.toTableId);
        if (!fromTable || !toTable) return;

        const lookupName = relationship.lookupAttribute || `${toTable.logicalName}id`;
        await helper.postOData(
          'RelationshipDefinitions',
          {
            '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
            SchemaName: relationship.schemaName,
            ReferencedEntity: toTable.logicalName,
            ReferencingEntity: fromTable.logicalName,
            ReferencingAttribute: lookupName,
            Lookup: {
              '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
              SchemaName: lookupName,
              DisplayName: label(lookupName),
              RequiredLevel: { Value: 'None' },
            },
          },
          this.isPPTB,
        );
      });
    }

    await executeStep('Publish customizations', async () => {
      if (this.isPPTB && typeof (window.dataverseAPI as any).publishCustomizations === 'function') {
        await (window.dataverseAPI as any).publishCustomizations();
        return;
      }
      await helper.postOData('PublishAllXml', {}, this.isPPTB);
    });

    return {
      success: results.every((item) => item.success),
      results,
    };
  }

  private buildAttributePayload(logicalName: string, displayName: string, type: string, isRequired: boolean): Record<string, unknown> {
    const base = {
      SchemaName: logicalName,
      DisplayName: {
        LocalizedLabels: [{ Label: displayName, LanguageCode: 1033 }],
      },
      RequiredLevel: {
        Value: isRequired ? 'ApplicationRequired' : 'None',
      },
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
              Label: { LocalizedLabels: [{ Label: 'Yes', LanguageCode: 1033 }] },
            },
            FalseOption: {
              Value: 0,
              Label: { LocalizedLabels: [{ Label: 'No', LanguageCode: 1033 }] },
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
