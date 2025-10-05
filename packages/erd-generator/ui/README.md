# ERD Generator Web UI

A web-based user interface for generating Entity Relationship Diagrams from Dataverse solutions.

## Features

- 🔐 **Connect to Dataverse**: Enter your environment URL and access token
- 📋 **Browse Solutions**: View all available solutions in your environment
- 🎨 **Select Format**: Choose between Mermaid, PlantUML, or Graphviz formats
- 🗺️ **Generate Diagrams**: Create ERD diagrams with a single click
- 💾 **Download Options**:
  - Download as PNG image
  - Download as SVG vector
  - Download source code (.mmd, .puml, .dot)
- 📋 **Copy to Clipboard**: Easily copy diagram source code

## Quick Start

### 1. Build the project

```bash
npm run build
```

### 2. Start the UI server

```bash
npm run ui
```

The server will start at `http://localhost:3000`

### 3. Open in browser

Navigate to `http://localhost:3000` in your web browser.

## Usage Steps

1. **Connect to Dataverse**
   - Enter your Dataverse environment URL (e.g., `https://your-org.crm.dynamics.com`)
   - Paste your access token from Dataverse DevTools
   - Click "Connect & List Solutions"

2. **Select a Solution**
   - Browse the list of available solutions
   - Click on a solution card to select it

3. **Generate ERD**
   - Choose your preferred output format (Mermaid, PlantUML, or Graphviz)
   - Click "Generate ERD"
   - View the generated diagram

4. **Download or Share**
   - Download as PNG image (for Mermaid diagrams)
   - Download as SVG vector (for Mermaid diagrams)
   - Download source code in the selected format
   - Copy source code to clipboard

## Development Mode

For development with auto-reload:

```bash
npm run ui:dev
```

This uses nodemon to automatically restart the server when files change.

## API Endpoints

The server exposes the following API endpoints:

### POST /api/solutions

List all solutions in the Dataverse environment.

**Request:**
```json
{
  "environmentUrl": "https://your-org.crm.dynamics.com",
  "accessToken": "your-access-token"
}
```

**Response:**
```json
[
  {
    "uniqueName": "MySolution",
    "displayName": "My Solution",
    "version": "1.0.0.0"
  }
]
```

### POST /api/generate-erd

Generate ERD for a specific solution.

**Request:**
```json
{
  "environmentUrl": "https://your-org.crm.dynamics.com",
  "accessToken": "your-access-token",
  "solutionName": "MySolution",
  "format": "mermaid"
}
```

**Response:**
```json
{
  "diagram": "erDiagram\n    account {...}\n    ...",
  "solution": {
    "uniqueName": "MySolution",
    "displayName": "My Solution",
    "version": "1.0.0.0",
    "tableCount": 5
  }
}
```

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+), Mermaid.js for diagram rendering
- **Backend**: Node.js, Express.js
- **Styling**: Custom CSS with modern design

## Screenshots

The UI features a modern, intuitive design with:
- Step-by-step workflow indicator
- Card-based solution selection
- Real-time diagram rendering
- Multiple download options
- Responsive layout

## Security Notes

- Access tokens are not stored on the server
- All API calls are made server-side to protect credentials
- Use HTTPS in production environments
- Keep your access tokens secure

## Troubleshooting

### Connection fails
- Verify your environment URL is correct
- Ensure your access token is valid and not expired
- Check that you have permissions to read solution metadata

### Diagram doesn't render
- For Mermaid diagrams, ensure your browser supports modern JavaScript
- For PlantUML/Graphviz, the source code will be displayed instead

### Download fails
- PNG/SVG downloads only work for Mermaid diagrams
- Use "Download Source" for PlantUML/Graphviz formats

## License

GPL-2.0
