const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const AirbyteClient = require('./airbyte-client');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get Airbyte API credentials from environment variables or use the ones from the local installation
const AIRBYTE_CLIENT_ID = process.env.AIRBYTE_CLIENT_ID || '68eb3177-2afb-44da-851d-a9deb0bb9364';
const AIRBYTE_CLIENT_SECRET = process.env.AIRBYTE_CLIENT_SECRET || 'AKS7gtga3Sw1HSRI65KtauGPPaeKf0Ju';
const AIRBYTE_PASSWORD = process.env.AIRBYTE_PASSWORD || '32bTEN4EvQtGruOxMLCrn6Ai17zHYMS7';

console.log('Using self-hosted Airbyte instance at http://localhost:8000');

// Create an instance of our Airbyte client
const airbyteClient = new AirbyteClient({
  apiUrl: 'http://localhost:8000/api/v1',
  useBasicAuth: true,
  username: 'airbyte',
  password: AIRBYTE_PASSWORD
});

// Stores created resources for the demo
const demoState = {
  workspaceId: null,
  sourceId: null,
  destinationId: null,
  connectionId: null
};

// For OAuth callbacks
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/oauth/callback';

// Step 1: Test the Airbyte connection
app.post('/test-connection', async (req, res) => {
  try {
    // Test connection by listing workspaces
    const workspaces = await airbyteClient.listWorkspaces();

    // Return success with the workspaces
    res.json({
      success: true,
      message: 'Connection to Airbyte API successful',
      workspaces: workspaces.workspaces || []
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(error.status || 500).json({
      error: 'Error testing connection',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Step 2: Create a workspace for a user
app.post('/create-workspace', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const workspace = await airbyteClient.createWorkspace(
      name,
      email || 'user@example.com'
    );

    // Save workspace ID for demo purposes
    demoState.workspaceId = workspace.workspaceId;

    res.json({
      success: true,
      message: 'Workspace created successfully',
      workspace
    });
  } catch (error) {
    console.error('Error creating workspace:', error);
    res.status(error.status || 500).json({
      error: 'Error creating workspace',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Step 3: Get source definition ID
app.get('/source-definitions', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Source name is required' });
    }

    // No need to check for API credentials as we're using self-hosted Airbyte

    const sourceDefinition = await airbyteClient.getSourceDefinitionByName(name);

    if (!sourceDefinition) {
      return res.status(404).json({ error: `Source definition for '${name}' not found` });
    }

    res.json({
      success: true,
      sourceDefinition
    });
  } catch (error) {
    console.error('Error getting source definition:', error);

    // Provide more specific error messages based on status code
    if (error.status === 403) {
      res.status(403).json({
        error: 'Forbidden: Access denied to source definitions',
        message: 'Your API credentials do not have permission to access source definitions. Please check your Airbyte API credentials and ensure they have the necessary permissions.'
      });
    } else if (error.status === 401) {
      res.status(401).json({
        error: 'Unauthorized: Invalid API credentials',
        message: 'Your API credentials are invalid or expired. Please update your AIRBYTE_CLIENT_ID and AIRBYTE_CLIENT_SECRET in the .env file.'
      });
    } else {
      res.status(error.status || 500).json({
        error: 'Error getting source definition',
        message: error.message || 'Unknown error occurred'
      });
    }
  }
});

// Step 3: Initiate OAuth flow for a source
app.post('/initiate-oauth', async (req, res) => {
  try {
    const { workspaceId, sourceDefinitionId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    if (!sourceDefinitionId) {
      return res.status(400).json({ error: 'Source Definition ID is required' });
    }

    const oauthResponse = await airbyteClient.initiateOAuth(
      workspaceId,
      sourceDefinitionId,
      CALLBACK_URL
    );

    res.json({
      success: true,
      consentUrl: oauthResponse.authorizationUrl || oauthResponse.redirectUrl,
      oauthResponse
    });
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    res.status(error.status || 500).json({
      error: 'Error initiating OAuth',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Step 3: Handle OAuth callback and complete source creation
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  const workspaceId = req.query.workspaceId || demoState.workspaceId;
  const sourceName = req.query.sourceName || 'Source from OAuth';

  if (!code) {
    return res.status(400).send('Missing OAuth code in callback parameters');
  }

  if (!workspaceId) {
    return res.status(400).send('Missing workspace ID. Please create a workspace first.');
  }

  try {
    // Get source definition ID from state or use HubSpot as default for demo
    const sourceDefinitionId = req.query.sourceDefinitionId || state;

    if (!sourceDefinitionId) {
      return res.status(400).send('Missing source definition ID in callback state');
    }

    // Complete OAuth flow and create source
    const sourceResponse = await airbyteClient.completeOAuth(
      workspaceId,
      sourceDefinitionId,
      CALLBACK_URL,
      { code, state },
      sourceName,
      { start_date: new Date().toISOString().split('T')[0] } // Use today as start date
    );

    // Save source ID for demo purposes
    demoState.sourceId = sourceResponse.sourceId;

    res.send(`
      <html>
        <head>
          <title>OAuth Successful</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .success { color: #28a745; }
            .info { color: #17a2b8; margin: 20px 0; }
            .back-link { margin-top: 30px; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ OAuth Connection Successful!</h1>
          <div class="info">
            <p>Source has been created in Airbyte</p>
            <p>Source ID: ${sourceResponse.sourceId}</p>
          </div>
          <div class="back-link">
            <a href="/" onclick="window.opener && window.opener.postMessage({type: 'OAUTH_SUCCESS', sourceId: '${sourceResponse.sourceId}'}, '*'); window.close(); return false;">
              Close this window and return to the application
            </a>
          </div>
          <script>
            window.opener && window.opener.postMessage({type: 'OAUTH_SUCCESS', sourceId: '${sourceResponse.sourceId}'}, '*');
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error completing OAuth:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>OAuth Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .error { color: #dc3545; }
            .details { margin: 20px 0; color: #6c757d; }
            .back-link { margin-top: 30px; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ OAuth Error</h1>
          <div class="details">
            <p>${error.message || 'An error occurred while completing the OAuth process'}</p>
          </div>
          <div class="back-link">
            <a href="/" onclick="window.opener && window.opener.postMessage({type: 'OAUTH_ERROR', error: '${error.message}'}, '*'); window.close(); return false;">
              Close this window and return to the application
            </a>
          </div>
          <script>
            window.opener && window.opener.postMessage({type: 'OAUTH_ERROR', error: '${error.message}'}, '*');
          </script>
        </body>
      </html>
    `);
  }
});

// Step 4: Create a destination
app.post('/create-destination', async (req, res) => {
  try {
    const { workspaceId, destinationDefinitionId, name, connectionConfiguration } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    if (!destinationDefinitionId) {
      return res.status(400).json({ error: 'Destination Definition ID is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Destination name is required' });
    }

    if (!connectionConfiguration) {
      return res.status(400).json({ error: 'Connection configuration is required' });
    }

    const destination = await airbyteClient.createDestination(
      workspaceId,
      destinationDefinitionId,
      name,
      connectionConfiguration
    );

    // Save destination ID for demo purposes
    demoState.destinationId = destination.destinationId;

    res.json({
      success: true,
      message: 'Destination created successfully',
      destination
    });
  } catch (error) {
    console.error('Error creating destination:', error);
    res.status(error.status || 500).json({
      error: 'Error creating destination',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Get destination definitions
app.get('/destination-definitions', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Destination name is required' });
    }

    // No need to check for API credentials as we're using self-hosted Airbyte

    const destinationDefinition = await airbyteClient.getDestinationDefinitionByName(name);

    if (!destinationDefinition) {
      return res.status(404).json({ error: `Destination definition for '${name}' not found` });
    }

    res.json({
      success: true,
      destinationDefinition
    });
  } catch (error) {
    console.error('Error getting destination definition:', error);

    // Provide more specific error messages based on status code
    if (error.status === 403) {
      res.status(403).json({
        error: 'Forbidden: Access denied to destination definitions',
        message: 'Your API credentials do not have permission to access destination definitions. Please check your Airbyte API credentials and ensure they have the necessary permissions.'
      });
    } else if (error.status === 401) {
      res.status(401).json({
        error: 'Unauthorized: Invalid API credentials',
        message: 'Your API credentials are invalid or expired. Please update your AIRBYTE_CLIENT_ID and AIRBYTE_CLIENT_SECRET in the .env file.'
      });
    } else {
      res.status(error.status || 500).json({
        error: 'Error getting destination definition',
        message: error.message || 'Unknown error occurred'
      });
    }
  }
});

// Step 5: Create a connection
app.post('/create-connection', async (req, res) => {
  try {
    const { sourceId, destinationId, name, config } = req.body;

    if (!sourceId) {
      return res.status(400).json({ error: 'Source ID is required' });
    }

    if (!destinationId) {
      return res.status(400).json({ error: 'Destination ID is required' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Connection name is required' });
    }

    const connection = await airbyteClient.createConnection(
      sourceId,
      destinationId,
      name,
      config
    );

    // Save connection ID for demo purposes
    demoState.connectionId = connection.connectionId;

    res.json({
      success: true,
      message: 'Connection created successfully',
      connection
    });
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(error.status || 500).json({
      error: 'Error creating connection',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Step 6: Trigger a sync
app.post('/trigger-sync', async (req, res) => {
  try {
    const { connectionId } = req.body;

    if (!connectionId) {
      return res.status(400).json({ error: 'Connection ID is required' });
    }

    const job = await airbyteClient.triggerSync(connectionId);

    res.json({
      success: true,
      message: 'Sync job triggered successfully',
      job
    });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(error.status || 500).json({
      error: 'Error triggering sync',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Get demo state (current status of the demo)
app.get('/demo-state', (req, res) => {
  res.json({
    workspaceId: demoState.workspaceId,
    sourceId: demoState.sourceId,
    destinationId: demoState.destinationId,
    connectionId: demoState.connectionId,
    callbackUrl: CALLBACK_URL
  });
});

// For the root path, serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Airbyte Embedded POC server running on http://localhost:${port}`);
});
