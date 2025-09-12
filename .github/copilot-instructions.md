# Copilot Instructions for NetApp ONTAP MCP Server

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is an MCP (Model Context Protocol) server project for NetApp ONTAP REST API integration.

## Project Context
- This MCP server provides tools to interact with NetApp ONTAP storage systems via REST APIs
- Primary focus areas: cluster management, volume operations, and storage analytics
- Built using TypeScript with the @modelcontextprotocol/sdk
- Integrates with NetApp ONTAP REST API v1 and v2

## Code Guidelines
- Use TypeScript with strict typing
- Follow the MCP SDK patterns for tool definitions
- Implement proper error handling for REST API calls
- Use Zod schemas for input validation
- Structure code with clear separation between API clients and MCP tools
- Include comprehensive JSDoc comments for all functions

## Git/Version Control Guidelines
- **NEVER commit changes without explicit user permission**
- **NEVER run git add, git commit, or git push without being explicitly told to do so**
- Make requested changes, build and test to verify they work
- Show results and confirm functionality
- Wait for explicit instruction before any git operations
- The user controls all decisions about when and how to commit changes

## NetApp ONTAP Integration
- Use HTTPS for all API communications
- Implement proper authentication (basic auth, certificates, or OAuth)
- Handle rate limiting and retry logic
- Support both cluster-level and SVM-level operations
- Follow NetApp's REST API best practices

## Resources
- MCP Documentation: https://modelcontextprotocol.io/llms-full.txt
- MCP SDK Reference: https://github.com/modelcontextprotocol/create-python-server
- NetApp ONTAP REST API Documentation: https://docs.netapp.com/us-en/ontap-automation/
