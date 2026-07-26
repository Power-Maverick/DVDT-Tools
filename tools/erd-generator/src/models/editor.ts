import { DataverseSolution, DataverseTable } from './interfaces';

export type RelationshipType = 'OneToMany' | 'ManyToOne' | 'ManyToMany';

export interface ERDEditorAttribute {
  id: string;
  logicalName: string;
  displayName: string;
  type: string;
  isPrimaryId: boolean;
  isPrimaryName: boolean;
  isRequired: boolean;
  sourceAttributeId?: string;
}

export interface ERDEditorTable {
  id: string;
  logicalName: string;
  displayName: string;
  schemaName: string;
  primaryIdAttribute: string;
  primaryNameAttribute: string;
  tableType: string;
  isIntersect: boolean;
  sourceTableId?: string;
  attributes: ERDEditorAttribute[];
}

export interface ERDEditorRelationship {
  id: string;
  schemaName: string;
  type: RelationshipType;
  fromTableId: string;
  toTableId: string;
  lookupAttribute?: string;
  intersectTable?: string;
  sourceRelationshipId?: string;
}

export interface ERDEditorModel {
  solutionUniqueName: string;
  solutionDisplayName: string;
  solutionVersion: string;
  publisherPrefix: string;
  tables: ERDEditorTable[];
  relationships: ERDEditorRelationship[];
}

export interface ModelDiff {
  newTableIds: Set<string>;
  renamedTableIds: Set<string>;
  newAttributeIds: Set<string>;
  renamedAttributeIds: Set<string>;
  newRelationshipIds: Set<string>;
}

export interface PublishOperationResult {
  name: string;
  success: boolean;
  message: string;
}

export interface PublishSummary {
  success: boolean;
  results: PublishOperationResult[];
}

