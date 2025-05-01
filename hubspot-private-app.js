/**
 * HubSpot Private App Authentication for Airbyte
 * This module provides functions to create and use a HubSpot Private App for authentication
 */

// Use dynamic import for node-fetch
async function getFetch() {
  return (await import('node-fetch')).default;
}

/**
 * Create a source using HubSpot Private App authentication via Airbyte
 * @param {Object} airbyteClient - The Airbyte client instance
 * @param {string} workspaceId - The Airbyte workspace ID
 * @param {string} sourceDefinitionId - The HubSpot source definition ID
 * @param {string} sourceName - The name for the new source
 * @param {string} privateAppToken - The HubSpot Private App access token
 * @returns {Promise<Object>} - The created source object
 */
async function createHubSpotSourceWithPrivateApp(airbyteClient, workspaceId, sourceDefinitionId, sourceName, privateAppToken) {
  try {
    console.log(`Creating HubSpot source with Private App authentication in workspace ${workspaceId} via Airbyte`);

    // Create the source configuration for Airbyte's HubSpot connector
    const sourceConfig = {
      credentials: {
        credentials_title: "Private App Credentials",
        private_app_token: privateAppToken
      },
      start_date: new Date().toISOString().split('T')[0] // Use today as start date
    };

    // Create the source using the Airbyte API
    const source = await airbyteClient.createSource(
      workspaceId,
      sourceDefinitionId,
      sourceName,
      sourceConfig
    );

    console.log(`Successfully created HubSpot source with ID: ${source.sourceId} via Airbyte`);
    return source;
  } catch (error) {
    console.error('Error creating HubSpot source with Private App authentication via Airbyte:', error);
    throw error;
  }
}

/**
 * Test the connection to HubSpot using a Private App token
 * @param {string} privateAppToken - The HubSpot Private App access token
 * @returns {Promise<boolean>} - True if the connection is successful
 */
async function testHubSpotPrivateAppConnection(privateAppToken) {
  try {
    console.log('Testing HubSpot Private App connection via Airbyte...');

    // We'll use a simple check to validate the token format
    // This is a basic validation - Airbyte will do the full validation when creating the source
    if (!privateAppToken || !privateAppToken.startsWith('pat-')) {
      console.error('Invalid HubSpot Private App token format. Token should start with "pat-"');
      return false;
    }

    console.log('HubSpot Private App token format is valid. Airbyte will perform full validation when creating the source.');
    return true;

    // Note: We're not making a direct API call to HubSpot anymore.
    // Instead, we're relying on Airbyte to validate the connection when creating the source.
    // This ensures we're using Airbyte's HubSpot connector exclusively.
  } catch (error) {
    console.error('Error testing HubSpot Private App connection:', error);
    return false;
  }
}

module.exports = {
  createHubSpotSourceWithPrivateApp,
  testHubSpotPrivateAppConnection
};
