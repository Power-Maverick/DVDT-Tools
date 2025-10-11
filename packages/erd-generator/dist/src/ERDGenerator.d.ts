import { DataverseSolution, ERDConfig } from './types';
/**
 * ERD Generator for Dataverse solutions
 * Generates Entity Relationship Diagrams in various formats
 */
export declare class ERDGenerator {
    private config;
    constructor(config?: Partial<ERDConfig>);
    /**
     * Generate ERD from a Dataverse solution
     * @param solution The Dataverse solution to generate ERD from
     * @returns The generated ERD in the configured format
     */
    generate(solution: DataverseSolution): string;
    /**
     * Generate ERD in Mermaid format
     */
    private generateMermaid;
    /**
     * Generate ERD in PlantUML format
     */
    private generatePlantUML;
    /**
     * Generate ERD in Graphviz DOT format
     */
    private generateGraphviz;
    /**
     * Sanitize table names for diagram formats
     */
    private sanitizeTableName;
    /**
     * Map Dataverse types to Mermaid types
     */
    private mapToMermaidType;
    /**
     * Map relationship to Mermaid cardinality notation
     */
    private mapMermaidRelationship;
    /**
     * Map relationship to PlantUML notation
     */
    private mapPlantUMLRelationship;
}
//# sourceMappingURL=ERDGenerator.d.ts.map