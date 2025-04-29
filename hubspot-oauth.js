/**
 * Direct HubSpot OAuth Implementation
 * This module provides functions to handle OAuth with HubSpot directly,
 * bypassing Airbyte's OAuth flow completely.
 */

// Use dynamic import for node-fetch
async function getFetch() {
  return (await import('node-fetch')).default;
}

/**
 * Generate an OAuth URL for HubSpot
 * @param {string} clientId - HubSpot OAuth client ID
 * @param {string} redirectUrl - URL to redirect to after authorization
 * @param {string} workspaceId - Airbyte workspace ID
 * @param {string} sourceDefinitionId - Airbyte source definition ID
 * @returns {string} - HubSpot OAuth URL
 */
function generateHubSpotOAuthUrl(clientId, redirectUrl, workspaceId, sourceDefinitionId) {
  // Required scopes for HubSpot
  const scopes = [
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
  ];
  
  // Create the OAuth URL
  const scopesParam = encodeURIComponent(scopes.join(' '));
  const state = encodeURIComponent(JSON.stringify({
    workspaceId,
    sourceDefinitionId
  }));
  
  return `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${scopesParam}&state=${state}`;
}

/**
 * Exchange an authorization code for access and refresh tokens
 * @param {string} clientId - HubSpot OAuth client ID
 * @param {string} clientSecret - HubSpot OAuth client secret
 * @param {string} redirectUrl - URL to redirect to after authorization
 * @param {string} code - Authorization code from HubSpot
 * @returns {Promise<Object>} - Token response
 */
async function exchangeCodeForTokens(clientId, clientSecret, redirectUrl, code) {
  try {
    const fetch = await getFetch();
    
    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUrl,
        code: code
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to exchange code for tokens: ${errorData.message || response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
}

/**
 * Create a HubSpot source in Airbyte using OAuth credentials
 * @param {Object} airbyteClient - Airbyte client instance
 * @param {string} workspaceId - Airbyte workspace ID
 * @param {string} sourceDefinitionId - Airbyte source definition ID
 * @param {string} sourceName - Name for the new source
 * @param {Object} tokens - OAuth tokens from HubSpot
 * @returns {Promise<Object>} - Created source
 */
async function createHubSpotSourceWithOAuth(airbyteClient, workspaceId, sourceDefinitionId, sourceName, tokens) {
  try {
    console.log('Creating HubSpot source with OAuth credentials');
    
    // Create the source configuration
    const sourceConfig = {
      credentials: {
        credentials_title: "OAuth Credentials",
        client_id: process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token
      },
      start_date: new Date().toISOString().split('T')[0]
    };
    
    // Try to create the source directly using the Airbyte API
    try {
      const fetch = await getFetch();
      
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
      const directResponse = await fetch(url, options);
      
      if (directResponse.ok) {
        const response = await directResponse.json();
        console.log('Direct source creation successful!');
        return response;
      } else {
        console.log(`Direct source creation failed: ${directResponse.status} ${directResponse.statusText}`);
        throw new Error('Direct source creation failed');
      }
    } catch (directError) {
      console.log('Direct source creation failed, trying standard method...');
      
      // Fall back to the standard createSource method
      return await airbyteClient.createSource(
        workspaceId,
        sourceDefinitionId,
        sourceName,
        sourceConfig
      );
    }
  } catch (error) {
    console.error('Error creating HubSpot source with OAuth:', error);
    throw error;
  }
}

module.exports = {
  generateHubSpotOAuthUrl,
  exchangeCodeForTokens,
  createHubSpotSourceWithOAuth
};
