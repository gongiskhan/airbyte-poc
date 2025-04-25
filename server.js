const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Replace these with your values
const AIRBYTE_API_URL = 'https://cloud.airbyte.com/api/public/v1';
const AIRBYTE_BASE_URL = 'https://cloud.airbyte.com';
// Client ID and Client Secret from Airbyte Cloud Settings -> Account -> Applications
const AIRBYTE_CLIENT_ID = '0e24cc41-494a-46e6-a50d-9a4a939d268f';
const AIRBYTE_CLIENT_SECRET = 'uIo9WQfdRzyW3S3iz3AfHEG5TZAKtOLh'; // Fill in your client secret here
const WORKSPACE_ID = '4d5797d1-a0f5-4cac-95f5-6756f6ebc9e3';

// This is the callback URL used by HubSpot OAuth
const CALLBACK_URL = 'http://localhost:3000/oauth/callback';

let createdSourceId = null;
let accessToken = null;
let tokenExpiration = null;

// Helper function to get fetch
async function getFetch() {
  return (await import('node-fetch')).default;
}

// Helper function to get a valid Airbyte access token
async function getAccessToken() {
  const now = new Date();
  
  // If we have a valid token that's not expired (or expires in more than 30 seconds), use it
  if (accessToken && tokenExpiration && tokenExpiration > new Date(now.getTime() + 30000)) {
    return accessToken;
  }
  
  // Otherwise, request a new token
  try {
    const fetch = await getFetch();
    const response = await fetch(`${AIRBYTE_BASE_URL}/api/v1/applications/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: AIRBYTE_CLIENT_ID,
        client_secret: AIRBYTE_CLIENT_SECRET,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error getting access token:', errorData);
      throw new Error(`Failed to get access token: ${errorData.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    accessToken = data.access_token;
    
    // Token is valid for 3 minutes (180 seconds)
    tokenExpiration = new Date(now.getTime() + 180000);
    
    return accessToken;
  } catch (error) {
    console.error('Error fetching access token:', error);
    throw error;
  }
}

// Helper function to get the HubSpot source definition ID
async function getHubspotSourceDefinitionId() {
  try {
    const token = await getAccessToken();
    const fetch = await getFetch();
    const response = await fetch(`${AIRBYTE_API_URL}/source_definitions/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error fetching source definitions:', errorData);
      return null;
    }
    
    const data = await response.json();
    const hubspotSource = data.sourceDefinitions.find(def => 
      def.name.toLowerCase().includes('hubspot')
    );
    
    return hubspotSource ? hubspotSource.sourceDefinitionId : null;
  } catch (error) {
    console.error('Error fetching source definition ID:', error);
    return null;
  }
}

// Step 1 - Initiate the OAuth flow
app.post('/start-hubspot-connection', async (req, res) => {
  try {
    const token = await getAccessToken();
    const fetch = await getFetch();
    
    // First, check if the API key is valid
    const checkResponse = await fetch(`${AIRBYTE_API_URL}/workspaces/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
      }),
    });
    
    if (!checkResponse.ok) {
      const errorData = await checkResponse.json();
      console.error('API key validation failed:', errorData);
      
      let errorMessage = 'API key validation failed';
      
      // Check for specific error types
      if (errorData.message && errorData.message.includes('Unauthorized')) {
        errorMessage = 'Your API key is invalid or has expired. Please generate a new API key in Airbyte Cloud.';
      } else if (errorData.message && errorData.message.includes('not found')) {
        errorMessage = 'Workspace not found. Please check your workspace ID.';
      }
      
      return res.status(401).json({ 
        error: errorMessage,
        details: errorData.message || 'Invalid or expired API key',
        hint: "You need to generate a new API key in Airbyte Cloud. Go to Settings > Account > Applications"
      });
    }
    
    const sourceDefinitionId = await getHubspotSourceDefinitionId();

    if (!sourceDefinitionId) {
      console.error('HubSpot source definition not found');
      return res.status(500).json({ 
        error: 'HubSpot source definition not found',
        message: 'Unable to find HubSpot in the available source definitions. Please check your Airbyte workspace.'
      });
    }

    console.log(`Initiating OAuth flow with sourceDefinitionId: ${sourceDefinitionId}`);
    
    const resp = await fetch(`${AIRBYTE_API_URL}/sources/initiate_oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        sourceDefinitionId: sourceDefinitionId,
        redirectUrl: CALLBACK_URL,
      }),
    });

    const data = await resp.json();
    console.log('OAuth initiation response:', JSON.stringify(data, null, 2));
    
    if (!resp.ok) {
      console.error('API error:', data);
      return res.status(resp.status).json({ 
        error: 'Failed to initiate OAuth flow', 
        details: data.message || 'Unknown error occurred',
        fullResponse: data
      });
    }
    
    // Check which property contains the redirect URL based on API response
    let redirectUrl;
    if (data.authorizationUrl) {
      redirectUrl = data.authorizationUrl;
    } else if (data.redirectUrl) {
      redirectUrl = data.redirectUrl;
    } else {
      console.error('Redirect URL not found in response:', data);
      return res.status(500).json({ error: 'No redirect URL found in API response' });
    }
    
    res.json({ consentUrl: redirectUrl });
  } catch (error) {
    console.error('Error initiating OAuth flow:', error);
    res.status(500).json({ 
      error: 'Error initiating OAuth flow',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Step 2: Handle OAuth callback
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    console.error('Missing code in callback request');
    return res.status(400).send('Missing code in query parameters.');
  }

  try {
    const token = await getAccessToken();
    const fetch = await getFetch();
    const sourceDefinitionId = await getHubspotSourceDefinitionId();

    if (!sourceDefinitionId) {
      console.error('HubSpot source definition not found');
      return res.status(500).send('HubSpot source definition not found.');
    }

    console.log(`Creating HubSpot source with code: ${code.substring(0, 10)}...`);
    
    // Step 3: Complete the OAuth process
    const response = await fetch(`${AIRBYTE_API_URL}/sources/complete_oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        sourceDefinitionId: sourceDefinitionId,
        redirectUrl: CALLBACK_URL,
        queryParams: {
          code,
          state,
        },
        oAuthInputConfiguration: {
          start_date: '2021-01-01T00:00:00Z',
        },
        sourceName: 'HubSpot Source',
      }),
    });

    const data = await response.json();
    console.log('Source creation response:', JSON.stringify(data, null, 2));
    
    if (!response.ok) {
      console.error('API error creating source:', data);
      return res.status(response.status).send(`Error creating source: ${data.message || 'Unknown error'}`);
    }
    
    createdSourceId = data.sourceId;
    res.send(`<h1>HubSpot Connection Successful!</h1><p>Source ID: ${createdSourceId}</p>`);
  } catch (error) {
    console.error('Error creating source:', error);
    res.status(500).send(`Error creating source: ${error.message}`);
  }
});

