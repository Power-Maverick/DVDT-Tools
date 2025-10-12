import { DataverseRelationship, DataverseSolution, ERDConfig } from '../models/interfaces';

/**
 * ERD Generator for Dataverse solutions
 * Generates Entity Relationship Diagrams in various formats
 */
export class ERDGenerator {
  private config: ERDConfig;

  constructor(config: Partial<ERDConfig> = {}) {
    this.config = {
      format: config.format || 'mermaid',
      includeAttributes: config.includeAttributes !== undefined ? config.includeAttributes : true,
      includeRelationships: config.includeRelationships !== undefined ? config.includeRelationships : true,
      maxAttributesPerTable: config.maxAttributesPerTable || 10,
    };
  }

  /**
   * Generate ERD from a Dataverse solution
   * @param solution The Dataverse solution to generate ERD from
   * @returns The generated ERD in the configured format
   */
  public generate(solution: DataverseSolution): string {
    switch (this.config.format) {
      case 'mermaid':
        return this.generateMermaid(solution);
      case 'plantuml':
        return this.generatePlantUML(solution);
      case 'graphviz':
        return this.generateGraphviz(solution);
      default:
        throw new Error(`Unsupported format: ${this.config.format}`);
    }
  }

  /**
   * Generate ERD in Mermaid format
   */
  private generateMermaid(solution: DataverseSolution): string {
    const lines: string[] = [];
    lines.push('erDiagram');

    // Create a set of table names in the solution for quick lookup
    const tablesInSolution = new Set(solution.tables.map(t => t.logicalName));

    // Add tables
    for (const table of solution.tables) {
      const tableName = this.sanitizeTableName(table.logicalName);
      
      if (this.config.includeAttributes && table.attributes.length > 0) {
        lines.push(`    ${tableName} {`);
        const attributes = this.config.maxAttributesPerTable > 0
          ? table.attributes.slice(0, this.config.maxAttributesPerTable)
          : table.attributes;

        for (const attr of attributes) {
          const type = this.mapToMermaidType(attr.type);
          const attrName = this.sanitizeTableName(attr.logicalName);
          const constraints = [];
          if (attr.isPrimaryId && !table.isIntersect) constraints.push('PK');
          if (attr.isRequired && !attr.isPrimaryId) constraints.push('NOT_NULL');
          const constraintStr = constraints.length > 0 ? ` ${constraints.join('_')}` : '';
          lines.push(`        ${type} ${attrName}${constraintStr}`);
        }

        if (this.config.maxAttributesPerTable > 0 && table.attributes.length > this.config.maxAttributesPerTable) {
          const remaining = table.attributes.length - this.config.maxAttributesPerTable;
          lines.push(`        string more_attributes "plus ${remaining} more"`);
        }
        
        lines.push(`    }`);
      } else if (!this.config.includeAttributes) {
        // Just declare the entity without attributes
        lines.push(`    ${tableName} {}`);
      }
    }

    // Add relationships - only include relationships where both tables are in the solution
    if (this.config.includeRelationships) {
      for (const table of solution.tables) {
        for (const rel of table.relationships) {
          // Only include relationship if the related table is also in this solution
          if (tablesInSolution.has(rel.relatedTable)) {
            const relationship = this.mapMermaidRelationship(rel);
            lines.push(`    ${this.sanitizeTableName(table.logicalName)} ${relationship} ${this.sanitizeTableName(rel.relatedTable)} : "${rel.schemaName}"`);
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate ERD in PlantUML format
   */
  private generatePlantUML(solution: DataverseSolution): string {
    const lines: string[] = [];
    lines.push('@startuml');
    lines.push(`title ${solution.displayName} - Entity Relationship Diagram`);
    lines.push('');

    // Create a set of table names in the solution for quick lookup
    const tablesInSolution = new Set(solution.tables.map(t => t.logicalName));

    // Add tables
    for (const table of solution.tables) {
      lines.push(`entity "${table.displayName}" as ${this.sanitizeTableName(table.logicalName)} {`);
      
      if (this.config.includeAttributes) {
        const attributes = this.config.maxAttributesPerTable > 0
          ? table.attributes.slice(0, this.config.maxAttributesPerTable)
          : table.attributes;

        for (const attr of attributes) {
          const pk = attr.isPrimaryId ? '* ' : '  ';
          const required = attr.isRequired ? '{required}' : '';
          lines.push(`  ${pk}${attr.logicalName}: ${attr.type} ${required}`.trim());
        }

        if (this.config.maxAttributesPerTable > 0 && table.attributes.length > this.config.maxAttributesPerTable) {
          lines.push(`  .. ${table.attributes.length - this.config.maxAttributesPerTable} more attributes ..`);
        }
      }
      
      lines.push('}');
      lines.push('');
    }

    // Add relationships - only include relationships where both tables are in the solution
    if (this.config.includeRelationships) {
      for (const table of solution.tables) {
        for (const rel of table.relationships) {
          // Only include relationship if the related table is also in this solution
          if (tablesInSolution.has(rel.relatedTable)) {
            const relationship = this.mapPlantUMLRelationship(rel);
            lines.push(`${this.sanitizeTableName(table.logicalName)} ${relationship} ${this.sanitizeTableName(rel.relatedTable)}`);
          }
        }
      }
    }

    lines.push('');
    lines.push('@enduml');
    return lines.join('\n');
  }

  /**
   * Generate ERD in Graphviz DOT format
   */
  private generateGraphviz(solution: DataverseSolution): string {
    const lines: string[] = [];
    lines.push('digraph ERD {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=record];');
    lines.push('');

    // Create a set of table names in the solution for quick lookup
    const tablesInSolution = new Set(solution.tables.map(t => t.logicalName));

    // Add tables
    for (const table of solution.tables) {
      const attributes = this.config.includeAttributes
        ? (this.config.maxAttributesPerTable > 0
          ? table.attributes.slice(0, this.config.maxAttributesPerTable)
          : table.attributes)
        : [];

      let label = `${table.displayName}`;
      if (this.config.includeAttributes && attributes.length > 0) {
        const attrStrings = attributes.map(attr => {
          const pk = attr.isPrimaryId ? '🔑 ' : '';
          return `${pk}${attr.logicalName}: ${attr.type}`;
        });
        
        if (this.config.maxAttributesPerTable > 0 && table.attributes.length > this.config.maxAttributesPerTable) {
          attrStrings.push(`... ${table.attributes.length - this.config.maxAttributesPerTable} more`);
        }
        
        label = `{${table.displayName}|${attrStrings.join('\\l')}\\l}`;
      }

      lines.push(`  ${this.sanitizeTableName(table.logicalName)} [label="${label}"];`);
    }

    lines.push('');

    // Add relationships - only include relationships where both tables are in the solution
    if (this.config.includeRelationships) {
      for (const table of solution.tables) {
        for (const rel of table.relationships) {
          // Only include relationship if the related table is also in this solution
          if (tablesInSolution.has(rel.relatedTable)) {
            const style = rel.type === 'ManyToMany' ? 'dir=both' : 'dir=forward';
            lines.push(`  ${this.sanitizeTableName(table.logicalName)} -> ${this.sanitizeTableName(rel.relatedTable)} [label="${rel.schemaName}", ${style}];`);
          }
        }
      }
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Sanitize table names for diagram formats
   */
  private sanitizeTableName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Map Dataverse types to Mermaid types
   */
  private mapToMermaidType(type: string): string {
    const typeMap: { [key: string]: string } = {
      'string': 'string',
      'int': 'int',
      'decimal': 'decimal',
      'datetime': 'datetime',
      'boolean': 'boolean',
      'lookup': 'guid',
      'picklist': 'int',
      'money': 'decimal',
    };
    return typeMap[type.toLowerCase()] || 'string';
  }

  /**
   * Map relationship to Mermaid cardinality notation
   */
  private mapMermaidRelationship(rel: DataverseRelationship): string {
    switch (rel.type) {
      case 'OneToMany':
        return '||--o{';
      case 'ManyToOne':
        return '}o--||';
      case 'ManyToMany':
        return '}o--o{';
      default:
        return '||--||';
    }
  }

  /**
   * Map relationship to PlantUML notation
   */
  private mapPlantUMLRelationship(rel: DataverseRelationship): string {
    switch (rel.type) {
      case 'OneToMany':
        return '||--o{';
      case 'ManyToOne':
        return '}o--||';
      case 'ManyToMany':
        return '}o--o{';
      default:
        return '||--||';
    }
  }
}
