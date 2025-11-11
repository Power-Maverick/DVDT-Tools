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
      case 'drawio':
        return this.generateDrawio(solution);
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
   * Generate ERD in draw.io (diagrams.net) XML format
   */
  private generateDrawio(solution: DataverseSolution): string {
    const lines: string[] = [];
    const tablesInSolution = new Set(solution.tables.map(t => t.logicalName));
    
    // Start XML structure
    lines.push('<mxfile host="app.diagrams.net" modified="2024-01-01T00:00:00.000Z" agent="Dataverse ERD Generator" version="24.0.0" type="device">');
    lines.push(`  <diagram name="${this.escapeXml(solution.displayName)}" id="erd-diagram">`);
    lines.push('    <mxGraphModel dx="1422" dy="794" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">');
    lines.push('      <root>');
    lines.push('        <mxCell id="0"/>');
    lines.push('        <mxCell id="1" parent="0"/>');

    // Position tables in a grid layout
    const COLUMN_WIDTH = 220;
    const ROW_HEIGHT = 250;
    const COLUMNS = 4;
    let currentX = 40;
    let currentY = 40;
    let column = 0;

    // Generate entity cells with IDs
    let cellId = 2;
    const entityIdMap = new Map<string, number>();

    for (const table of solution.tables) {
      const entityId = cellId++;
      entityIdMap.set(table.logicalName, entityId);

      // Calculate table height based on attributes
      const attributeCount = this.config.includeAttributes 
        ? Math.min(
            table.attributes.length,
            this.config.maxAttributesPerTable > 0 ? this.config.maxAttributesPerTable : table.attributes.length
          )
        : 0;
      const height = 30 + (attributeCount * 26) + (attributeCount > 0 ? 10 : 0);

      // Build HTML table for entity with attributes
      let htmlContent = `<div style="font-size: 14px; font-weight: bold; text-align: center; padding: 5px; background-color: #e1f5ff; border-bottom: 2px solid #0e639c;">${this.escapeXml(table.displayName)}</div>`;
      
      if (this.config.includeAttributes && table.attributes.length > 0) {
        const attributes = this.config.maxAttributesPerTable > 0
          ? table.attributes.slice(0, this.config.maxAttributesPerTable)
          : table.attributes;

        htmlContent += '<table style="width: 100%; font-size: 11px; border-collapse: collapse;">';
        for (const attr of attributes) {
          const icon = attr.isPrimaryId ? '🔑 ' : '';
          const style = attr.isPrimaryId ? 'font-weight: bold;' : '';
          htmlContent += `<tr><td style="${style} padding: 3px 5px; border-bottom: 1px solid #ddd;">${icon}${this.escapeXml(attr.logicalName)}</td><td style="padding: 3px 5px; border-bottom: 1px solid #ddd; color: #666;">${this.escapeXml(attr.type)}</td></tr>`;
        }
        
        if (this.config.maxAttributesPerTable > 0 && table.attributes.length > this.config.maxAttributesPerTable) {
          const remaining = table.attributes.length - this.config.maxAttributesPerTable;
          htmlContent += `<tr><td colspan="2" style="padding: 3px 5px; font-style: italic; color: #888;">...${remaining} more attributes</td></tr>`;
        }
        htmlContent += '</table>';
      }

      // Create entity cell
      lines.push(`        <mxCell id="${entityId}" value="${this.escapeXml(htmlContent)}" style="shape=swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=30;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#0e639c;" vertex="1" parent="1">`);
      lines.push(`          <mxGeometry x="${currentX}" y="${currentY}" width="200" height="${height}" as="geometry"/>`);
      lines.push('        </mxCell>');

      // Update position for next table
      column++;
      if (column >= COLUMNS) {
        column = 0;
        currentX = 40;
        currentY += ROW_HEIGHT;
      } else {
        currentX += COLUMN_WIDTH;
      }
    }

    // Add relationships as edges
    if (this.config.includeRelationships) {
      for (const table of solution.tables) {
        const sourceId = entityIdMap.get(table.logicalName);
        if (!sourceId) continue;

        for (const rel of table.relationships) {
          if (!tablesInSolution.has(rel.relatedTable)) continue;
          
          const targetId = entityIdMap.get(rel.relatedTable);
          if (!targetId) continue;

          const edgeId = cellId++;
          
          // Determine edge style based on relationship type
          let edgeStyle = 'edgeStyle=entityRelationEdgeStyle;fontSize=12;html=1;endArrow=';
          let endArrow = 'ERmany';
          
          switch (rel.type) {
            case 'OneToMany':
              endArrow = 'ERmany';
              edgeStyle += endArrow + ';startArrow=ERone;';
              break;
            case 'ManyToOne':
              endArrow = 'ERone';
              edgeStyle += endArrow + ';startArrow=ERmany;';
              break;
            case 'ManyToMany':
              endArrow = 'ERmany';
              edgeStyle += endArrow + ';startArrow=ERmany;';
              break;
            default:
              endArrow = 'ERone';
              edgeStyle += endArrow + ';startArrow=ERone;';
          }

          lines.push(`        <mxCell id="${edgeId}" value="${this.escapeXml(rel.schemaName)}" style="${edgeStyle}" edge="1" parent="1" source="${sourceId}" target="${targetId}">`);
          lines.push('          <mxGeometry width="100" height="100" relative="1" as="geometry">');
          lines.push('            <mxPoint as="sourcePoint"/>');
          lines.push('            <mxPoint as="targetPoint"/>');
          lines.push('          </mxGeometry>');
          lines.push('        </mxCell>');
        }
      }
    }

    // Close XML structure
    lines.push('      </root>');
    lines.push('    </mxGraphModel>');
    lines.push('  </diagram>');
    lines.push('</mxfile>');

    return lines.join('\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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
