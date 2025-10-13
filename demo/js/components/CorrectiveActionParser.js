// Corrective Action Parser - LLM-powered parser for alert corrective actions
// Extracts structured Fix-It actions from alert rule annotations
// Reuses ChatbotAssistant's OpenAI config to avoid duplicate sessions

class CorrectiveActionParser {
    constructor() {
        this.config = null;
        this.clientManager = null;
        this.mockMode = false;
        this.availableTools = [];
    }

    /**
     * Initialize with MCP client manager (config from centralized service)
     */
    async initWithConfig(clientManager) {
        // Get config from centralized OpenAI service
        if (!window.openAIService.getConfig()) {
            await window.openAIService.initialize();
        }
        
        this.config = window.openAIService.getConfig();
        this.clientManager = clientManager;
        this.mockMode = window.openAIService.isMockMode();
        
        // Discover available MCP tools dynamically
        await this.discoverAvailableTools();
        
        if (this.mockMode) {
            console.log('⚠️ CorrectiveActionParser running in mock mode (no ChatGPT API key configured)');
        } else {
            console.log('✅ CorrectiveActionParser initialized with ChatGPT integration');
        }
    }

    /**
     * Discover available MCP tools dynamically
     */
    async discoverAvailableTools() {
        try {
            console.log('🔍 Discovering available MCP tools for CorrectiveActionParser...');
            
            if (!this.clientManager) {
                console.warn('No MCP client manager available, using empty tool list');
                this.availableTools = [];
                return;
            }
            
            // Get all tools from all connected MCP servers
            const allTools = await this.clientManager.listAllTools();
            
            if (allTools && Array.isArray(allTools) && allTools.length > 0) {
                this.availableTools = allTools;
                
                // Log discovery results
                const stats = this.clientManager.getStats();
                console.log(`📊 CorrectiveActionParser Tool Discovery:`);
                console.log(`   • Total tools available: ${allTools.length} from ${stats.connectedServers} server(s)`);
                
                // Show tools by server
                const toolsByServer = {};
                this.availableTools.forEach(tool => {
                    const servers = tool.servers || tool.availableFrom || ['unknown'];
                    servers.forEach(server => {
                        if (!toolsByServer[server]) toolsByServer[server] = 0;
                        toolsByServer[server]++;
                    });
                });
                
                Object.entries(toolsByServer).forEach(([server, count]) => {
                    console.log(`   • ${server}: ${count} tool(s)`);
                });
                
                console.log(`✅ Dynamic tool discovery complete for CorrectiveActionParser`);
            } else {
                console.warn('No tools discovered from MCP servers');
                this.availableTools = [];
            }
        } catch (error) {
            console.error('❌ Tool discovery failed:', error);
            this.availableTools = [];
        }
    }

