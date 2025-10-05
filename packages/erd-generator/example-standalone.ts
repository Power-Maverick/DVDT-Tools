import { DataverseClient, ERDGenerator } from './src';

/**
 * Example: Using ERD Generator as a standalone tool with Dataverse authentication
 * 
 * This example demonstrates how to:
 * 1. Connect to Dataverse using an access token
 * 2. Fetch solution metadata directly from Dataverse
 * 3. Generate ERD diagrams
 */

async function main() {
  // Configuration - Replace with your values
  const config = {
    environmentUrl: process.env.DATAVERSE_URL || 'https://your-org.crm.dynamics.com',
    accessToken: process.env.DATAVERSE_TOKEN || 'your-access-token-here',
    apiVersion: '9.2', // Optional, defaults to 9.2
  };

  const solutionName = process.env.SOLUTION_NAME || 'YourSolutionName';

  console.log('=== Standalone ERD Generator Example ===\n');
  console.log(`Connecting to: ${config.environmentUrl}`);
  console.log(`Solution: ${solutionName}\n`);

  try {
    // Create Dataverse client
    const client = new DataverseClient(config);

    // Option 1: List available solutions
    console.log('Fetching available solutions...');
    const solutions = await client.listSolutions();
    console.log(`Found ${solutions.length} solutions:`);
    solutions.slice(0, 5).forEach(s => {
      console.log(`  - ${s.displayName} (${s.uniqueName}) v${s.version}`);
    });
    console.log('\n' + '='.repeat(80) + '\n');

    // Option 2: Fetch specific solution metadata
    console.log(`Fetching solution metadata for: ${solutionName}...`);
    const solution = await client.fetchSolution(solutionName);
    
    console.log(`✓ Fetched solution: ${solution.displayName}`);
    console.log(`  Version: ${solution.version}`);
    console.log(`  Publisher: ${solution.publisherPrefix}`);
    console.log(`  Tables: ${solution.tables.length}`);
    console.log('');

    solution.tables.forEach(table => {
      console.log(`  - ${table.displayName} (${table.logicalName})`);
      console.log(`    Attributes: ${table.attributes.length}, Relationships: ${table.relationships.length}`);
    });

    console.log('\n' + '='.repeat(80) + '\n');

    // Generate ERD in Mermaid format
    console.log('Generating Mermaid ERD...\n');
    const generator = new ERDGenerator({
      format: 'mermaid',
      includeAttributes: true,
      includeRelationships: true,
      maxAttributesPerTable: 10,
    });

    const erd = generator.generate(solution);
    console.log(erd);

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('✓ ERD generated successfully!');
    console.log('\nYou can now:');
    console.log('- Copy the output to a .mmd file');
    console.log('- View it in VS Code with Mermaid extension');
    console.log('- Render it in GitHub markdown');

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  // Check for required environment variables
  if (!process.env.DATAVERSE_URL || !process.env.DATAVERSE_TOKEN) {
    console.error('Error: Required environment variables not set\n');
    console.log('Usage:');
    console.log('  DATAVERSE_URL=https://your-org.crm.dynamics.com \\');
    console.log('  DATAVERSE_TOKEN=your-access-token \\');
    console.log('  SOLUTION_NAME=YourSolutionName \\');
    console.log('  npx ts-node example-standalone.ts');
    console.log('\nOr set them in your environment first:');
    console.log('  export DATAVERSE_URL=https://your-org.crm.dynamics.com');
    console.log('  export DATAVERSE_TOKEN=your-access-token');
    console.log('  export SOLUTION_NAME=YourSolutionName');
    console.log('  npx ts-node example-standalone.ts');
    process.exit(1);
  }

  main().catch(console.error);
}

export { main };
