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
const port = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Airbyte API credentials
const AIRBYTE_EMAIL = 'goncalo.p.gomes@gmail.com';
const AIRBYTE_PASSWORD = '32bTEN4EvQtGruOxMLCrn6Ai17zHYMS7';
const AIRBYTE_CLIENT_ID = '68eb3177-2afb-44da-851d-a9deb0bb9364';
const AIRBYTE_CLIENT_SECRET = 'AKS7gtga3Sw1HSRI65KtauGPPaeKf0Ju';
// Token generated from the Airbyte UI
const AIRBYTE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vYWlyYnl0ZS1hYmN0bC1haXJieXRlLXdlYmFwcC1zdmM6ODAiLCJhdWQiOiJhaXJieXRlLXNlcnZlciIsInN1YiI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImV4cCI6MTc0NTczMDk4MSwicm9sZXMiOlsiQVVUSEVOVElDQVRFRF9VU0VSIiwiUkVBREVSIiwiRURJVE9SIiwiQURNSU4iLCJXT1JLU1BBQ0VfUkVBREVSIiwiV09SS1NQQUNFX1JVTk5FUiIsIldPUktTUEFDRV9FRElUT1IiLCJXT1JLU1BBQ0VfQURNSU4iLCJPUkdBTklaQVRJT05fTUVNQkVSIiwiT1JHQU5JWkFUSU9OX1JFQURFUiIsIk9SR0FOSVpBVElPTl9SVU5ORVIiLCJPUkdBTklaQVRJT05fRURJVE9SIiwiT1JHQU5JWkFUSU9OX0FETUlOIl19.jcgaMw3S2grqGSnOI4_Be3qbY065h1xfmLIxTcZPIBo';

console.log('Using self-hosted Airbyte instance at http://scuver.services:8000');

// Create an instance of our Airbyte client with the correct API path for OSS users
const airbyteClient = new AirbyteClient({
  // Always use api/public/v1 for self-hosted Airbyte
  apiUrl: 'http://scuver.services:8000/api/public/v1',
  clientId: AIRBYTE_CLIENT_ID,
  clientSecret: AIRBYTE_CLIENT_SECRET,
  email: AIRBYTE_EMAIL,
  password: AIRBYTE_PASSWORD,
  token: AIRBYTE_TOKEN
});

console.log('Using token-based authentication with a token generated from the Airbyte UI');

// Stores created resources for the demo
const demoState = {
  workspaceId: null,
  sourceId: null,
  destinationId: null,
  connectionId: null
};