    /**
     * Build system prompt with dynamic tool documentation
     */
    buildSystemPrompt() {
        // Build tool documentation from discovered tools
        let toolDocumentation = '';
        
        if (this.availableTools && this.availableTools.length > 0) {
            // Filter to only NetApp ONTAP tools for corrective actions
            const ontapTools = this.availableTools.filter(tool => {
                const servers = tool.servers || tool.availableFrom || [];
                return servers.includes('netapp-ontap');
            });
            
            toolDocumentation = ontapTools.map(tool => {
                // Extract tool name and description
                const name = tool.name;
                const description = tool.description || 'No description available';
                
                // Extract key parameters from inputSchema
                let paramInfo = '';
                if (tool.inputSchema && tool.inputSchema.properties) {
                    const params = Object.keys(tool.inputSchema.properties);
                    const requiredParams = tool.inputSchema.required || [];
                    
                    // Highlight important parameters
                    const keyParams = params.filter(p => 
                        requiredParams.includes(p) || 
                        ['volume_uuid', 'size', 'state', 'mode', 'snapshot_uuid'].includes(p)
                    );
                    
                    if (keyParams.length > 0) {
                        paramInfo = ` (key params: ${keyParams.join(', ')})`;
                    }
                }
                
                return `- ${name}: ${description}${paramInfo}`;
            }).join('\n');
            
            console.log(`📝 Generated tool documentation for ${ontapTools.length} ONTAP tools`);
        } else {
            // Fallback to minimal set if discovery failed
            console.warn('⚠️ No tools discovered, using fallback minimal tool list');
            toolDocumentation = `
- cluster_update_volume: Update volume properties including size and state (key params: volume_uuid, size, state, comment)
- cluster_enable_volume_autosize: Enable/configure volume autosize (key params: volume_uuid, mode, maximum_size)
- cluster_delete_volume_snapshot: Delete a specific snapshot (key params: volume_uuid, snapshot_uuid)
- cluster_list_volume_snapshots: List all snapshots for a volume (key params: volume_uuid)
`.trim();
        }
        
        return `You are a NetApp ONTAP storage expert assistant that parses corrective action text and maps ONTAP CLI commands to available MCP tools.

Your task is to convert natural language corrective action descriptions (which include ONTAP CLI commands) into a structured JSON response with remediation options.

Available MCP tools:
${toolDocumentation}

IMPORTANT MAPPING RULES:
1. "volume online" → cluster_update_volume with state='online'
2. "volume offline" → cluster_update_volume with state='offline'
3. "volume modify -size" → cluster_update_volume with size parameter
4. "volume autosize" → cluster_enable_volume_autosize
5. "snapshot delete" → cluster_delete_volume_snapshot

CLI COMMAND EXTRACTION:
- The corrective action text includes ONTAP CLI commands (usually numbered like "1. volume online...")
- EXTRACT the CLI command exactly as written
- Convert placeholders to curly brace format: <vserver_name> → {svm}, <volume_name> → {volume}, <size> → {size}
- Include the cli_command field with the normalized command

Always extract the solution_description from the CLI command context and provide clear param_hints.

Return ONLY valid JSON in this exact format (no markdown):
{
  "description": "Brief summary of the issue and available options",
  "remediation_options": [
    {
      "option_number": 1,
      "option_title": "Short title",
      "option_description": "What this option does",
      "solutions": [
        {
          "solution_title": "Specific action name",
          "solution_description": "Detailed explanation of what this will do",
          "mcp_tool": "exact_tool_name",
          "mcp_params": {
            "param_name": "param_value"
          },
          "requires_params": ["cluster_name", "volume_uuid", ...],
          "param_hints": {
            "param_name": "guidance for parameter value"
          },
          "cli_command": "volume online -vserver {svm} -volume {volume}"
        }
      ]
    }
  ]
}

IMPORTANT: 
- Always include the "cli_command" field by extracting it from the corrective action text and normalizing placeholders.
- Include "mcp_params" for state changes (e.g., {"state": "online"} for volume online command).`;
    }

    buildUserPrompt(correctiveActionText, alertContext) {
        return `Parse this alert corrective action into structured Fix-It options:

Alert Context:
- Alert Name: ${alertContext.alertname || 'Unknown'}
- Severity: ${alertContext.severity || 'Unknown'}
- Volume: ${alertContext.volume || 'Unknown'}
- Current Value: ${alertContext.value || 'Unknown'}

Corrective Action Text:
${correctiveActionText}

Map any ONTAP CLI commands to the appropriate MCP tools and provide clear parameter guidance.`;
    }

    async parseCorrectiveActions(correctiveActionText, alertContext = {}) {
        if (this.mockMode) {
            return this.mockParseCorrectiveActions(correctiveActionText, alertContext);
        }

        try {
            const systemPrompt = this.buildSystemPrompt();
            const userPrompt = this.buildUserPrompt(correctiveActionText, alertContext);
            
            console.log('🤖 Calling ChatGPT to parse corrective actions...');
            const jsonResponse = await this.callOpenAI(systemPrompt, userPrompt);
            
            // Parse the JSON response
            const parsed = JSON.parse(jsonResponse);
            console.log('✅ Successfully parsed corrective actions:', parsed);
            
            return parsed;
        } catch (error) {
            console.error('❌ Failed to parse corrective actions:', error);
            
            // Fallback to mock parser on error
            console.log('Falling back to mock parser...');
            return this.mockParseCorrectiveActions(correctiveActionText, alertContext);
        }
    }

    async callOpenAI(systemPrompt, userPrompt) {
        // Use centralized OpenAI service
        const data = await window.openAIService.callChatCompletion({
            component: 'CorrectiveActionParser',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1, // Low temperature for consistent parsing
            max_completion_tokens: 2000
        });

        const content = data.choices[0].message.content;
        
        // Remove markdown code blocks if present (defensive)
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        return cleanContent;
    }

