const express = require('express');
const path = require('path');
const { DataverseClient } = require('../dist/src/DataverseClient.js');
const { ERDGenerator } = require('../dist/src/ERDGenerator.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API: List solutions
app.post('/api/solutions', async (req, res) => {
    try {
        const { environmentUrl, accessToken } = req.body;

        if (!environmentUrl || !accessToken) {
            return res.status(400).json({ 
                message: 'Missing required fields: environmentUrl and accessToken' 
            });
        }

        const client = new DataverseClient({
            environmentUrl,
            accessToken,
            apiVersion: '9.2'
        });

        const solutions = await client.listSolutions();
        res.json(solutions);

    } catch (error) {
        console.error('Error listing solutions:', error);
        res.status(500).json({ 
            message: error.message || 'Failed to list solutions' 
        });
    }
});

// API: Generate ERD
app.post('/api/generate-erd', async (req, res) => {
    try {
        const { environmentUrl, accessToken, solutionName, format } = req.body;

        if (!environmentUrl || !accessToken || !solutionName) {
            return res.status(400).json({ 
                message: 'Missing required fields: environmentUrl, accessToken, and solutionName' 
            });
        }

        // Create Dataverse client
        const client = new DataverseClient({
            environmentUrl,
            accessToken,
            apiVersion: '9.2'
        });

        // Fetch solution metadata
        const solution = await client.fetchSolution(solutionName);

        // Generate ERD
        const generator = new ERDGenerator({
            format: format || 'mermaid',
            includeAttributes: true,
            includeRelationships: true,
            maxAttributesPerTable: 10
        });

        const diagram = generator.generate(solution);

        res.json({ 
            diagram,
            solution: {
                uniqueName: solution.uniqueName,
                displayName: solution.displayName,
                version: solution.version,
                tableCount: solution.tables.length
            }
        });

    } catch (error) {
        console.error('Error generating ERD:', error);
        res.status(500).json({ 
            message: error.message || 'Failed to generate ERD' 
        });
    }
});

// Serve the UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║         Dataverse ERD Generator UI Server                      ║
╚════════════════════════════════════════════════════════════════╝

Server running at: http://localhost:${PORT}
    
Open your browser and navigate to the URL above to use the UI.

API Endpoints:
  POST /api/solutions       - List all solutions
  POST /api/generate-erd    - Generate ERD for a solution

Press Ctrl+C to stop the server.
    `);
});

module.exports = app;
