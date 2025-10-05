#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { DataverseClient, ERDGenerator } from './src';

/**
 * CLI tool for generating ERD from Dataverse solutions
 */

interface CliArgs {
  url?: string;
  token?: string;
  solution?: string;
  format?: 'mermaid' | 'plantuml' | 'graphviz';
  output?: string;
  listSolutions?: boolean;
  includeAttributes?: boolean;
  includeRelationships?: boolean;
  maxAttributes?: number;
  help?: boolean;
}

function printUsage() {
  console.log(`
ERD Generator CLI - Generate Entity Relationship Diagrams from Dataverse

Usage:
  erd-generator [options]

Options:
  --url <url>              Dataverse environment URL (required)
  --token <token>          Access token for authentication (required)
  --solution <name>        Solution unique name to generate ERD for
  --format <format>        Output format: mermaid|plantuml|graphviz (default: mermaid)
  --output <file>          Output file path (optional, prints to stdout if not provided)
  --list-solutions         List all available solutions and exit
  --include-attributes     Include table attributes in diagram (default: true)
  --include-relationships  Include relationships in diagram (default: true)
  --max-attributes <num>   Maximum attributes per table (default: 10, 0 = all)
  --help                   Show this help message

Environment Variables:
  DATAVERSE_URL            Alternative to --url
  DATAVERSE_TOKEN          Alternative to --token
  SOLUTION_NAME            Alternative to --solution

Examples:
  # List available solutions
  erd-generator --url https://org.crm.dynamics.com --token <token> --list-solutions

  # Generate ERD for a solution
  erd-generator --url https://org.crm.dynamics.com --token <token> --solution MySolution

  # Generate ERD and save to file
  erd-generator --url https://org.crm.dynamics.com --token <token> \\
                --solution MySolution --output diagram.mmd

  # Generate PlantUML diagram
  erd-generator --url https://org.crm.dynamics.com --token <token> \\
                --solution MySolution --format plantuml --output diagram.puml

  # Using environment variables
  export DATAVERSE_URL=https://org.crm.dynamics.com
  export DATAVERSE_TOKEN=your-token
  export SOLUTION_NAME=MySolution
  erd-generator --output diagram.mmd
`);
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const rawArgs = process.argv.slice(2);

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    const next = rawArgs[i + 1];

    switch (arg) {
      case '--url':
        args.url = next;
        i++;
        break;
      case '--token':
        args.token = next;
        i++;
        break;
      case '--solution':
        args.solution = next;
        i++;
        break;
      case '--format':
        args.format = next as any;
        i++;
        break;
      case '--output':
        args.output = next;
        i++;
        break;
      case '--max-attributes':
        args.maxAttributes = parseInt(next, 10);
        i++;
        break;
      case '--list-solutions':
        args.listSolutions = true;
        break;
      case '--include-attributes':
        args.includeAttributes = next?.toLowerCase() !== 'false';
        if (next && (next.toLowerCase() === 'true' || next.toLowerCase() === 'false')) i++;
        break;
      case '--include-relationships':
        args.includeRelationships = next?.toLowerCase() !== 'false';
        if (next && (next.toLowerCase() === 'true' || next.toLowerCase() === 'false')) i++;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  // Use environment variables as fallback
  args.url = args.url || process.env.DATAVERSE_URL;
  args.token = args.token || process.env.DATAVERSE_TOKEN;
  args.solution = args.solution || process.env.SOLUTION_NAME;

  return args;
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.url || !args.token) {
    console.error('Error: --url and --token are required\n');
    printUsage();
    process.exit(1);
  }

  try {
    const client = new DataverseClient({
      environmentUrl: args.url,
      accessToken: args.token,
    });

    // List solutions mode
    if (args.listSolutions) {
      console.log('Fetching solutions...\n');
      const solutions = await client.listSolutions();
      
      console.log(`Found ${solutions.length} solutions:\n`);
      solutions.forEach(s => {
        console.log(`  ${s.displayName}`);
        console.log(`    Unique Name: ${s.uniqueName}`);
        console.log(`    Version: ${s.version}`);
        console.log('');
      });
      
      return;
    }

    // Generate ERD mode
    if (!args.solution) {
      console.error('Error: --solution is required (or use --list-solutions to see available solutions)\n');
      printUsage();
      process.exit(1);
    }

    console.error(`Fetching solution: ${args.solution}...`);
    const solution = await client.fetchSolution(args.solution);
    
    console.error(`✓ Fetched ${solution.tables.length} tables`);
    console.error('Generating ERD...');

    const generator = new ERDGenerator({
      format: args.format || 'mermaid',
      includeAttributes: args.includeAttributes !== false,
      includeRelationships: args.includeRelationships !== false,
      maxAttributesPerTable: args.maxAttributes || 10,
    });

    const erd = generator.generate(solution);

    if (args.output) {
      const outputPath = path.resolve(args.output);
      fs.writeFileSync(outputPath, erd);
      console.error(`✓ ERD saved to: ${outputPath}`);
    } else {
      console.log(erd);
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('API Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