    /**
     * Mock parser for testing without LLM API
     */
    mockParseCorrectiveActions(correctiveActionText, alertContext) {
        console.log('🎭 Using mock parser (no LLM API available)');
        
        // Check for volume offline alert
        if (correctiveActionText.includes('volume online') || 
            alertContext.alertname === 'Volume state offline') {
            return {
                description: "Volume is currently offline and inaccessible. You can bring it back online to restore access.",
                remediation_options: [
                    {
                        option_number: 1,
                        option_title: "Bring Volume Online",
                        option_description: "Change the volume state from offline to online to restore access.",
                        solutions: [
                            {
                                solution_title: "Set Volume State to Online",
                                solution_description: "Update the volume state to 'online' to make it accessible to clients.",
                                mcp_tool: "cluster_update_volume",
                                mcp_params: {
                                    "state": "online"
                                },
                                requires_params: ["cluster_name", "volume_uuid", "state"],
                                param_hints: {
                                    "state": "Set to 'online' to bring the volume back online"
                                },
                                cli_command: "volume online -vserver {svm} -volume {volume}"
                            }
                        ]
                    }
                ]
            };
        }
        
        // Check if this is the volume capacity alert
        if (correctiveActionText.includes('volume autosize') || 
            correctiveActionText.includes('runs out of space')) {
            
            return {
                description: "Volume is running low on space. You can enable automatic growth, manually increase the volume size, or free up space by deleting old snapshots.",
                remediation_options: [
                    {
                        option_number: 1,
                        option_title: "Enable Volume Autosize",
                        option_description: "Configure the volume to automatically grow when it reaches capacity thresholds.",
                        solutions: [
                            {
                                solution_title: "Enable Autosize (Grow Mode)",
                                solution_description: "Enable automatic volume growth up to a specified maximum size. Volume will grow when usage exceeds 85%.",
                                mcp_tool: "cluster_enable_volume_autosize",
                                requires_params: ["cluster_name", "volume_uuid", "mode", "maximum_size"],
                                param_hints: {
                                    "mode": "Set to 'grow' for automatic growth only",
                                    "maximum_size": "Recommend 2x current size (e.g., '1TB')",
                                    "grow_threshold_percent": "Default 85% is recommended"
                                }
                            }
                        ]
                    },
                    {
                        option_number: 2,
                        option_title: "Increase Volume Size",
                        option_description: "Manually increase the volume's capacity to provide more space.",
                        solutions: [
                            {
                                solution_title: "Set New Volume Size",
                                solution_description: "Directly set the volume to a new larger size (e.g., increase from 500GB to 800GB).",
                                mcp_tool: "cluster_update_volume",
                                requires_params: ["cluster_name", "volume_uuid", "size"],
                                param_hints: {
                                    "size": "Calculate new size to bring utilization to ~80% (e.g., if 92% used at 500GB, suggest 575GB)"
                                }
                            },
                            {
                                solution_title: "Add to Current Size",
                                solution_description: "Add a specific amount to the current volume size (e.g., add 100GB to current size).",
                                mcp_tool: "cluster_update_volume",
                                requires_params: ["cluster_name", "volume_uuid", "size"],
                                param_hints: {
                                    "size": "Add 20-50% to current size (e.g., if 500GB, add 100GB = 600GB total)"
                                }
                            }
                        ]
                    },
                    {
                        option_number: 3,
                        option_title: "Delete Old Snapshots",
                        option_description: "Free up space by deleting old or unnecessary snapshots.",
                        solutions: [
                            {
                                solution_title: "Delete Oldest Snapshot",
                                solution_description: "Find and delete the oldest snapshot to reclaim space. This is useful when snapshots are consuming significant capacity.",
                                mcp_tool: "cluster_delete_volume_snapshot",
                                requires_params: ["cluster_name", "volume_uuid", "snapshot_uuid"],
                                param_hints: {
                                    "snapshot_uuid": "Use cluster_list_volume_snapshots with sort_by='create_time' and order='asc' to find oldest"
                                }
                            }
                        ]
                    }
                ]
            };
        }
        
        // Generic fallback for unknown corrective actions
        return {
            description: "Corrective actions are available but could not be automatically parsed.",
            remediation_options: [
                {
                    option_number: 1,
                    option_title: "Manual Remediation Required",
                    option_description: "Please review the corrective action text and take appropriate manual action.",
                    solutions: []
                }
            ]
        };
    }
}
