// Script to get the HubSpot source definition ID from Airbyte
// Run with: node get-source-def-id.js

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Replace these with your values
const AIRBYTE_API_URL = 'https://cloud.airbyte.com/api/public/v1';
const AIRBYTE_API_KEY = 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ6Z1BPdmhDSC1Ic21OQnhhV3lnLU11dlF6dHJERTBDSEJHZDB2MVh0Vnk0In0.eyJleHAiOjE3NDU0MzQ1MDEsImlhdCI6MTc0NTQzMzYwMSwianRpIjoiY2ZiYWU0ZjktNjVjMi00YTg5LThkNWEtOGNjMGZjZTEzMDdmIiwiaXNzIjoiaHR0cHM6Ly9jbG91ZC5haXJieXRlLmNvbS9hdXRoL3JlYWxtcy9fYWlyYnl0ZS1hcHBsaWNhdGlvbi1jbGllbnRzIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6ImZhYzZmMDg1LWI4ZDMtNDQ2Yy04NDg5LWQ1OTZmNDYyODk0ZiIsInR5cCI6IkJlYXJlciIsImF6cCI6IjI4MWI1NTc4LWFmNGMtNGI3Mi1hODk0LTU4N2UwZTQyNGVkYSIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiIsImRlZmF1bHQtcm9sZXMtX2FpcmJ5dGUtYXBwbGljYXRpb24tY2xpZW50cyJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoib3BlbmlkIGVtYWlsIHByb2ZpbGUiLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImNsaWVudEhvc3QiOiIxNzIuMjMuMi4zIiwidXNlcl9pZCI6ImZhYzZmMDg1LWI4ZDMtNDQ2Yy04NDg5LWQ1OTZmNDYyODk0ZiIsInByZWZlcnJlZF91c2VybmFtZSI6InNlcnZpY2UtYWNjb3VudC0yODFiNTU3OC1hZjRjLTRiNzItYTg5NC01ODdlMGU0MjRlZGEiLCJjbGllbnRBZGRyZXNzIjoiMTcyLjIzLjIuMyIsImNsaWVudF9pZCI6IjI4MWI1NTc4LWFmNGMtNGI3Mi1hODk0LTU4N2UwZTQyNGVkYSJ9.vhgpNNigCPNclFEBDP6lhEk5GGyYNkGv2LmzFLijDiGg24LJ1KNX4-hazRWssepOStTnBoT2TT17K-2xZt7yDl-YvKw_IqBjmz6pGItXG9vjHZPRbnuYVmkOyXN2DYOHxv2YHx9H0bQwW-jJ11d1J3XvwjB_KTc6cCXNWhZr5WVryEjcnFjjuQDhQ4ZgvkA1Tc-zR5t1AAGzHbjoqs0IDSYQoyKd3YU0bIc9Euti2t1cRe1fHdH34meWqQoWNVmswdrgjwqHzbLQAdwo8P8FQ5FZND7rroac2IkZ0BvcpXqLVJDjORolD-lrwWMmL6I6C84iAjwtAekJtQfSrq2Gvw';
const WORKSPACE_ID = 'f79251c6-5e07-42d8-a450-9c572d5ec973';

async function getSourceDefinitions() {
  try {
    const response = await fetch(`${AIRBYTE_API_URL}/source_definitions/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AIRBYTE_API_KEY}`,
      },
      body: JSON.stringify({
        workspaceId: WORKSPACE_ID,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Error:', errorData);
      return;
    }

    const data = await response.json();
    
    // Find HubSpot source definition
    const hubspotSource = data.sourceDefinitions.find(def => 
      def.name.toLowerCase().includes('hubspot')
    );
    
    if (hubspotSource) {
      console.log('\n=== HUBSPOT SOURCE DEFINITION ===');
      console.log(`ID: ${hubspotSource.sourceDefinitionId}`);
      console.log(`Name: ${hubspotSource.name}`);
      console.log(`Documentation URL: ${hubspotSource.documentationUrl || 'N/A'}`);
      console.log('\nAdd this to your server.js:');
      console.log(`const HUBSPOT_SOURCE_DEF_ID = '${hubspotSource.sourceDefinitionId}';`);
    } else {
      console.log('HubSpot source definition not found');
    }
    
    console.log('\n=== ALL SOURCE DEFINITIONS ===');
    data.sourceDefinitions.forEach(def => {
      console.log(`- ${def.name}: ${def.sourceDefinitionId}`);
    });
  } catch (error) {
    console.error('Error fetching source definitions:', error);
  }
}

getSourceDefinitions(); 