// For OAuth callbacks
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3002/oauth/callback';

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

    console.log(`Received request to find source definition for: ${name}`);

    // No need to check for API credentials as we're using self-hosted Airbyte
    let sourceDefinition;
    try {
      sourceDefinition = await airbyteClient.getSourceDefinitionByName(name);
    } catch (sourceError) {
      console.error('Error from getSourceDefinitionByName:', sourceError);

      // Try to create a workspace first if that's the issue
      if (sourceError.message && sourceError.message.includes('No workspaces found')) {
        console.log('Attempting to create a workspace first...');
        try {
          const workspace = await airbyteClient.createWorkspace('Default Workspace', 'admin@example.com');
          console.log('Successfully created workspace:', workspace);

          // Try again to get the source definition
          sourceDefinition = await airbyteClient.getSourceDefinitionByName(name);
        } catch (workspaceError) {
          console.error('Failed to create workspace:', workspaceError);
        }
      }
    }

    if (!sourceDefinition) {
      console.log(`No source definition found for '${name}', using hardcoded values as fallback`);

      // Fallback to hardcoded values for common sources
      const commonSources = {
        'hubspot': '36c891d9-4bd9-43ac-bad2-10e12756272c',
        'postgres': 'decd338e-5647-4c0b-adf4-da0e75f5a750',
        'mysql': '435bb9a5-7887-4809-aa58-28c27df0d7ad',
        'google sheets': '71607ba1-c0ac-4799-8049-7f4b90dd50f7',
        'file': '778daa7c-feaf-4db6-96f3-70fd645acc77',
        'stripe': 'e3cb2095-f5ef-4c9c-94a1-69e8f7fa2dfe',
        'salesforce': '2470e835-feaf-4db6-96f3-70fd645acc77',
        'shopify': '9da77001-af33-4bcd-be46-6252bf9342b9'
      };

      const lowerName = name.toLowerCase();
      let found = false;

      for (const [sourceName, sourceId] of Object.entries(commonSources)) {
        if (lowerName.includes(sourceName)) {
          console.log(`Using hardcoded source definition ID for ${sourceName}: ${sourceId}`);
          sourceDefinition = {
            sourceDefinitionId: sourceId,
            name: sourceName.charAt(0).toUpperCase() + sourceName.slice(1),
            dockerRepository: `airbyte/${sourceName}`,
            dockerImageTag: 'latest',
            documentationUrl: `https://docs.airbyte.com/integrations/sources/${sourceName}`
          };
          found = true;
          break;
        }
      }

      if (!found) {
        return res.status(404).json({
          error: `Source definition for '${name}' not found`,
          message: `Could not find a source definition matching '${name}'. Please check the name and try again.`
        });
      }
    }

    console.log(`Successfully found source definition for '${name}'`);
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
        message: 'Your API credentials are invalid or expired. Please update your credentials or try refreshing the token.'
      });
    } else {
      res.status(error.status || 500).json({
        error: 'Error getting source definition',
        message: error.message || 'Unknown error occurred',
        details: 'This may be due to authentication issues or the source not being available in your Airbyte instance.'
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

    console.log(`Initiating OAuth for workspace ${workspaceId} and source definition ${sourceDefinitionId}`);

    // Check if this is HubSpot source definition
    const isHubSpot = sourceDefinitionId === '36c891d9-4bd9-43ac-bad2-10e12756272c';

    // For HubSpot, use OAuth implementation via Airbyte
    if (isHubSpot) {
      console.log('Using HubSpot OAuth implementation via Airbyte...');

      // Get HubSpot client ID from environment variables
      const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || AIRBYTE_CLIENT_ID;

      if (!hubspotClientId) {
        return res.status(400).json({
          error: 'HubSpot Client ID is required',
          message: 'Please set HUBSPOT_CLIENT_ID in your .env file'
        });
      }

      // Generate HubSpot OAuth URL
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
        message: 'Successfully initiated HubSpot OAuth flow via Airbyte'
      });
    }

    // For other sources, try multiple approaches to initiate OAuth
    let oauthResponse;
    let error;

    // Approach 1: Try the Airbyte client's initiateOAuth method
    try {
      console.log('Trying Airbyte client initiateOAuth method...');
      oauthResponse = await airbyteClient.initiateOAuth(
        workspaceId,
        sourceDefinitionId,
        CALLBACK_URL
      );
    } catch (err1) {
      console.log('Airbyte client initiateOAuth method failed:', err1.message);
      error = err1;

      // Approach 2: Try direct API calls with different endpoint formats
      try {
        console.log('Trying direct API calls with different endpoint formats...');
        const fetch = await import('node-fetch');

        // Try multiple endpoint formats
        const endpoints = [
          `/sources/initiate_oauth`,
          `/v1/sources/initiate_oauth`,
          `/workspaces/${workspaceId}/sources/initiate_oauth`,
          `/source_definitions/${sourceDefinitionId}/oauth/parameter_specifications`,
          `/source_definitions/${sourceDefinitionId}/oauth/consent_url`
        ];

        for (const endpoint of endpoints) {
          try {
            console.log(`Trying endpoint: ${endpoint}`);

            // Determine if this is a GET or POST request
            const isGet = endpoint.includes('parameter_specifications');

            const url = `${airbyteClient.apiUrl}${endpoint}`;
            const options = {
              method: isGet ? 'GET' : 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            };

            // Add body for POST requests
            if (!isGet) {
              options.body = JSON.stringify({
                workspaceId,
                sourceDefinitionId,
                redirectUrl: CALLBACK_URL,
                oauthInputConfiguration: {
                  scopes: [
                    "crm.objects.contacts.read",
                    "crm.objects.companies.read",
                    "crm.objects.deals.read",
                    "crm.schemas.deals.read",
                    "crm.schemas.companies.read",
                    "content",
                    "crm.lists.read",
                    "forms",
                    "tickets",
                    "e-commerce",
                    "sales-email-read",
                    "automation"
                  ]
                }
              });
            }

            console.log(`Making direct request to: ${url}`);
            const directResponse = await fetch.default(url, options);

            if (directResponse.ok) {
              const data = await directResponse.json();
              console.log(`Direct API call to ${endpoint} successful!`);

              // If this is the parameter specifications endpoint, use it to get the consent URL
              if (isGet && endpoint.includes('parameter_specifications')) {
                console.log('Got parameter specifications, getting consent URL...');

                const consentUrl = `${airbyteClient.apiUrl}/source_definitions/${sourceDefinitionId}/oauth/consent_url`;
                const consentOptions = {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    workspaceId,
                    redirectUrl: CALLBACK_URL,
                    oauthInputConfiguration: {
                      scopes: [
                        "crm.objects.contacts.read",
                        "crm.objects.companies.read",
                        "crm.objects.deals.read",
                        "crm.schemas.deals.read",
                        "crm.schemas.companies.read",
                        "content",
                        "crm.lists.read",
                        "forms",
                        "tickets",
                        "e-commerce",
                        "sales-email-read",
                        "automation"
                      ]
                    }
                  })
                };

                const consentResponse = await fetch.default(consentUrl, consentOptions);

                if (consentResponse.ok) {
                  const consentData = await consentResponse.json();
                  oauthResponse = consentData;
                  break;
                }
              } else {
                oauthResponse = data;
                break;
              }
            } else {
              console.log(`Direct API call to ${endpoint} failed: ${directResponse.status} ${directResponse.statusText}`);
            }
          } catch (endpointError) {
            console.log(`Error with endpoint ${endpoint}:`, endpointError.message);
          }
        }

        if (!oauthResponse) {
          throw new Error('All direct API calls failed');
        }
      } catch (err2) {
        console.log('Direct API calls failed:', err2.message);

        // If all approaches fail, throw the original error
        throw error;
      }
    }

    res.json({
      success: true,
      consentUrl: oauthResponse.authorizationUrl || oauthResponse.redirectUrl,
      oauthResponse
    });
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
  const workspaceId = req.query.workspaceId || demoState.workspaceId;
  const sourceName = req.query.sourceName || 'Source from OAuth';

  if (!code) {
    return res.status(400).send('Missing OAuth code in callback parameters');
  }

  if (!workspaceId) {
    return res.status(400).send('Missing workspace ID. Please create a workspace first.');
  }

  try {
    // Parse the state parameter to get the sourceDefinitionId
    let sourceDefinitionId;
    try {
      // Try to parse the state as JSON first
      const stateObj = JSON.parse(decodeURIComponent(state));
      sourceDefinitionId = stateObj.sourceDefinitionId;
    } catch (parseError) {
      // If parsing fails, use the state directly or fall back to the query parameter
      sourceDefinitionId = req.query.sourceDefinitionId || state;
    }

    if (!sourceDefinitionId) {
      return res.status(400).send('Missing source definition ID in callback state');
    }

    console.log(`Completing OAuth for workspace ${workspaceId} and source definition ${sourceDefinitionId}`);

    // Check if this is HubSpot source definition
    const isHubSpot = sourceDefinitionId === '36c891d9-4bd9-43ac-bad2-10e12756272c';

    let sourceResponse;

    // For HubSpot, use OAuth implementation via Airbyte
    if (isHubSpot) {
      console.log('Using HubSpot OAuth implementation via Airbyte for callback...');

      // Get HubSpot client ID and secret from environment variables
      const hubspotClientId = process.env.HUBSPOT_CLIENT_ID || AIRBYTE_CLIENT_ID;
      const hubspotClientSecret = process.env.HUBSPOT_CLIENT_SECRET || AIRBYTE_CLIENT_SECRET;

      if (!hubspotClientId || !hubspotClientSecret) {
        return res.status(400).send('Missing HubSpot Client ID or Client Secret. Please set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET in your .env file.');
      }

      try {
        // Exchange the code for tokens
        console.log('Exchanging code for HubSpot tokens...');
        const tokens = await hubspotOAuth.exchangeCodeForTokens(
          hubspotClientId,
          hubspotClientSecret,
          CALLBACK_URL,
          code
        );

        console.log('Successfully exchanged code for tokens');

        // Create the source using the tokens via Airbyte
        sourceResponse = await hubspotOAuth.createHubSpotSourceWithOAuth(
          airbyteClient,
          workspaceId,
          sourceDefinitionId,
          `HubSpot Source via Airbyte (OAuth)`,
          tokens
        );

        console.log('Successfully created HubSpot source with OAuth via Airbyte');
      } catch (hubspotError) {
        console.error('Error with HubSpot OAuth via Airbyte:', hubspotError);
        throw hubspotError;
      }
    } else {
      // For other sources, try multiple approaches to complete OAuth
      let error;

      // Approach 1: Try the Airbyte client's completeOAuth method
      try {
        console.log('Trying Airbyte client completeOAuth method...');
        sourceResponse = await airbyteClient.completeOAuth(
          workspaceId,
          sourceDefinitionId,
          CALLBACK_URL,
          { code, state },
          sourceName,
          { start_date: new Date().toISOString().split('T')[0] } // Use today as start date
        );
      } catch (err1) {
        console.log('Airbyte client completeOAuth method failed:', err1.message);
        error = err1;

        // Approach 2: Try direct API calls with different endpoint formats
        try {
          console.log('Trying direct API calls with different endpoint formats...');
          const fetch = await import('node-fetch');

          // Try multiple endpoint formats
          const endpoints = [
            `/sources/complete_oauth`,
            `/v1/sources/complete_oauth`,
            `/workspaces/${workspaceId}/sources/complete_oauth`,
            `/source_definitions/${sourceDefinitionId}/oauth/complete`
          ];

          for (const endpoint of endpoints) {
            try {
              console.log(`Trying endpoint: ${endpoint}`);

              const url = `${airbyteClient.apiUrl}${endpoint}`;
              const options = {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  workspaceId,
                  sourceDefinitionId,
                  redirectUrl: CALLBACK_URL,
                  queryParams: { code, state },
                  sourceName,
                  oAuthInputConfiguration: {
                    start_date: new Date().toISOString().split('T')[0]
                  }
                })
              };

              console.log(`Making direct request to: ${url}`);
              const directResponse = await fetch.default(url, options);

              if (directResponse.ok) {
                sourceResponse = await directResponse.json();
                console.log(`Direct API call to ${endpoint} successful!`);
                break;
              } else {
                console.log(`Direct API call to ${endpoint} failed: ${directResponse.status} ${directResponse.statusText}`);
              }
            } catch (endpointError) {
              console.log(`Error with endpoint ${endpoint}:`, endpointError.message);
            }
          }

          // If all endpoint attempts fail, try to create the source directly
          if (!sourceResponse) {
            console.log('All endpoint attempts failed, trying to create source directly...');

            // Create a source configuration with the OAuth code
            const sourceConfig = {
              credentials: {
                credentials_title: "OAuth Credentials",
                oauth_code: code,
                redirect_uri: CALLBACK_URL
              },
              start_date: new Date().toISOString().split('T')[0]
            };

            // Try to create the source directly
            try {
              const url = `${airbyteClient.apiUrl}/sources`;
              const options = {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  workspaceId,
                  sourceDefinitionId,
                  name: sourceName,
                  connectionConfiguration: sourceConfig
                })
              };

              // Try with basic auth if available
              if (airbyteClient.email && airbyteClient.password) {
                const base64Credentials = Buffer.from(`${airbyteClient.email}:${airbyteClient.password}`).toString('base64');
                options.headers['Authorization'] = `Basic ${base64Credentials}`;
              }

              console.log(`Making direct request to create source: ${url}`);
              const directResponse = await fetch.default(url, options);

              if (directResponse.ok) {
                sourceResponse = await directResponse.json();
                console.log('Direct source creation successful!');
              } else {
                console.log(`Direct source creation failed: ${directResponse.status} ${directResponse.statusText}`);
                throw new Error('Direct source creation failed');
              }
            } catch (directError) {
              console.log('Direct source creation failed, trying standard method...');

              // Fall back to the standard createSource method
              sourceResponse = await airbyteClient.createSource(
                workspaceId,
                sourceDefinitionId,
                sourceName,
                sourceConfig
              );
            }
          }
        } catch (err2) {
          console.log('Direct API calls failed:', err2.message);

          // If all approaches fail, throw the original error
          throw error;
        }
      }
    }

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
            <p>Please check your Airbyte instance permissions and ensure OAuth is properly configured for this source.</p>
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
