# NetApp ONTAP Provisioning Assistant (Chatbot)

The demo now includes an AI-powered chatbot that helps users make intelligent storage provisioning decisions across their ONTAP clusters.

## Features

- **Capacity-based Recommendations**: AI analyzes available capacity across clusters to suggest optimal placement
- **Form Population**: Chatbot can pre-fill the provisioning form with recommended settings for user review
- **Context Awareness**: Understands currently selected clusters and previous conversation history
- **Dual Mode Operation**: 
  - **Production Mode**: Uses ChatGPT API for real AI intelligence
  - **Mock Mode**: Fallback demonstration mode when API is unavailable

## Setup

### 1. Configure ChatGPT API Key

Create `demo/chatgpt-config.json` from the template:

```bash
cd demo
cp chatgpt-config.json.example chatgpt-config.json
```

Edit `chatgpt-config.json` with your OpenAI API key:

```json
{
  "api_key": "your-openai-api-key-here",
  "model": "gpt-5",
  "max_completion_tokens": 2000
}
```

**Note**: Newer OpenAI models (gpt-4.1, gpt-4o, gpt-5) use `max_completion_tokens` instead of the legacy `max_tokens` parameter. These models also use fixed sampling settings and don't support custom temperature values.

### 2. Security Note

The `chatgpt-config.json` file is automatically excluded from git commits. Never commit API keys to version control.

## Usage

### Starting the Chatbot

1. Start both servers as usual:
   ```bash
   # Terminal 1: MCP Server
   export ONTAP_CLUSTERS='[{"name":"cluster1","cluster_ip":"...","username":"...","password":"..."}]'
   node build/index.js --http=3000
   
   # Terminal 2: Demo Server  
   cd demo
   python3 -m http.server 8080
   ```

2. Open http://localhost:8080

3. The chatbot panel appears below the cluster grid (initially collapsed)

4. Click the toggle button to expand the chatbot

### Example Interactions

**Volume Provisioning:**
- "Provision a 100GB NFS volume for a database workload"
- "Where should I create a 500GB CIFS share for file sharing?"
- "I need 2TB of storage with high performance requirements"

**Capacity Analysis:**
- "Show me capacity across all clusters"  
- "Which cluster has the most available space?"
- "What's the utilization on cluster-prod?"

**Form Integration:**
- When chatbot suggests provisioning actions, it offers "Apply to Form" buttons
- This automatically opens the provisioning panel and pre-fills settings
- Users can review, modify, and submit the provisioning request safely

## Architecture

### Components

- **ChatbotAssistant Class**: Main chatbot logic and UI management
- **Configuration Management**: Secure API key handling with fallback
- **MCP Integration**: Discovers and utilizes available ONTAP tools
- **Form Integration**: Bi-directional communication with provisioning forms

### Mock Mode

When ChatGPT API is unavailable, the chatbot automatically switches to mock mode:

- Simulates realistic responses based on common provisioning scenarios
- Demonstrates form integration capabilities
- Provides consistent UI experience without external dependencies
- Useful for development and demonstrations

### AI System Prompt

The chatbot is configured as a NetApp storage expert with knowledge of:
- ONTAP cluster architecture (SVMs, aggregates, volumes)
- Capacity-based placement decisions
- Storage best practices
- Available MCP tools and their capabilities
- Current user context (selected cluster, conversation history)

## Styling

The chatbot follows NetApp BlueXP design system:
- Consistent colors and typography
- NetApp blue primary colors
- Professional chat bubble interface
- Responsive design patterns
- Loading states and animations

## Error Handling

- **API Failures**: Graceful fallback to mock mode
- **Network Issues**: Clear error messages in chat
- **Invalid Responses**: Retry logic and user feedback
- **Form Integration**: Validation before applying settings

## Development Notes

### Adding New Actions

To add new chatbot actions (like form population):

1. Add action detection in `parseResponseActions()`
2. Implement handler in `handleAction()`
3. Test both real and mock response paths

### Extending Mock Responses

Mock responses are in `getMockResponse()` - add new patterns:

```javascript
if (lowerMsg.includes('snapshot')) {
    return {
        text: "For snapshot management...",
        actions: [...]
    };
}
```

### Tool Discovery

The chatbot discovers available MCP tools on startup. To add new tools:

1. Add tool name to `discoverTools()` method
2. Update system prompt to include new capabilities
3. Test with both STDIO and HTTP MCP modes

## Security Considerations

- API keys are stored locally and excluded from git
- No sensitive cluster data is sent to ChatGPT without explicit user intent
- All provisioning actions require user confirmation via form submission
- Mock mode available for environments where external AI is not permitted