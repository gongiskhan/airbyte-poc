/**
 * HubSpot OAuth Helper for Arkivo Airbyte Platform
 * This module provides functions to initiate OAuth with HubSpot via the Arkivo Airbyte platform.
 */

// Use dynamic import for node-fetch
async function getFetch() {
  return (await import('node-fetch')).default;
}

const ARKIVO_PLATFORM_API_BASE_URL = process.env.ARKIVO_PLATFORM_API_BASE_URL || 'http://localhost:3003'; // Or where your Arkivo platform API is

/**
 * Initiates the HubSpot OAuth flow via the Arkivo Airbyte Platform.
 * It calls the platform to get a HubSpot consent URL, which the client then redirects to.
 * @param {string} workspaceId - Airbyte workspace ID (from Arkivo platform context)
 * @param {string} pocClientRedirectUrl - The full URL in this POC app where the user should be redirected after the platform completes OAuth.
 * @returns {Promise<string>} - The HubSpot consent URL to redirect the user to.
 * @throws {Error} if the platform call fails.
 */
async function initiatePlatformHubSpotOAuth(workspaceId, pocClientRedirectUrl) {
  console.log('Initiating HubSpot OAuth via Arkivo Platform...');
  console.log('- Workspace ID:', workspaceId);
  console.log('- POC Client Redirect URL:', pocClientRedirectUrl);

  const fetch = await getFetch();
  const platformGetConsentUrl = `${ARKIVO_PLATFORM_API_BASE_URL}/api/v1/source_oauths/get_consent_url`;
  const HUBSPOT_SOURCE_DEFINITION_ID = '36c891d9-4bd9-43ac-bad2-10e12756272c'; // Standard HubSpot Source Def ID

  try {
    const response = await fetch(platformGetConsentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any necessary auth headers for your Arkivo platform API here
        // e.g., 'Authorization': 'Bearer YOUR_ARKIVO_API_TOKEN'
      },
      body: JSON.stringify({
        sourceDefinitionId: HUBSPOT_SOURCE_DEFINITION_ID,
        workspaceId: workspaceId,
        redirectUrl: pocClientRedirectUrl, // This is where the POC wants to go after platform is done
        oAuthInputConfiguration: {} // Usually empty if platform uses instance-wide credentials
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to get HubSpot consent URL from platform: ${errorData.message || response.statusText} (Status: ${response.status})`);
    }

    const result = await response.json();
    if (!result.consentUrl) {
      throw new Error('Platform did not return a consentUrl for HubSpot.');
    }

    console.log('Received HubSpot consent URL from platform:', result.consentUrl);
    return result.consentUrl;
  } catch (error) {
    console.error('Error initiating platform HubSpot OAuth:', error);
    throw error;
  }
}

/**
 * (REVISED) Create a HubSpot source in Airbyte using platform-managed OAuth.
 * The platform has already handled token acquisition.
 * @param {Object} airbyteClient - Airbyte client instance (configured to talk to Arkivo platform's Airbyte API proxy)
 * @param {string} workspaceId - Airbyte workspace ID
 * @param {string} sourceDefinitionId - Airbyte source definition ID for HubSpot
 * @param {string} sourceName - Name for the new source
 * @returns {Promise<Object>} - Created source
 */
async function createHubSpotSourceWithPlatformOAuth(airbyteClient, workspaceId, sourceDefinitionId, sourceName) {
  try {
    console.log('Creating HubSpot source with platform-managed OAuth credentials via Arkivo Airbyte...');

    // Configuration when OAuth is handled by the platform/Airbyte control plane.
    // The key is that client_id, client_secret, access_token, refresh_token are NOT sent.
    // Airbyte core uses the tokens it stored during the OAuth flow.
    const sourceConfig = {
      credentials: {
        auth_method: "oauth2.0" // Indicates platform-managed OAuth
        // Potentially other non-sensitive OAuth related fields if the spec requires,
        // but usually not needed for standard platform OAuth.
      },
      start_date: new Date().toISOString().split('T')[0] // Example: set start_date, adjust as needed
      // Add any other HubSpot specific configurations required by its spec here (e.g. enable_experimental_streams)
    };

    console.log('Creating HubSpot source using Airbyte client with config:', JSON.stringify(sourceConfig, null, 2));
    return await airbyteClient.createSource(
      workspaceId,
      sourceDefinitionId,
      sourceName,
      sourceConfig
    );
  } catch (error) {
    console.error('Error creating HubSpot source with platform OAuth via Arkivo Airbyte:', error);
    throw error;
  }
}

// Functions no longer needed by the POC as platform handles them:
// - exchangeCodeForTokens
// - refreshAccessToken
// - generateHubSpotOAuthUrl (replaced by initiatePlatformHubSpotOAuth)
// - updateHubSpotSourceWithRefreshedTokens (update would also use simplified config if needed)

module.exports = {
  initiatePlatformHubSpotOAuth,
  createHubSpotSourceWithPlatformOAuth
  // Old functions removed from export
};
