export * from '@/models/interfaces';
export { ERDGenerator } from '@components/ERDGenerator';
export { DataverseClient } from '@utils/DataverseClient';
export type { DataverseConfig } from '@utils/DataverseClient';

// VS Code integration (optional import)
export { showERDPanel } from '@/dvdtIntegration/integration';
