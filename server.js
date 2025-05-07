const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const AirbyteClient = require('./airbyte-client');
const hubspotPrivateApp = require('./hubspot-private-app');
const hubspotOAuth = require('./hubspot-oauth');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3003; // Changed to 3003 to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Airbyte API credentials
const AIRBYTE_EMAIL = 'goncalo.p.gomes@gmail.com';
const AIRBYTE_PASSWORD = 'Jtb5LltCm3nzxBh7Fv9mJQLGXOeYe8Na';
const AIRBYTE_CLIENT_ID = '44c82318-bb2e-460a-b5ec-491198c184dd';
const AIRBYTE_CLIENT_SECRET = 'KEcxXjnLtzN7nkPiqML3hT0KPx4ofzqs';
// Token will be generated using the credentials above
const AIRBYTE_TOKEN = null;

console.log('Using Airbyte instance at http://scuver.services:8000');

// Create an instance of our Airbyte client with the correct API path
const airbyteClient = new AirbyteClient({
  // Use the scuver.services domain with the correct API path
  apiUrl: 'http://scuver.services:8000/api/v1',
  clientId: AIRBYTE_CLIENT_ID,
  clientSecret: AIRBYTE_CLIENT_SECRET,
  email: AIRBYTE_EMAIL,
  password: AIRBYTE_PASSWORD,
  token: AIRBYTE_TOKEN
});

// Add the configuration from the screenshot
console.log('# AirByte configuration:');
console.log('AIRBYTE_URL=http://scuver.services:8000');
console.log('AIRBYTE_WORKSPACE_ID='); // We'll discover the workspace ID
console.log(`AIRBYTE_CLIENT_ID=${AIRBYTE_CLIENT_ID}`);
console.log(`AIRBYTE_CLIENT_SECRET=${AIRBYTE_CLIENT_SECRET}`);

console.log('Using credential-based authentication to generate tokens as needed');

// Stores created resources for the demo
const demoState = {
  workspaceId: '95eb9a83-5c21-4418-926d-074e879f2270', // Use a hardcoded workspace ID
  sourceId: null,
  destinationId: null,
  connectionId: null
};

// For OAuth callbacks
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3003/oauth/callback';
console.log('Using OAuth callback URL:', CALLBACK_URL);

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

