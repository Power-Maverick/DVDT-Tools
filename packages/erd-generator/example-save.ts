import * as fs from 'fs';
import * as path from 'path';
import { ERDGenerator, DataverseSolution } from './src';

/**
 * Advanced example showing how to generate and save ERD diagrams to files
 */

// Sample solution data
const solution: DataverseSolution = {
  uniqueName: 'CustomerManagement',
  displayName: 'Customer Management',
  version: '1.0.0.0',
  publisherPrefix: 'cust',
  tables: [
    {
      logicalName: 'account',
      displayName: 'Account',
      schemaName: 'Account',
      primaryIdAttribute: 'accountid',
      primaryNameAttribute: 'name',
      tableType: 'Standard',
      attributes: [
        {
          logicalName: 'accountid',
          displayName: 'Account',
          type: 'guid',
          isPrimaryId: true,
          isPrimaryName: false,
          isRequired: true
        },
        {
          logicalName: 'name',
          displayName: 'Account Name',
          type: 'string',
          isPrimaryId: false,
          isPrimaryName: true,
          isRequired: true,
          maxLength: 160
        }
      ],
      relationships: [
        {
          schemaName: 'account_contact',
          type: 'OneToMany',
          relatedTable: 'contact'
        }
      ]
    },
    {
      logicalName: 'contact',
      displayName: 'Contact',
      schemaName: 'Contact',
      primaryIdAttribute: 'contactid',
      primaryNameAttribute: 'fullname',
      tableType: 'Standard',
      attributes: [
        {
          logicalName: 'contactid',
          displayName: 'Contact',
          type: 'guid',
          isPrimaryId: true,
          isPrimaryName: false,
          isRequired: true
        },
        {
          logicalName: 'fullname',
          displayName: 'Full Name',
          type: 'string',
          isPrimaryId: false,
          isPrimaryName: true,
          isRequired: false,
          maxLength: 160
        }
      ],
      relationships: []
    }
  ]
};

// Create output directory
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

console.log('Generating ERD diagrams...\n');

// Generate and save Mermaid diagram
const mermaidGenerator = new ERDGenerator({ format: 'mermaid' });
const mermaidERD = mermaidGenerator.generate(solution);
const mermaidFile = path.join(outputDir, 'diagram.mmd');
fs.writeFileSync(mermaidFile, mermaidERD);
console.log(`✓ Mermaid diagram saved to: ${mermaidFile}`);

// Generate and save PlantUML diagram
const plantUMLGenerator = new ERDGenerator({ format: 'plantuml' });
const plantUMLERD = plantUMLGenerator.generate(solution);
const plantUMLFile = path.join(outputDir, 'diagram.puml');
fs.writeFileSync(plantUMLFile, plantUMLERD);
console.log(`✓ PlantUML diagram saved to: ${plantUMLFile}`);

// Generate and save Graphviz diagram
const graphvizGenerator = new ERDGenerator({ format: 'graphviz' });
const graphvizERD = graphvizGenerator.generate(solution);
const graphvizFile = path.join(outputDir, 'diagram.dot');
fs.writeFileSync(graphvizFile, graphvizERD);
console.log(`✓ Graphviz diagram saved to: ${graphvizFile}`);

console.log('\nAll diagrams generated successfully!');
console.log('\nYou can now:');
console.log('- View the Mermaid diagram in VS Code with the Mermaid extension');
console.log('- Generate PlantUML images with: plantuml diagram.puml');
console.log('- Generate Graphviz images with: dot -Tpng diagram.dot -o diagram.png');
