/**
 * Minimal Integration Example for Dataverse DevTools
 * 
 * This example shows the absolute minimum code needed to integrate
 * the ERD generator into Dataverse DevTools VS Code extension.
 */

import { DataverseClient, ERDGenerator } from '@dvdt-tools/erd-generator';

/**
 * Minimal integration - just pass the token from DVDT
 */
export async function generateERDMinimal(
  token: string,
  environmentUrl: string,
  solutionName: string
): Promise<string> {
  // Step 1: Create client with token from DVDT
  const client = new DataverseClient({
    environmentUrl,
    accessToken: token
  });

  // Step 2: Fetch solution and generate ERD
  const solution = await client.fetchSolution(solutionName);
  const generator = new ERDGenerator({ format: 'mermaid' });
  
  // Step 3: Return the ERD
  return generator.generate(solution);
}

/**
 * Example usage in VS Code extension command
 */
export async function exampleVSCodeCommand(
  dvdtAuth: any, // Your DVDT auth service
  dvdtConfig: any // Your DVDT config service
) {
  try {
    // Get token and environment from DVDT (your existing code)
    const token = await dvdtAuth.getAccessToken();
    const environmentUrl = dvdtConfig.getCurrentEnvironment();
    const solutionName = 'YourSolution'; // From user selection
    
    // Generate ERD - minimal integration!
    const erd = await generateERDMinimal(token, environmentUrl, solutionName);
    
    // Display in VS Code (your existing display logic)
    // Example: Show in webview, save to file, etc.
    console.log(erd);
    
  } catch (error) {
    console.error('ERD generation failed:', error.message);
  }
}

/**
 * Optional: List solutions before generating
 */
export async function listSolutionsMinimal(
  token: string,
  environmentUrl: string
): Promise<Array<{ uniqueName: string; displayName: string; version: string }>> {
  const client = new DataverseClient({
    environmentUrl,
    accessToken: token
  });
  
  return await client.listSolutions();
}

/**
 * Complete minimal example with solution selection
 */
export async function generateERDWithSelection(
  token: string,
  environmentUrl: string,
  vscode: any // VS Code API
) {
  // 1. Create client
  const client = new DataverseClient({
    environmentUrl,
    accessToken: token
  });
  
  // 2. List solutions
  const solutions = await client.listSolutions();
  
  // 3. Let user select (using VS Code QuickPick)
  const selected = await vscode.window.showQuickPick(
    solutions.map(s => ({
      label: s.displayName,
      description: s.uniqueName
    }))
  );
  
  if (!selected) return;
  
  // 4. Generate ERD
  const solution = await client.fetchSolution(selected.description);
  const generator = new ERDGenerator({ format: 'mermaid' });
  const erd = generator.generate(solution);
  
  // 5. Display result
  return erd;
}

/**
 * Summary:
 * 
 * Integration is minimal:
 * - Install: npm install @dvdt-tools/erd-generator
 * - Import: import { DataverseClient, ERDGenerator } from '@dvdt-tools/erd-generator'
 * - Use: Pass token from DVDT, get ERD back
 * 
 * That's it! No complex setup, no additional configuration.
 */