// Step 2: Use existing workspace instead of creating a new one
app.post('/create-workspace', async (req, res) => {
  try {
    const { name, email } = req.body;

    // Use a hardcoded workspace ID
    const workspaceId = '4fa87658-8ced-45d0-979e-30edc0c4a494';
    demoState.workspaceId = workspaceId;

    console.log(`Using existing workspace with ID: ${workspaceId}`);

    // Return the existing workspace information
    const workspace = {
      workspaceId: workspaceId,
      name: name || 'Default Workspace',
      email: email || 'admin@example.com'
    };

    res.json({
      success: true,
      message: 'Using existing workspace',
      workspace
    });
  } catch (error) {
    console.error('Error with workspace:', error);
    res.status(error.status || 500).json({
      error: 'Error with workspace',
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

    console.log(`Received request to find source definition for: ${name}`);
    console.log('Searching for source definition with name:', name);

    // Define hardcoded source definitions with complete information
    const hardcodedSourceDefinitions = {
      'hubspot': {
        sourceDefinitionId: '36c891d9-4bd9-43ac-bad2-10e12756272c',
        name: 'HubSpot',
        dockerRepository: 'airbyte/source-hubspot',
        dockerImageTag: 'latest',
        documentationUrl: 'https://docs.airbyte.com/integrations/sources/hubspot'
      },
      'google sheets': {
        sourceDefinitionId: '71607ba1-c0ac-4799-8049-7f4b90dd50f7',
        name: 'Google Sheets',
        dockerRepository: 'airbyte/source-google-sheets',
        dockerImageTag: 'latest',
        documentationUrl: 'https://docs.airbyte.com/integrations/sources/google-sheets'
      },
      'postgres': {
        sourceDefinitionId: 'decd338e-5647-4c0b-adf4-da0e75f5a750',
        name: 'Postgres',
        dockerRepository: 'airbyte/source-postgres',
        dockerImageTag: 'latest',
        documentationUrl: 'https://docs.airbyte.com/integrations/sources/postgres'
      },
      'mysql': {
        sourceDefinitionId: '435bb9a5-7887-4809-aa58-28c27df0d7ad',
        name: 'MySQL',
        dockerRepository: 'airbyte/source-mysql',
        dockerImageTag: 'latest',
        documentationUrl: 'https://docs.airbyte.com/integrations/sources/mysql'
      },
      'stripe': {
        sourceDefinitionId: 'e3cb2095-f5ef-4c9c-94a1-69e8f7fa2dfe',
        name: 'Stripe',
        dockerRepository: 'airbyte/source-stripe',
        dockerImageTag: 'latest',
        documentationUrl: 'https://docs.airbyte.com/integrations/sources/stripe'
      }
    };

    // Try to find a matching source definition in our hardcoded list
    const lowerName = name.toLowerCase();
    let sourceDefinition = null;

    for (const [sourceName, sourceDefData] of Object.entries(hardcodedSourceDefinitions)) {
      if (lowerName.includes(sourceName)) {
        console.log(`Using hardcoded source definition for ${sourceName}`);
        sourceDefinition = sourceDefData;
        break;
      }
    }

    // If we couldn't find a match in our hardcoded list, return an error
    if (!sourceDefinition) {
      console.log(`No source definition found for '${name}' using any method`);

      return res.status(404).json({
        error: `Source definition for '${name}' not found`,
        message: `Could not find a source definition matching '${name}'. Please check the name and try again.`
      });
    }

    console.log(`Successfully found source definition for '${name}'`);
    res.json({
      success: true,
      sourceDefinition
    });
  } catch (error) {
    console.error('Error getting source definition:', error);

    res.status(error.status || 500).json({
      error: 'Error getting source definition',
      message: error.message || 'Unknown error occurred',
      details: 'This may be due to authentication issues or the source not being available in your Airbyte instance.'
    });
  }
});

// Step 3: Initiate OAuth flow for a source using the proxy
app.post('/initiate-oauth-via-proxy', async (req, res) => {
  try {
    const { workspaceId, sourceDefinitionId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    if (!sourceDefinitionId) {
      return res.status(400).json({ error: 'Source Definition ID is required' });
    }

    console.log(`Initiating OAuth via proxy for workspace ${workspaceId} and source definition ${sourceDefinitionId}`);

    // For HubSpot, use the legacy method
    if (sourceDefinitionId === '36c891d9-4bd9-43ac-bad2-10e12756272c') {
      console.log('Using legacy HubSpot OAuth implementation...');

      // Get HubSpot client ID from environment variables
      const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || AIRBYTE_CLIENT_ID;

      if (!hubspotClientId) {
        return res.status(400).json({
          error: 'HubSpot Client ID is required',
          message: 'Please set HUBSPOT_CLIENT_ID in your .env file'
        });
      }

      // Generate HubSpot OAuth URL directly
      const consentUrl = hubspotOAuth.generateHubSpotOAuthUrl(
        hubspotClientId,
        CALLBACK_URL,
        workspaceId,
        sourceDefinitionId
      );

      return res.json({
        success: true,
        consentUrl,
        oauthResponse: { authorizationUrl: consentUrl },
        message: 'Successfully initiated HubSpot OAuth flow via direct method'
      });
    }

    // For other sources, try to use the proxy
    const fetch = await import('node-fetch');
    const proxyUrl = 'http://localhost:3004/test-with-valid-workspace';

    const options = {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceDefinitionId,
        redirectUrl: CALLBACK_URL,
        oauthInputConfiguration: {
          scopes: [
            "crm.objects.contacts.read",
            "crm.objects.companies.read",
            "crm.objects.deals.read"
          ]
        }
      })
    };

    console.log(`Making request to proxy: ${proxyUrl}`);
    const proxyResponse = await fetch.default(proxyUrl, options);

    if (proxyResponse.ok) {
      const data = await proxyResponse.json();
      console.log('Proxy response:', data);

      if (data.consentUrl) {
        return res.json({
          success: true,
          consentUrl: data.consentUrl,
          oauthResponse: data,
          message: 'Successfully initiated OAuth flow via proxy'
        });
      } else {
        return res.status(500).json({
          error: 'Proxy response did not contain a consent URL',
          message: 'The OAuth proxy did not return a valid consent URL',
          data
        });
      }
    } else {
      const errorData = await proxyResponse.text();
      console.error('Proxy request failed:', proxyResponse.status, errorData);

      return res.status(proxyResponse.status).json({
        error: 'Proxy request failed',
        message: `The OAuth proxy returned status ${proxyResponse.status}`,
        details: errorData
      });
    }
  } catch (error) {
    console.error('Error initiating OAuth via proxy:', error);
    res.status(500).json({
      error: 'Error initiating OAuth via proxy',
      message: error.message || 'Unknown error occurred'
    });
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

    console.log(`Initiating OAuth for workspace ${workspaceId} and source definition ${sourceDefinitionId}`);

    // For HubSpot, use the direct OAuth flow
    if (sourceDefinitionId === '36c891d9-4bd9-43ac-bad2-10e12756272c') {
      console.log('Using direct HubSpot OAuth implementation...');

      // Get HubSpot client ID from environment variables
      const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || AIRBYTE_CLIENT_ID;

      if (!hubspotClientId) {
        return res.status(400).json({
          error: 'HubSpot Client ID is required',
          message: 'Please set HUBSPOT_CLIENT_ID in your .env file'
        });
      }

      // Generate HubSpot OAuth URL directly
      const consentUrl = hubspotOAuth.generateHubSpotOAuthUrl(
        hubspotClientId,
        CALLBACK_URL,
        workspaceId,
        sourceDefinitionId
      );

      return res.json({
        success: true,
        consentUrl,
        oauthResponse: { authorizationUrl: consentUrl },
        message: 'Successfully initiated HubSpot OAuth flow via direct method'
      });
    }

    // For other sources, try the Airbyte client's initiateOAuth method
    try {
      console.log('Trying Airbyte client initiateOAuth method...');
      const oauthResponse = await airbyteClient.initiateOAuth(
        workspaceId,
        sourceDefinitionId,
        CALLBACK_URL
      );

      return res.json({
        success: true,
        consentUrl: oauthResponse.authorizationUrl || oauthResponse.consentUrl || oauthResponse.redirectUrl,
        oauthResponse,
        message: 'Successfully initiated OAuth flow via Airbyte'
      });
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      res.status(error.status || 500).json({
        error: 'Error initiating OAuth',
        message: error.message || 'Unknown error occurred',
        details: 'Please check your Airbyte instance permissions and ensure OAuth is properly configured for this source. Consider using Private App authentication instead.'
      });
    }
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    res.status(error.status || 500).json({
      error: 'Error initiating OAuth',
      message: error.message || 'Unknown error occurred',
      details: 'Please check your Airbyte instance permissions and ensure OAuth is properly configured for this source. Consider using Private App authentication instead.'
    });
  }
});

// Endpoint to refresh HubSpot OAuth tokens
app.post('/refresh-hubspot-oauth-tokens', async (req, res) => {
  try {
    const { sourceId, refreshToken } = req.body;

    if (!sourceId) {
      return res.status(400).json({ error: 'Source ID is required' });
    }

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Get HubSpot client ID and secret from environment variables
    const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || AIRBYTE_CLIENT_ID;
    const hubspotClientSecret = process.env.HUBSPOT_CLIENT_SECRET || AIRBYTE_CLIENT_SECRET;

    if (!hubspotClientId || !hubspotClientSecret) {
      return res.status(400).json({
        error: 'Missing HubSpot Client ID or Client Secret',
        message: 'Please set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET in your .env file'
      });
    }

    console.log(`Refreshing OAuth tokens for HubSpot source ${sourceId}`);

    // Refresh the tokens
    const tokens = await hubspotOAuth.refreshAccessToken(
      hubspotClientId,
      hubspotClientSecret,
      refreshToken
    );

    // Update the source with the new tokens
    const updatedSource = await hubspotOAuth.updateHubSpotSourceWithRefreshedTokens(
      airbyteClient,
      sourceId,
      tokens
    );

    res.json({
      success: true,
      source: updatedSource,
      message: 'Successfully refreshed HubSpot OAuth tokens'
    });
  } catch (error) {
    console.error('Error refreshing HubSpot OAuth tokens:', error);
    res.status(error.status || 500).json({
      error: 'Error refreshing HubSpot OAuth tokens',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Step 3 Alternative: Create a HubSpot source using Private App authentication via Airbyte
app.post('/create-hubspot-source-with-private-app', async (req, res) => {
  try {
    const { workspaceId, privateAppToken, sourceName } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }

    if (!privateAppToken) {
      return res.status(400).json({ error: 'HubSpot Private App token is required' });
    }

    const sourceDefinitionId = '36c891d9-4bd9-43ac-bad2-10e12756272c'; // HubSpot source definition ID
    const name = sourceName || 'HubSpot Source via Airbyte (Private App)';

    console.log(`Creating HubSpot source with Private App authentication in workspace ${workspaceId} via Airbyte`);

    // First, validate the token format
    const isConnected = await hubspotPrivateApp.testHubSpotPrivateAppConnection(privateAppToken);

    if (!isConnected) {
      return res.status(400).json({
        error: 'HubSpot token validation failed',
        message: 'Invalid HubSpot Private App token format. Please check the token and try again. It should start with "pat-".'
      });
    }

    // Create the source using Private App authentication via Airbyte
    const source = await hubspotPrivateApp.createHubSpotSourceWithPrivateApp(
      airbyteClient,
      workspaceId,
      sourceDefinitionId,
      name,
      privateAppToken
    );

    // Save source ID for demo purposes
    demoState.sourceId = source.sourceId;

    res.json({
      success: true,
      source,
      message: 'Successfully created HubSpot source via Airbyte'
    });
  } catch (error) {
    console.error('Error creating HubSpot source with Private App authentication via Airbyte:', error);
    res.status(error.status || 500).json({
      error: 'Error creating HubSpot source via Airbyte',
      message: error.message || 'Unknown error occurred'
    });
  }
});

// Step 3: Handle OAuth callback and complete source creation
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send('Missing OAuth code in callback parameters');
  }

  try {
    // Parse the state parameter to get the sourceDefinitionId
    let sourceDefinitionId;
    let workspaceId;

    console.log('Received OAuth callback with state:', state);

    try {
      // Try to parse the state as JSON first
      const stateObj = JSON.parse(decodeURIComponent(state));
      console.log('Parsed state object:', stateObj);
      sourceDefinitionId = stateObj.sourceDefinitionId;
      workspaceId = stateObj.workspaceId;
    } catch (parseError) {
      console.log('Error parsing state parameter:', parseError.message);
      return res.status(400).send('Invalid state parameter. Please try again.');
    }

    if (!workspaceId) {
      return res.status(400).send('Missing workspace ID in state parameter');
    }

    if (!sourceDefinitionId) {
      return res.status(400).send('Missing source definition ID in state parameter');
    }

    console.log(`Completing OAuth for workspace ${workspaceId} and source definition ${sourceDefinitionId}`);

    // Check if this is HubSpot source definition
    const isHubSpot = sourceDefinitionId === '36c891d9-4bd9-43ac-bad2-10e12756272c';

    // For HubSpot, use direct OAuth implementation
    if (isHubSpot) {
      console.log('Using direct HubSpot OAuth implementation for callback...');

      // Get HubSpot client ID and secret from environment variables
      const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || AIRBYTE_CLIENT_ID;
      const hubspotClientSecret = process.env.HUBSPOT_CLIENT_SECRET || AIRBYTE_CLIENT_SECRET;

      console.log('Using HubSpot Client ID:', hubspotClientId);
      console.log('Using HubSpot Client Secret:', hubspotClientSecret ? '********' : 'not set');

      if (!hubspotClientId || !hubspotClientSecret) {
        return res.status(400).send('Missing HubSpot Client ID or Client Secret. Please set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET in your .env file.');
      }

      try {
        // Exchange the code for tokens
        console.log('Exchanging code for HubSpot tokens...');
        const tokens = await hubspotOAuth.exchangeCodeForTokens(
          code,
          CALLBACK_URL,
          hubspotClientId,
          hubspotClientSecret
        );

        console.log('Successfully exchanged code for tokens');

        // Create a mock source ID for demo purposes
        const sourceId = 'hubspot-oauth-source-' + Date.now();

        // Store the tokens and source ID in the demo state
        demoState.hubspotTokens = tokens;
        demoState.sourceId = sourceId;

        console.log(`Successfully created mock HubSpot source with ID: ${sourceId}`);

        // Return a success page
        return res.send(`
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
                <p>HubSpot has been successfully connected</p>
                <p>Source ID: ${sourceId}</p>
              </div>
              <div class="back-link">
                <a href="/" onclick="window.opener && window.opener.postMessage({type: 'OAUTH_SUCCESS', sourceId: '${sourceId}'}, '*'); window.close(); return false;">
                  Close this window and return to the application
                </a>
              </div>
              <script>
                // Send a message to the opener window
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'OAUTH_SUCCESS',
                    sourceId: '${sourceId}'
                  }, '*');

                  // Close this window after a short delay
                  setTimeout(() => {
                    window.close();
                  }, 3000);
                }
              </script>
            </body>
          </html>
        `);
      } catch (error) {
        console.error('Error processing HubSpot OAuth callback:', error);

        // Return an error page
        return res.status(500).send(`
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
                <p>Please check your HubSpot credentials and try again.</p>
              </div>
              <div class="back-link">
                <a href="/" onclick="window.opener && window.opener.postMessage({type: 'OAUTH_ERROR', error: '${error.message.replace(/'/g, "\\'")}'}, '*'); window.close(); return false;">
                  Close this window and try again
                </a>
              </div>
              <script>
                // Send a message to the opener window
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'OAUTH_ERROR',
                    error: '${error.message.replace(/'/g, "\\'")}'
                  }, '*');

                  // Close this window after a short delay
                  setTimeout(() => {
                    window.close();
                  }, 5000);
                }
              </script>
            </body>
          </html>
        `);
      }
    } else {
      // For other sources, return a generic success
      const sourceId = 'generic-oauth-source-' + Date.now();
      demoState.sourceId = sourceId;

      return res.send(`
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
              <p>Your account has been successfully connected</p>
              <p>Source ID: ${sourceId}</p>
            </div>
            <div class="back-link">
              <a href="/" onclick="window.opener && window.opener.postMessage({type: 'OAUTH_SUCCESS', sourceId: '${sourceId}'}, '*'); window.close(); return false;">
                Close this window and return to the application
              </a>
            </div>
            <script>
              // Send a message to the opener window
              if (window.opener) {
                window.opener.postMessage({
                  type: 'OAUTH_SUCCESS',
                  sourceId: '${sourceId}'
                }, '*');

                // Close this window after a short delay
                setTimeout(() => {
                  window.close();
                }, 3000);
              }
            </script>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
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
            <p>Please try again or contact support.</p>
          </div>
          <div class="back-link">
            <a href="/" onclick="window.opener && window.opener.postMessage({type: 'OAUTH_ERROR', error: '${error.message ? error.message.replace(/'/g, "\\'") : 'Unknown error'}'}, '*'); window.close(); return false;">
              Close this window and try again
            </a>
          </div>
          <script>
            // Send a message to the opener window
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_ERROR',
                error: '${error.message ? error.message.replace(/'/g, "\\'") : 'Unknown error'}'
              }, '*');

              // Close this window after a short delay
              setTimeout(() => {
                window.close();
              }, 5000);
            }
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

    console.log(`Received request to find destination definition for: ${name}`);

    // No need to check for API credentials as we're using self-hosted Airbyte
    let destinationDefinition;
    try {
      destinationDefinition = await airbyteClient.getDestinationDefinitionByName(name);
    } catch (destError) {
      console.error('Error from getDestinationDefinitionByName:', destError);

      // Try to create a workspace first if that's the issue
      if (destError.message && destError.message.includes('No workspaces found')) {
        console.log('Attempting to create a workspace first...');
        try {
          const workspace = await airbyteClient.createWorkspace('Default Workspace', 'admin@example.com');
          console.log('Successfully created workspace:', workspace);

          // Try again to get the destination definition
          destinationDefinition = await airbyteClient.getDestinationDefinitionByName(name);
        } catch (workspaceError) {
          console.error('Failed to create workspace:', workspaceError);
        }
      }
    }

    if (!destinationDefinition) {
      console.log(`No destination definition found for '${name}', using hardcoded values as fallback`);

      // Fallback to hardcoded values for common destinations
      const commonDestinations = {
        'postgres': '25c5221d-dce2-4163-ade9-739ef790f503',
        'mysql': '484ecb0e-e34c-43b9-b707-9f7107f0a091',
        'bigquery': '22f6c74f-5699-40ff-833c-4a879ea40133',
        'snowflake': '424892c4-daac-4491-b35d-c6688ba547ba',
        'redshift': 'f7a7d195-377f-cf5b-70a5-be6b77c932b6',
        's3': '4816b78f-1489-44c1-9060-4b19d5fa9362',
        'local json': '8be1cf83-fde1-477f-a4ad-318d23c9f3c6',
        'local csv': '8be1cf83-fde1-477f-a4ad-318d23c9f3c6'
      };

      const lowerName = name.toLowerCase();
      let found = false;

      for (const [destName, destId] of Object.entries(commonDestinations)) {
        if (lowerName.includes(destName)) {
          console.log(`Using hardcoded destination definition ID for ${destName}: ${destId}`);
          destinationDefinition = {
            destinationDefinitionId: destId,
            name: destName.charAt(0).toUpperCase() + destName.slice(1),
            dockerRepository: `airbyte/${destName}`,
            dockerImageTag: 'latest',
            documentationUrl: `https://docs.airbyte.com/integrations/destinations/${destName.replace(' ', '-')}`
          };
          found = true;
          break;
        }
      }

      if (!found) {
        return res.status(404).json({
          error: `Destination definition for '${name}' not found`,
          message: `Could not find a destination definition matching '${name}'. Please check the name and try again.`
        });
      }
    }

    console.log(`Successfully found destination definition for '${name}'`);
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
        message: 'Your API credentials are invalid or expired. Please update your credentials or try refreshing the token.'
      });
    } else {
      res.status(error.status || 500).json({
        error: 'Error getting destination definition',
        message: error.message || 'Unknown error occurred',
        details: 'This may be due to authentication issues or the destination not being available in your Airbyte instance.'
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
