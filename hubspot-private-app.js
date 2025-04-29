/**
 * HubSpot Private App Authentication for Airbyte
 * This module provides functions to create and use a HubSpot Private App for authentication
 */

// Use dynamic import for node-fetch
async function getFetch() {
  return (await import('node-fetch')).default;
}

/**
 * Create a source using HubSpot Private App authentication
 * @param {Object} airbyteClient - The Airbyte client instance
 * @param {string} workspaceId - The Airbyte workspace ID
 * @param {string} sourceDefinitionId - The HubSpot source definition ID
 * @param {string} sourceName - The name for the new source
 * @param {string} privateAppToken - The HubSpot Private App access token
 * @returns {Promise<Object>} - The created source object
 */
async function createHubSpotSourceWithPrivateApp(airbyteClient, workspaceId, sourceDefinitionId, sourceName, privateAppToken) {
  try {
    console.log(`Creating HubSpot source with Private App authentication in workspace ${workspaceId}`);
    
    // Create the source with Private App authentication
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
    
    console.log(`Successfully created HubSpot source with ID: ${source.sourceId}`);
    return source;
  } catch (error) {
    console.error('Error creating HubSpot source with Private App authentication:', error);
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
    console.log('Testing HubSpot Private App connection...');
    
    const fetch = await getFetch();
    
    // Test the connection to HubSpot API
    const response = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${privateAppToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('HubSpot API Error:', errorData);
      return false;
    }
    
    const data = await response.json();
    console.log(`Successfully connected to HubSpot API. Found ${data.results?.length || 0} contact properties.`);
    return true;
  } catch (error) {
    console.error('Error testing HubSpot Private App connection:', error);
    return false;
  }
}

module.exports = {
  createHubSpotSourceWithPrivateApp,
  testHubSpotPrivateAppConnection
};
