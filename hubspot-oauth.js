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
  const stateObj = {
    workspaceId,
    sourceDefinitionId
  };

  console.log('Creating OAuth state parameter with:', stateObj);
  const state = encodeURIComponent(JSON.stringify(stateObj));

  const oauthUrl = `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${scopesParam}&state=${state}`;
  console.log('Generated HubSpot OAuth URL:', oauthUrl);

  return oauthUrl;
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
    console.log('Exchanging code for tokens with:');
    console.log('- Client ID:', clientId);
    console.log('- Client Secret:', clientSecret ? '********' : 'not set');
    console.log('- Redirect URL:', redirectUrl);
    console.log('- Code:', code ? `${code.substring(0, 10)}...` : 'not set');

    const fetch = await getFetch();

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUrl,
      code: code
    });

    console.log('Making POST request to https://api.hubapi.com/oauth/v1/token');

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to exchange code for tokens: HTTP ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = `Failed to exchange code for tokens: ${errorData.message || response.statusText}`;
        console.error('Error response from HubSpot:', errorData);
      } catch (parseError) {
        console.error('Error response from HubSpot (non-JSON):', errorText);
      }

      throw new Error(errorMessage);
    }

    const tokens = await response.json();
    console.log('Successfully exchanged code for tokens');
    return tokens;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
}

/**
 * Refresh an access token using a refresh token
 * @param {string} clientId - HubSpot OAuth client ID
 * @param {string} clientSecret - HubSpot OAuth client secret
 * @param {string} refreshToken - Refresh token from HubSpot
 * @returns {Promise<Object>} - New token response
 */
async function refreshAccessToken(clientId, clientSecret, refreshToken) {
  try {
    console.log('Refreshing HubSpot access token...');
    const fetch = await getFetch();

    const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to refresh access token: ${errorData.message || response.statusText}`);
    }

    const tokens = await response.json();
    console.log('Successfully refreshed HubSpot access token');
    return tokens;
  } catch (error) {
    console.error('Error refreshing access token:', error);
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
    console.log('Creating HubSpot source with OAuth credentials via Airbyte');

    // Create the source configuration for Airbyte's HubSpot connector
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

    // Create the source using the Airbyte client
    console.log('Creating HubSpot source using Airbyte client...');
    return await airbyteClient.createSource(
      workspaceId,
      sourceDefinitionId,
      sourceName,
      sourceConfig
    );
  } catch (error) {
    console.error('Error creating HubSpot source with OAuth via Airbyte:', error);
    throw error;
  }
}

/**
 * Update an existing HubSpot source with refreshed OAuth tokens
 * @param {Object} airbyteClient - Airbyte client instance
 * @param {string} sourceId - Airbyte source ID to update
 * @param {Object} tokens - New OAuth tokens from HubSpot
 * @returns {Promise<Object>} - Updated source
 */
async function updateHubSpotSourceWithRefreshedTokens(airbyteClient, sourceId, tokens) {
  try {
    console.log(`Updating HubSpot source ${sourceId} with refreshed OAuth tokens`);

    // First, get the current source configuration
    const source = await airbyteClient.getSource(sourceId);

    if (!source) {
      throw new Error(`Source with ID ${sourceId} not found`);
    }

    // Create an updated configuration with the new tokens
    const updatedConfig = {
      ...source.connectionConfiguration,
      credentials: {
        ...source.connectionConfiguration.credentials,
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token
      }
    };

    // Update the source with the new configuration
    console.log('Updating source with refreshed tokens...');
    return await airbyteClient.updateSource(
      sourceId,
      source.name,
      updatedConfig
    );
  } catch (error) {
    console.error('Error updating HubSpot source with refreshed tokens:', error);
    throw error;
  }
}

module.exports = {
  generateHubSpotOAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  createHubSpotSourceWithOAuth,
  updateHubSpotSourceWithRefreshedTokens
};