// Add a test connection endpoint to verify the API key
app.post('/test-connection', async (req, res) => {
  try {
    const token = await getAccessToken();
    const fetch = await getFetch();
    
    // First check if we can list workspaces at all
    const workspacesResponse = await fetch(`${AIRBYTE_API_URL}/workspaces/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    
    if (!workspacesResponse.ok) {
      const errorData = await workspacesResponse.json();
      console.error('Failed to list workspaces:', errorData);
      
      if (errorData.message && errorData.message.includes('Forbidden')) {
        return res.status(403).json({ 
          error: 'Permission denied',
          details: 'Your account does not have access to any workspaces in Airbyte.',
          message: 'The application was authenticated successfully but lacks permissions to access workspaces.',
          hint: "Make sure the user who created the application has proper workspace access. You may need to create a new workspace and update the workspace ID."
        });
      }
      
      return res.status(401).json({ 
        error: 'Failed to list workspaces',
        details: errorData.message,
        hint: "There may be an issue with your Airbyte account permissions."
      });
    }
    
    // If we can list workspaces, check if we can access the specific workspace
    const workspacesData = await workspacesResponse.json();
    const workspaces = workspacesData.workspaces || [];
    const targetWorkspaceExists = workspaces.some(ws => ws.workspaceId === WORKSPACE_ID);
    
    if (!targetWorkspaceExists) {
      return res.status(404).json({ 
        error: 'Workspace not found',
        details: `The configured workspace ID (${WORKSPACE_ID}) was not found in your accessible workspaces.`,
        availableWorkspaces: workspaces.map(ws => ({
          id: ws.workspaceId,
          name: ws.name
        })),
        hint: "Update the WORKSPACE_ID in server.js to match one of your accessible workspaces"
      });
    }
    
    // Now check if we can access the specific workspace
    const checkResponse = await fetch(`${AIRBYTE_API_URL}/workspaces/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
      }),
    });
    
    if (!checkResponse.ok) {
      const errorData = await checkResponse.json();
      console.error('API key validation failed:', errorData);
      
      let errorMessage = 'API key validation failed';
      let statusCode = 401;
      
      // Check for specific error types
      if (errorData.message && errorData.message.includes('Forbidden')) {
        errorMessage = 'Your account has insufficient permissions for this workspace.';
        statusCode = 403;
        return res.status(statusCode).json({ 
          error: errorMessage,
          details: errorData.message,
          hint: "The application was authenticated but lacks permissions for this specific workspace. Try using a different workspace ID from your available workspaces."
        });
      } else if (errorData.message && errorData.message.includes('not found')) {
        errorMessage = 'Workspace not found. Please check your workspace ID.';
        statusCode = 404;
      }
      
      return res.status(statusCode).json({ 
        error: errorMessage,
        details: errorData.message,
        hint: "You need to update the workspace ID to one that your account has access to."
      });
    }
    
    // API key is valid!
    const workspaceData = await checkResponse.json();
    res.json({ 
      success: true, 
      message: 'Connection to Airbyte API successful',
      workspace: {
        id: workspaceData.workspaceId,
        name: workspaceData.name
      }
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ 
      error: 'Error testing connection',
      message: error.message
    });
  }
});