export const makeId = (prefix: string): string => `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;

export const toEditorModel = (solution: DataverseSolution): ERDEditorModel => {
  const tables = solution.tables.map((table) => ({
    id: table.logicalName,
    logicalName: table.logicalName,
    displayName: table.displayName,
    schemaName: table.schemaName,
    primaryIdAttribute: table.primaryIdAttribute,
    primaryNameAttribute: table.primaryNameAttribute,
    tableType: table.tableType,
    isIntersect: table.isIntersect,
    sourceTableId: table.logicalName,
    attributes: table.attributes.map((attribute) => ({
      id: `${table.logicalName}.${attribute.logicalName}`,
      logicalName: attribute.logicalName,
      displayName: attribute.displayName,
      type: attribute.type,
      isPrimaryId: attribute.isPrimaryId,
      isPrimaryName: attribute.isPrimaryName,
      isRequired: attribute.isRequired,
      sourceAttributeId: `${table.logicalName}.${attribute.logicalName}`,
    })),
  }));

  const tableIdByLogical = new Map<string, string>(tables.map((table) => [table.logicalName, table.id]));
  const relationships: ERDEditorRelationship[] = [];
  const seen = new Set<string>();

  for (const table of solution.tables) {
    const fromTableId = tableIdByLogical.get(table.logicalName);
    if (!fromTableId) continue;

    for (const relationship of table.relationships) {
      const toTableId = tableIdByLogical.get(relationship.relatedTable);
      if (!toTableId) continue;

      const canonical = [table.logicalName, relationship.schemaName, relationship.type, relationship.relatedTable].join('|');
      if (seen.has(canonical)) continue;
      seen.add(canonical);

      relationships.push({
        id: `${table.logicalName}->${relationship.relatedTable}:${relationship.schemaName}`,
        schemaName: relationship.schemaName,
        type: relationship.type,
        fromTableId,
        toTableId,
        lookupAttribute: relationship.lookupAttribute,
        intersectTable: relationship.intersectTable,
        sourceRelationshipId: `${table.logicalName}->${relationship.relatedTable}:${relationship.schemaName}`,
      });
    }
  }

  return {
    solutionUniqueName: solution.uniqueName,
    solutionDisplayName: solution.displayName,
    solutionVersion: solution.version,
    publisherPrefix: solution.publisherPrefix,
    tables,
    relationships,
  };
};

export const toDataverseSolution = (model: ERDEditorModel): DataverseSolution => {
  const tableById = new Map<string, ERDEditorTable>(model.tables.map((table) => [table.id, table]));
  const outgoingByTableId = new Map<string, ERDEditorRelationship[]>();

  for (const relationship of model.relationships) {
    if (!outgoingByTableId.has(relationship.fromTableId)) {
      outgoingByTableId.set(relationship.fromTableId, []);
    }
    outgoingByTableId.get(relationship.fromTableId)!.push(relationship);
  }

  const tables: DataverseTable[] = model.tables.map((table) => ({
    logicalName: table.logicalName,
    displayName: table.displayName,
    schemaName: table.schemaName,
    primaryIdAttribute: table.primaryIdAttribute,
    primaryNameAttribute: table.primaryNameAttribute,
    tableType: table.tableType,
    isIntersect: table.isIntersect,
    attributes: table.attributes.map((attribute) => ({
      logicalName: attribute.logicalName,
      displayName: attribute.displayName,
      type: attribute.type,
      isPrimaryId: attribute.isPrimaryId,
      isPrimaryName: attribute.isPrimaryName,
      isRequired: attribute.isRequired,
    })),
    relationships: (outgoingByTableId.get(table.id) || [])
      .map((relationship) => {
        const target = tableById.get(relationship.toTableId);
        if (!target) return null;
        return {
          schemaName: relationship.schemaName,
          type: relationship.type,
          relatedTable: target.logicalName,
          lookupAttribute: relationship.lookupAttribute,
          intersectTable: relationship.intersectTable,
        };
      })
      .filter((relationship): relationship is NonNullable<typeof relationship> => relationship !== null),
  }));

  return {
    uniqueName: model.solutionUniqueName,
    displayName: model.solutionDisplayName,
    version: model.solutionVersion,
    publisherPrefix: model.publisherPrefix,
    tables,
  };
};

export const cloneModel = (model: ERDEditorModel): ERDEditorModel => ({
  ...model,
  tables: model.tables.map((table) => ({
    ...table,
    attributes: table.attributes.map((attribute) => ({ ...attribute })),
  })),
  relationships: model.relationships.map((relationship) => ({ ...relationship })),
});

export const diffModel = (baseline: ERDEditorModel, working: ERDEditorModel): ModelDiff => {
  const baselineTableBySource = new Map(baseline.tables.map((table) => [table.sourceTableId || table.id, table]));
  const renamedTableIds = new Set<string>();
  const newTableIds = new Set<string>();
  const renamedAttributeIds = new Set<string>();
  const newAttributeIds = new Set<string>();
  const newRelationshipIds = new Set<string>();

  for (const table of working.tables) {
    if (!table.sourceTableId || !baselineTableBySource.has(table.sourceTableId)) {
      newTableIds.add(table.id);
      continue;
    }

    const baselineTable = baselineTableBySource.get(table.sourceTableId)!;
    if (baselineTable.displayName !== table.displayName) {
      renamedTableIds.add(table.id);
    }

    const baselineAttrBySource = new Map(baselineTable.attributes.map((attribute) => [attribute.sourceAttributeId || attribute.id, attribute]));
    for (const attribute of table.attributes) {
      if (!attribute.sourceAttributeId || !baselineAttrBySource.has(attribute.sourceAttributeId)) {
        newAttributeIds.add(attribute.id);
        continue;
      }
      const baselineAttribute = baselineAttrBySource.get(attribute.sourceAttributeId)!;
      if (baselineAttribute.displayName !== attribute.displayName) {
        renamedAttributeIds.add(attribute.id);
      }
    }
  }

  for (const relationship of working.relationships) {
    if (!relationship.sourceRelationshipId) {
      newRelationshipIds.add(relationship.id);
    }
  }

  return {
    newTableIds,
    renamedTableIds,
    newAttributeIds,
    renamedAttributeIds,
    newRelationshipIds,
  };
};

export const changedOnlyModel = (baseline: ERDEditorModel, working: ERDEditorModel): ERDEditorModel => {
  const diff = diffModel(baseline, working);
  const changedTableIds = new Set<string>([...diff.newTableIds, ...diff.renamedTableIds]);

  for (const table of working.tables) {
    if (table.attributes.some((attribute) => diff.newAttributeIds.has(attribute.id) || diff.renamedAttributeIds.has(attribute.id))) {
      changedTableIds.add(table.id);
    }
  }

  for (const relationship of working.relationships) {
    if (diff.newRelationshipIds.has(relationship.id)) {
      changedTableIds.add(relationship.fromTableId);
      changedTableIds.add(relationship.toTableId);
    }
  }

  return {
    ...working,
    tables: working.tables
      .filter((table) => changedTableIds.has(table.id))
      .map((table) => ({
        ...table,
        attributes: table.attributes.filter((attribute) =>
          diff.newAttributeIds.has(attribute.id) || diff.renamedAttributeIds.has(attribute.id) || attribute.isPrimaryId,
        ),
      })),
    relationships: working.relationships.filter(
      (relationship) =>
        diff.newRelationshipIds.has(relationship.id) ||
        (changedTableIds.has(relationship.fromTableId) && changedTableIds.has(relationship.toTableId)),
    ),
  };
};

export const totalChangeCount = (diff: ModelDiff): number =>
  diff.newTableIds.size +
  diff.renamedTableIds.size +
  diff.newAttributeIds.size +
  diff.renamedAttributeIds.size +
  diff.newRelationshipIds.size;
