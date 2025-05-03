/**
 * Test script for the new OAuth consent URL functionality
 */

const AirbyteClient = require('./airbyte-client');

// Create a client instance
const client = new AirbyteClient({
  apiUrl: 'http://scuver.services:8000/api/public/v1',
  email: 'goncalo.p.gomes@gmail.com',
  password: '32bTEN4EvQtGruOxMLCrn6Ai17zHYMS7'
});

// HubSpot source definition ID
const HUBSPOT_SOURCE_DEFINITION_ID = '36c891d9-4bd9-43ac-bad2-10e12756272c';

async function testOAuthConsent() {
  try {
    console.log('Testing OAuth consent URL functionality...');
    
    // First, get a list of workspaces
    const workspaces = await client.listWorkspaces();
    
    if (!workspaces.workspaces || workspaces.workspaces.length === 0) {
      console.error('No workspaces found. Please create a workspace first.');
      return;
    }
    
    const workspaceId = workspaces.workspaces[0].workspaceId;
    console.log(`Using workspace ID: ${workspaceId}`);
    
    // Set a redirect URL for testing
    const redirectUrl = 'http://localhost:3000/oauth/callback';
    
    // Test the new getSourceOAuthConsent method
    console.log('Testing getSourceOAuthConsent method...');
    try {
      const consentResponse = await client.getSourceOAuthConsent(
        HUBSPOT_SOURCE_DEFINITION_ID,
        workspaceId,
        redirectUrl
      );
      
      console.log('OAuth consent URL response:', JSON.stringify(consentResponse, null, 2));
      
      if (consentResponse && consentResponse.consentUrl) {
        console.log(`Success! Consent URL: ${consentResponse.consentUrl}`);
      } else {
        console.log('Response did not contain a consent URL');
      }
    } catch (consentError) {
      console.error('Error getting consent URL:', consentError);
    }
    
    // Test the initiateOAuth method which should now use the new endpoint
    console.log('\nTesting initiateOAuth method (should use new endpoint)...');
    try {
      const oauthResponse = await client.initiateOAuth(
        workspaceId,
        HUBSPOT_SOURCE_DEFINITION_ID,
        redirectUrl
      );
      
      console.log('OAuth initiation response:', JSON.stringify(oauthResponse, null, 2));
      
      if (oauthResponse && (oauthResponse.consentUrl || oauthResponse.authUrlInitParameters)) {
        console.log('Success! OAuth initiation successful');
        const url = oauthResponse.consentUrl || oauthResponse.authUrlInitParameters?.auth_url;
        if (url) {
          console.log(`Auth URL: ${url}`);
        }
      } else {
        console.log('Response did not contain expected OAuth data');
      }
    } catch (oauthError) {
      console.error('Error initiating OAuth:', oauthError);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testOAuthConsent().catch(err => {
  console.error('Unhandled error in test:', err);
});