// Add a diagnostic API endpoint
app.get('/api-key-debug', async (req, res) => {
  try {
    const fetch = await getFetch();
    
    // Test token generation first
    let tokenTest = {
      status: 'unknown',
      message: 'Not attempted'
    };
    
    try {
      const tokenResponse = await fetch(`${AIRBYTE_BASE_URL}/api/v1/applications/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: AIRBYTE_CLIENT_ID,
          client_secret: AIRBYTE_CLIENT_SECRET,
        }),
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        tokenTest = {
          status: 'success',
          message: 'Successfully generated token',
          token: tokenData.access_token.substring(0, 10) + '...'
        };
        
        // Set the token for the remaining tests
        accessToken = tokenData.access_token;
        tokenExpiration = new Date(new Date().getTime() + 180000); // 3 minutes
      } else {
        const errorData = await tokenResponse.json();
        tokenTest = {
          status: 'error',
          message: 'Failed to generate token',
          details: errorData
        };
      }
    } catch (e) {
      tokenTest = {
        status: 'error',
        message: 'Exception during token generation',
        error: e.message
      };
    }
    
    // List all workspaces to see what we have access to
    let workspaceListTest = {
      status: 'unknown',
      message: 'Not attempted - token generation failed'
    };
    
    if (tokenTest.status === 'success') {
      try {
        const workspaceListResponse = await fetch(`${AIRBYTE_API_URL}/workspaces/list`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({})
        });
        
        if (workspaceListResponse.ok) {
          const workspaceListData = await workspaceListResponse.json();
          workspaceListTest = {
            status: 'success',
            message: 'Successfully listed workspaces',
            workspaces: workspaceListData.workspaces || []
          };
        } else {
          const errorData = await workspaceListResponse.json();
          workspaceListTest = {
            status: 'error',
            message: 'Failed to list workspaces',
            details: errorData
          };
        }
      } catch (e) {
        workspaceListTest = {
          status: 'error',
          message: 'Exception during workspace list',
          error: e.message
        };
      }
    }
    
    // Only continue with other tests if token generation succeeded
    let workspaceTest = {
      status: 'unknown',
      message: 'Not attempted - token generation failed'
    };
    
    let sourceDefinitionsTest = {
      status: 'unknown',
      message: 'Not attempted - token generation failed'
    };
    
    if (tokenTest.status === 'success') {
      // Test workspace access
      try {
        const workspaceResponse = await fetch(`${AIRBYTE_API_URL}/workspaces/get`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
          }),
        });
        
        if (workspaceResponse.ok) {
          const workspaceData = await workspaceResponse.json();
          workspaceTest = {
            status: 'success',
            message: 'Successfully accessed workspace',
            details: {
              id: workspaceData.workspaceId,
              name: workspaceData.name
            }
          };
        } else {
          const errorData = await workspaceResponse.json();
          workspaceTest = {
            status: 'error',
            message: 'Failed to access workspace',
            details: errorData
          };
        }
      } catch (e) {
        workspaceTest = {
          status: 'error',
          message: 'Exception during workspace access',
          error: e.message
        };
      }
      
      // Test source definitions access
      try {
        const sourceDefResponse = await fetch(`${AIRBYTE_API_URL}/source_definitions/list`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: WORKSPACE_ID,
          }),
        });
        
        if (sourceDefResponse.ok) {
          const sourceDefData = await sourceDefResponse.json();
          const hubspotSource = sourceDefData.sourceDefinitions.find(def => 
            def.name.toLowerCase().includes('hubspot')
          );
          
          sourceDefinitionsTest = {
            status: 'success',
            message: 'Successfully accessed source definitions',
            hubspot: hubspotSource ? {
              id: hubspotSource.sourceDefinitionId,
              name: hubspotSource.name
            } : 'Not found'
          };
        } else {
          const errorData = await sourceDefResponse.json();
          sourceDefinitionsTest = {
            status: 'error',
            message: 'Failed to access source definitions',
            details: errorData
          };
        }
      } catch (e) {
        sourceDefinitionsTest = {
          status: 'error',
          message: 'Exception during source definitions access',
          error: e.message
        };
      }
    }
    
    // Information about current setup
    const configInfo = {
      apiUrl: AIRBYTE_API_URL,
      baseUrl: AIRBYTE_BASE_URL,
      workspaceId: WORKSPACE_ID,
      clientId: AIRBYTE_CLIENT_ID,
      clientSecret: AIRBYTE_CLIENT_SECRET ? '********' : 'Not set',
    };
    
    res.json({
      configInfo,
      tests: {
        tokenGeneration: tokenTest,
        workspaceList: workspaceListTest,
        workspaceAccess: workspaceTest,
        sourceDefinitions: sourceDefinitionsTest
      },
      nextSteps: {
        instructions: [
          "1. Go to Airbyte Cloud UI > Settings > Account > Applications",
          "2. Click 'Create an application' and name it (e.g. 'HubSpot Connector')",
          "3. Copy the Client ID and Client Secret",
          "4. Update the AIRBYTE_CLIENT_ID and AIRBYTE_CLIENT_SECRET in server.js",
          "5. If the available workspaces don't include your target workspace, make sure your user account has access to it",
          "6. Update the WORKSPACE_ID in server.js to match one of your accessible workspaces",
          "7. Restart the server and try the connection again"
        ],
        troubleshooting: [
          "• Make sure you're logged into Airbyte Cloud with a user account that has access to the workspace",
          "• The application tokens inherit the permissions of the user who created them",
          "• Check if you need to visit the workspace first to gain access",
          "• If all else fails, try creating a new workspace and use that workspace ID instead"
        ],
        referenceInfo: {
          // Extract workspace ID from the URL for comparison
          workspaceIdFromURL: WORKSPACE_ID,
          message: "The workspace ID in your configuration should match one that you can see in the Airbyte Cloud UI URL when viewing a workspace"
        }
      }
    });
  } catch (error) {
    console.error('Error in API key diagnostic:', error);
    res.status(500).json({ 
      error: 'Error in API key diagnostic',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add a simple workspace ID finder page
app.get('/workspace-finder', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Airbyte Workspace ID Finder</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; line-height: 1.6; }
        .instruction { background: #f0f0f0; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .code { background: #e0e0e0; padding: 8px; border-radius: 3px; font-family: monospace; }
        h1 { color: #333; }
        h2 { color: #555; margin-top: 30px; }
        .important { color: #cc0000; font-weight: bold; }
        ol { margin-left: 20px; }
        .step { margin-bottom: 15px; }
      </style>
    </head>
    <body>
      <h1>Airbyte Workspace ID Finder</h1>
      
      <div class="instruction">
        <p>Based on the debug output, it seems your account doesn't have permission to access the current workspace ID: <span class="code">${WORKSPACE_ID}</span></p>
        <p>To solve this issue, you'll need to either:</p>
        <ol>
          <li>Get access to the existing workspace</li>
          <li>Create a new workspace and use its ID instead</li>
        </ol>
      </div>
      
      <h2>How to find your workspace ID:</h2>
      
      <ol>
        <li class="step">
          <strong>Log in to your Airbyte Cloud account</strong>
        </li>
        
        <li class="step">
          <strong>Go to any page within a workspace</strong>
          <p>For example, the connections page.</p>
        </li>
        
        <li class="step">
          <strong>Look at the URL in your browser</strong>
          <p>The URL should look something like:</p>
          <p class="code">https://cloud.airbyte.com/workspaces/<span class="important">f79251c6-5e07-42d8-a450-9c572d5ec973</span>/connections</p>
          <p>The highlighted part is your workspace ID.</p>
        </li>
        
        <li class="step">
          <strong>Update your server.js file</strong>
          <p>Replace the current WORKSPACE_ID value with your new workspace ID:</p>
          <p class="code">const WORKSPACE_ID = 'your-new-workspace-id';</p>
        </li>
        
        <li class="step">
          <strong>Restart the server and try again</strong>
        </li>
      </ol>
      
      <h2>Creating a new workspace:</h2>
      
      <ol>
        <li class="step">
          <strong>In Airbyte Cloud, look for an option to create a new workspace</strong>
          <p>This might be in a dropdown menu or settings page.</p>
        </li>
        
        <li class="step">
          <strong>After creating the workspace, navigate to it and get the ID from the URL</strong>
        </li>
      </ol>
      
      <p><strong>Note:</strong> The application you created (client ID/secret) is associated with your user account, not a specific workspace. As long as your user has access to the workspace, the application should work with it.</p>
    </body>
    </html>
  `);
});

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
