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
// Get your client_id and client_secret from Airbyte Cloud Settings -> Applications
const AIRBYTE_API_KEY = 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ6Z1BPdmhDSC1Ic21OQnhhV3lnLU11dlF6dHJERTBDSEJHZDB2MVh0Vnk0In0.eyJleHAiOjE3NDU0MzQ1MDEsImlhdCI6MTc0NTQzMzYwMSwianRpIjoiY2ZiYWU0ZjktNjVjMi00YTg5LThkNWEtOGNjMGZjZTEzMDdmIiwiaXNzIjoiaHR0cHM6Ly9jbG91ZC5haXJieXRlLmNvbS9hdXRoL3JlYWxtcy9fYWlyYnl0ZS1hcHBsaWNhdGlvbi1jbGllbnRzIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6ImZhYzZmMDg1LWI4ZDMtNDQ2Yy04NDg5LWQ1OTZmNDYyODk0ZiIsInR5cCI6IkJlYXJlciIsImF6cCI6IjI4MWI1NTc4LWFmNGMtNGI3Mi1hODk0LTU4N2UwZTQyNGVkYSIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiIsImRlZmF1bHQtcm9sZXMtX2FpcmJ5dGUtYXBwbGljYXRpb24tY2xpZW50cyJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIGVtYWlsIHByb2ZpbGUiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImNsaWVudEhvc3QiOiIxNzIuMjMuMi4zIiwidXNlcl9pZCI6ImZhYzZmMDg1LWI4ZDMtNDQ2Yy04NDg5LWQ1OTZmNDYyODk0ZiIsInByZWZlcnJlZF91c2VybmFtZSI6InNlcnZpY2UtYWNjb3VudC0yODFiNTU3OC1hZjRjLTRiNzItYTg5NC01ODdlMGU0MjRlZGEiLCJjbGllbnRBZGRyZXNzIjoiMTcyLjIzLjIuMyIsImNsaWVudF9pZCI6IjI4MWI1NTc4LWFmNGMtNGI3Mi1hODk0LTU4N2UwZTQyNGVkYSJ9.vhgpNNigCPNclFEBDP6lhEk5GGyYNkGv2LmzFLijDiGg24LJ1KNX4-hazRWssepOStTnBoT2TT17K-2xZt7yDl-YvKw_IqBjmz6pGItXG9vjHZPRbnuYVmkOyXN2DYOHxv2YHx9H0bQwW-jJ11d1J3XvwjB_KTc6cCXNWhZr5WVryEjcnFjjuQDhQ4ZgvkA1Tc-zR5t1AAGzHbjoqs0IDSYQoyKd3YU0bIc9Euti2t1cRe1fHdH34meWqQoWNVmswdrgjwqHzbLQAdwo8P8FQ5FZND7rroac2IkZ0BvcpXqLVJDjORolD-lrwWMmL6I6C84iAjwtAekJtQfSrq2Gvw';
const WORKSPACE_ID = 'f79251c6-5e07-42d8-a450-9c572d5ec973';

// This is the callback URL used by HubSpot OAuth
const CALLBACK_URL = 'http://localhost:3000/oauth/callback';

let createdSourceId = null;
let accessToken = null;

// Helper function to get fetch
async function getFetch() {
  return (await import('node-fetch')).default;
}

// Helper function to get a valid Airbyte access token
async function getAccessToken() {
  // No need to fetch, just return the configured API key
  // Ensure AIRBYTE_API_KEY is correctly set above
  if (!AIRBYTE_API_KEY) {
      console.error('Error: AIRBYTE_API_KEY is not set.');
      throw new Error('AIRBYTE_API_KEY is not configured.');
  }
  // console.log('Using configured AIRBYTE_API_KEY'); // Optional: uncomment for debugging
  return AIRBYTE_API_KEY;
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
    const sourceDefinitionId = await getHubspotSourceDefinitionId();

    if (!sourceDefinitionId) {
      console.error('HubSpot source definition not found');
      return res.status(500).json({ error: 'HubSpot source definition not found' });
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
      return res.status(resp.status).json({ error: data.message || 'Unknown error occurred' });
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
    res.status(500).json({ error: 'Error initiating OAuth flow' });
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

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
