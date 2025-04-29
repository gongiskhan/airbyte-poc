/**
 * Test script for creating a HubSpot source using Private App authentication
 */

const fetch = require('node-fetch');

// Replace these with your values
const WORKSPACE_ID = '16397b59-e067-418a-845c-99d57d78ecc0'; // Use one of the workspace IDs from the logs
const PRIVATE_APP_TOKEN = 'pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'; // Replace with a real HubSpot Private App token
const SOURCE_NAME = 'HubSpot Source (Private App)';

async function createHubSpotSourceWithPrivateApp() {
  try {
    console.log('Testing HubSpot Private App authentication...');
    
    const response = await fetch('http://localhost:3002/create-hubspot-source-with-private-app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
        privateAppToken: PRIVATE_APP_TOKEN,
        sourceName: SOURCE_NAME
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error creating HubSpot source:', data);
      return;
    }
    
    console.log('Successfully created HubSpot source with Private App authentication!');
    console.log('Source ID:', data.source.sourceId);
    console.log('Full response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
createHubSpotSourceWithPrivateApp();
