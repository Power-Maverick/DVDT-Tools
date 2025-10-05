import { ERDGenerator, DataverseSolution } from '@dvdt-tools/erd-generator';

/**
 * Example usage of the ERD Generator
 * This demonstrates how to create ERD diagrams from Dataverse solution metadata
 */

// Sample Dataverse solution with tables
const sampleSolution: DataverseSolution = {
  uniqueName: 'SampleCRM',
  displayName: 'Sample CRM Solution',
  version: '1.0.0.0',
  publisherPrefix: 'sample',
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
        },
        {
          logicalName: 'accountnumber',
          displayName: 'Account Number',
          type: 'string',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: false,
          maxLength: 20
        },
        {
          logicalName: 'revenue',
          displayName: 'Annual Revenue',
          type: 'money',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: false
        }
      ],
      relationships: [
        {
          schemaName: 'account_contact',
          type: 'OneToMany',
          relatedTable: 'contact',
          lookupAttribute: 'parentcustomerid'
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
        },
        {
          logicalName: 'firstname',
          displayName: 'First Name',
          type: 'string',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: false,
          maxLength: 50
        },
        {
          logicalName: 'lastname',
          displayName: 'Last Name',
          type: 'string',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: true,
          maxLength: 50
        },
        {
          logicalName: 'emailaddress1',
          displayName: 'Email',
          type: 'string',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: false,
          maxLength: 100
        },
        {
          logicalName: 'parentcustomerid',
          displayName: 'Company Name',
          type: 'lookup',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: false
        }
      ],
      relationships: [
        {
          schemaName: 'contact_opportunity',
          type: 'OneToMany',
          relatedTable: 'opportunity',
          lookupAttribute: 'customerid'
        }
      ]
    },
    {
      logicalName: 'opportunity',
      displayName: 'Opportunity',
      schemaName: 'Opportunity',
      primaryIdAttribute: 'opportunityid',
      primaryNameAttribute: 'name',
      tableType: 'Standard',
      attributes: [
        {
          logicalName: 'opportunityid',
          displayName: 'Opportunity',
          type: 'guid',
          isPrimaryId: true,
          isPrimaryName: false,
          isRequired: true
        },
        {
          logicalName: 'name',
          displayName: 'Topic',
          type: 'string',
          isPrimaryId: false,
          isPrimaryName: true,
          isRequired: true,
          maxLength: 300
        },
        {
          logicalName: 'estimatedvalue',
          displayName: 'Est. Revenue',
          type: 'money',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: false
        },
        {
          logicalName: 'customerid',
          displayName: 'Potential Customer',
          type: 'lookup',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: false
        },
        {
          logicalName: 'closeprobability',
          displayName: 'Probability',
          type: 'int',
          isPrimaryId: false,
          isPrimaryName: false,
          isRequired: false
        }
      ],
      relationships: []
    }
  ]
};

console.log('=== ERD Generator Example ===\n');

// Example 1: Generate Mermaid ERD
console.log('1. Mermaid Format ERD:\n');
const mermaidGenerator = new ERDGenerator({
  format: 'mermaid',
  includeAttributes: true,
  includeRelationships: true,
  maxAttributesPerTable: 5
});
const mermaidERD = mermaidGenerator.generate(sampleSolution);
console.log(mermaidERD);
console.log('\n' + '='.repeat(80) + '\n');

// Example 2: Generate PlantUML ERD
console.log('2. PlantUML Format ERD:\n');
const plantUMLGenerator = new ERDGenerator({
  format: 'plantuml',
  includeAttributes: true,
  includeRelationships: true,
  maxAttributesPerTable: 5
});
const plantUMLERD = plantUMLGenerator.generate(sampleSolution);
console.log(plantUMLERD);
console.log('\n' + '='.repeat(80) + '\n');

// Example 3: Generate Graphviz ERD
console.log('3. Graphviz Format ERD:\n');
const graphvizGenerator = new ERDGenerator({
  format: 'graphviz',
  includeAttributes: true,
  includeRelationships: true,
  maxAttributesPerTable: 5
});
const graphvizERD = graphvizGenerator.generate(sampleSolution);
console.log(graphvizERD);
console.log('\n' + '='.repeat(80) + '\n');

// Example 4: Generate simple ERD without attributes
console.log('4. Simple Mermaid ERD (without attributes):\n');
const simpleGenerator = new ERDGenerator({
  format: 'mermaid',
  includeAttributes: false,
  includeRelationships: true,
  maxAttributesPerTable: 0
});
const simpleERD = simpleGenerator.generate(sampleSolution);
console.log(simpleERD);
