# Airbyte Embedded POC

This proof of concept demonstrates how to implement Airbyte Embedded (Powered by Airbyte) for SaaS applications. It follows the Headless version approach where your application controls the UI and uses Airbyte's API in the background.

## Overview

Airbyte Embedded enables you to add hundreds of integrations into your product instantly. Your end-users can authenticate into their data sources and begin syncing data to your product, without you needing to spend engineering cycles on data movement.

This POC implements the complete flow:

1. Connecting to the Airbyte API
2. Creating a workspace for a customer
3. Setting up a source with OAuth
4. Creating a destination
5. Creating a connection between source and destination
6. Triggering a data sync

## Setup Instructions

### Prerequisites

- Node.js 16+ installed
- Airbyte account with API access
- Airbyte Client ID and Client Secret (from Airbyte Cloud account settings)

### Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/airbyte-embedded-poc.git
cd airbyte-embedded-poc
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Airbyte API credentials:
```
AIRBYTE_CLIENT_ID=your-client-id
AIRBYTE_CLIENT_SECRET=your-client-secret
CALLBACK_URL=http://localhost:3000/oauth/callback
```

### Running the Application

Start the server:
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

Then visit http://localhost:3000 in your browser.

## How It Works

### Backend (`server.js`)

The server provides API endpoints for each step in the Airbyte Embedded workflow:

- `/test-connection` - Tests connection to Airbyte API
- `/create-workspace` - Creates a workspace for a customer
- `/source-definitions` - Gets source definition details
- `/initiate-oauth` - Initiates OAuth flow for a source
- `/oauth/callback` - Handles OAuth callback and creates a source
- `/destination-definitions` - Gets destination definition details
- `/create-destination` - Creates a destination
- `/create-connection` - Creates a connection between source and destination
- `/trigger-sync` - Triggers a data sync job

### Airbyte Client (`airbyte-client.js`)

A reusable client for the Airbyte API that:
- Handles authentication with access token management
- Provides methods for all Airbyte API operations
- Manages error handling and response parsing

### Frontend (`index.html`)

A step-by-step interface that guides users through the entire process with:
- Clear instructions for each step
- Form inputs for required configurations
- Status indicators and resource information display
- Button controls that activate as prerequisites are met

## Next Steps

After completing this POC, you could:

1. Integrate the code into your SaaS application
2. Add error handling and logging
3. Implement more advanced features like sync monitoring
4. Add support for additional source and destination types
5. Create a more polished UI integrated with your application's design

## Resources

- [Airbyte API Documentation](https://reference.airbyte.com/reference/start)
- [Airbyte Embedded Documentation](https://reference.airbyte.com/reference/powered-by-airbyte) 