/**
 * Represents a Dataverse table (entity) in the solution
 */
export interface DataverseTable {
    /** Logical name of the table */
    logicalName: string;
    /** Display name of the table */
    displayName: string;
    /** Schema name of the table */
    schemaName: string;
    /** Primary ID attribute name */
    primaryIdAttribute: string;
    /** Primary name attribute */
    primaryNameAttribute: string;
    /** Table type (Standard, Activity, Virtual, etc.) */
    tableType: string;
    /** Attributes (columns) in the table */
    attributes: DataverseAttribute[];
    /** Relationships from this table */
    relationships: DataverseRelationship[];
}
/**
 * Represents an attribute (column) in a Dataverse table
 */
export interface DataverseAttribute {
    /** Logical name of the attribute */
    logicalName: string;
    /** Display name of the attribute */
    displayName: string;
    /** Data type of the attribute */
    type: string;
    /** Whether this is a primary key */
    isPrimaryId: boolean;
    /** Whether this is the primary name field */
    isPrimaryName: boolean;
    /** Whether this field is required */
    isRequired: boolean;
}
/**
 * Represents a relationship between Dataverse tables
 */
export interface DataverseRelationship {
    /** Schema name of the relationship */
    schemaName: string;
    /** Type of relationship (OneToMany, ManyToOne, ManyToMany) */
    type: 'OneToMany' | 'ManyToOne' | 'ManyToMany';
    /** Related table logical name */
    relatedTable: string;
    /** Lookup attribute name (for OneToMany/ManyToOne) */
    lookupAttribute?: string;
    /** Intersect table name (for ManyToMany) */
    intersectTable?: string;
}
/**
 * Represents a Dataverse solution
 */
export interface DataverseSolution {
    /** Unique name of the solution */
    uniqueName: string;
    /** Display name of the solution */
    displayName: string;
    /** Version of the solution */
    version: string;
    /** Publisher prefix */
    publisherPrefix: string;
    /** Tables included in the solution */
    tables: DataverseTable[];
}
/**
 * Configuration for ERD generation
 */
export interface ERDConfig {
    /** Format of the output (mermaid, plantuml, graphviz) */
    format: 'mermaid' | 'plantuml' | 'graphviz';
    /** Whether to include attributes in the diagram */
    includeAttributes: boolean;
    /** Whether to include relationships */
    includeRelationships: boolean;
    /** Maximum number of attributes to show per table (0 = all) */
    maxAttributesPerTable: number;
}
//# sourceMappingURL=types.d.ts.map