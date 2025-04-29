/**
 * Script to create a HubSpot source using Private App authentication
 */

const AirbyteClient = require('./airbyte-client');
const hubspotPrivateApp = require('./hubspot-private-app');

// Create an instance of the Airbyte client
const airbyteClient = new AirbyteClient({
  apiUrl: 'http://scuver.services:8000/api/public/v1',
  email: 'goncalo.p.gomes@gmail.com',
  password: '32bTEN4EvQtGruOxMLCrn6Ai17zHYMS7',
  token: 'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwOi8vYWlyYnl0ZS1hYmN0bC1haXJieXRlLXdlYmFwcC1zdmM6ODAiLCJhdWQiOiJhaXJieXRlLXNlcnZlciIsInN1YiI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImV4cCI6MTc0NTczMDk4MSwicm9sZXMiOlsiQVVUSEVOVElDQVRFRF9VU0VSIiwiUkVBREVSIiwiRURJVE9SIiwiQURNSU4iLCJXT1JLU1BBQ0VfUkVBREVSIiwiV09SS1NQQUNFX1JVTk5FUiIsIldPUktTUEFDRV9FRElUT1IiLCJXT1JLU1BBQ0VfQURNSU4iLCJPUkdBTklaQVRJT05fTUVNQkVSIiwiT1JHQU5JWkFUSU9OX1JFQURFUiIsIk9SR0FOSVpBVElPTl9SVU5ORVIiLCJPUkdBTklaQVRJT05fRURJVE9SIiwiT1JHQU5JWkFUSU9OX0FETUlOIl19.jcgaMw3S2grqGSnOI4_Be3qbY065h1xfmLIxTcZPIBo'
});

// Replace these with your actual values
const WORKSPACE_ID = '16397b59-e067-418a-845c-99d57d78ecc0'; // Use one of the workspace IDs from the logs
const SOURCE_DEFINITION_ID = '36c891d9-4bd9-43ac-bad2-10e12756272c'; // HubSpot source definition ID
const SOURCE_NAME = 'HubSpot Source (Private App)';
const PRIVATE_APP_TOKEN = 'pat-na1-sample-token-for-demonstration'; // Replace with a real HubSpot Private App token

async function createHubSpotSource() {
  try {
    console.log('Creating HubSpot source with Private App authentication...');
    
    // First, list workspaces to verify connection
    const workspaces = await airbyteClient.listWorkspaces();
    console.log('Available workspaces:', workspaces);
    
    // If no workspace ID is provided, use the first available workspace
    const workspaceId = WORKSPACE_ID || (workspaces.workspaces && workspaces.workspaces.length > 0 ? workspaces.workspaces[0].workspaceId : null);
    
    if (!workspaceId) {
      console.error('No workspace ID available. Please create a workspace first.');
      return;
    }
    
    console.log(`Using workspace ID: ${workspaceId}`);
    
    // Create the source configuration
    const sourceConfig = {
      credentials: {
        credentials_title: "Private App Credentials",
        private_app_token: PRIVATE_APP_TOKEN
      },
      start_date: new Date().toISOString().split('T')[0] // Use today as start date
    };
    
    // Create the source directly using the Airbyte client
    const source = await airbyteClient.createSource(
      workspaceId,
      SOURCE_DEFINITION_ID,
      SOURCE_NAME,
      sourceConfig
    );
    
    console.log('Successfully created HubSpot source!');
    console.log('Source ID:', source.sourceId);
    console.log('Full response:', JSON.stringify(source, null, 2));
  } catch (error) {
    console.error('Error creating HubSpot source:', error);
  }
}

// Run the function
createHubSpotSource();
