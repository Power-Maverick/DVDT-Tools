import { DataverseSolution } from './types';
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
export declare class DataverseClient {
    private axiosInstance;
    private environmentUrl;
    private apiVersion;
    constructor(config: DataverseConfig);
    /**
     * Fetch solution metadata from Dataverse
     * @param solutionUniqueName Unique name of the solution
     * @returns Solution with all tables and metadata
     */
    fetchSolution(solutionUniqueName: string): Promise<DataverseSolution>;
    /**
     * Fetch multiple tables by their IDs
     */
    private fetchTables;
    /**
     * Fetch a single table by ID
     */
    private fetchTable;
    /**
     * Fetch relationships for a table
     */
    private fetchRelationships;
    /**
     * Map Dataverse attribute types to simplified types
     */
    private mapAttributeType;
    /**
     * List all solutions in the environment
     * @returns Array of solution names
     */
    listSolutions(): Promise<Array<{
        uniqueName: string;
        displayName: string;
        version: string;
    }>>;
}
//# sourceMappingURL=DataverseClient.d.ts.map