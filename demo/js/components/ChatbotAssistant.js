// NetApp ONTAP Provisioning Assistant (Chatbot)
// Complete implementation with full functionality from original app.js
class ChatbotAssistant {
    constructor(demo) {
        this.demo = demo;
        this.isInitialized = false;
        this.config = null;
        this.messages = [];
        this.availableTools = [];
        this.toolDefinitions = [];
        this.mockMode = false;
        this.isThinking = false;
        
        this.init();
    }

    async init() {
        // Load ChatGPT configuration
        await this.loadConfig();
        
        // Initialize UI elements
        this.initializeUI();
        
        // Discover available MCP tools
        await this.discoverTools();
        
        // Show welcome message
        this.showWelcomeMessage();
        
        this.isInitialized = true;
        this.updateStatus('Ready to help with ONTAP provisioning');
        this.enableInput();
    }

    async loadConfig() {
        try {
            const response = await fetch('./chatgpt-config.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.config = await response.json();
            
            // Validate API key
            if (!this.config.api_key || this.config.api_key === 'YOUR_CHATGPT_API_KEY_HERE') {
                throw new Error('No valid ChatGPT API key configured');
            }
            
            console.log('ChatGPT config loaded successfully');
        } catch (error) {
            console.warn('ChatGPT config load failed, enabling mock mode:', error.message);
            this.mockMode = true;
            this.config = {
                model: 'mock-gpt-5',
                max_completion_tokens: 2000
            };
        }
    }

    initializeUI() {
        // Toggle button
        const toggleBtn = document.getElementById('chatbotToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleChatbot());
        }

        // Input and send button
        const input = document.getElementById('chatbotInput');
        const sendBtn = document.getElementById('chatbotSend');

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });

            input.addEventListener('input', (e) => {
                this.toggleSendButton(e.target.value.trim().length > 0);
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Start collapsed
        document.querySelector('.chatbot-container').classList.add('collapsed');
    }

    async discoverTools() {
        try {
            this.updateStatus('Discovering available ONTAP tools...');
            
            // Call the MCP server's tools endpoint to get the real list
            const response = await fetch(`${this.demo.mcpUrl}/api/tools`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            if (data.tools && Array.isArray(data.tools)) {
                // Cache full tool definitions for OpenAI function calling
                this.toolDefinitions = data.tools;
                // Extract tool names from the full MCP tool definitions
                this.availableTools = data.tools.map(tool => tool.name);
                console.log(`Discovered ${this.availableTools.length} ONTAP tools:`, this.availableTools);
            } else {
                throw new Error('Invalid response format from tools endpoint');
            }
        } catch (error) {
            console.error('Tool discovery failed, using fallback list:', error);
            // Fallback to a minimal set of core tools
            this.availableTools = [
                'list_registered_clusters',
                'cluster_list_volumes',
                'cluster_list_aggregates', 
                'cluster_list_svms',
                'cluster_create_volume',
                'create_export_policy',
                'add_export_rule',
                'create_cifs_share',
                'list_snapshot_policies',
                'get_volume_stats'
            ];
            this.toolDefinitions = []; // Empty cache for fallback
        }
    }

    toggleChatbot() {
        const container = document.querySelector('.chatbot-container');
        container.classList.toggle('collapsed');
    }

    showWelcomeMessage() {
        const welcomeMsg = this.mockMode 
            ? "👋 Hello! I'm your NetApp ONTAP provisioning assistant (running in demo mode). I can help you find the best storage locations across your ONTAP clusters based on available capacity and best practices.\n\nTry asking me: \"Provision a 100mb NFS volume for a database workload\""
            : "👋 Hello! I'm your NetApp ONTAP provisioning assistant. I can help you find the best storage locations across your ONTAP clusters based on available capacity and best practices.\n\nTry asking me: \"Provision a 100mb NFS volume for a database workload\"";

        this.addMessage('assistant', welcomeMsg);
    }

    async sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();
        
        if (!message || this.isThinking) return;

        // Add user message
        this.addMessage('user', message);
        input.value = '';
        this.toggleSendButton(false);

        // Show thinking state
        this.showThinking();

        try {
            let response;
            if (this.mockMode) {
                response = await this.getMockResponse(message);
            } else {
                response = await this.getChatGPTResponse(message);
            }
            
            this.hideThinking();
            this.addMessage('assistant', response.text, response.actions);

        } catch (error) {
            this.hideThinking();
            this.addMessage('assistant', `❌ Sorry, I encountered an error: ${error.message}`);
            console.error('Chat error:', error);
        }
    }

    async getMockResponse(message) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        const lowerMsg = message.toLowerCase();
        
        if (lowerMsg.includes('provision') && lowerMsg.includes('volume')) {
            return {
                text: "Based on your request for volume provisioning, I recommend creating a 100MB volume on **greg-vsim-2** in SVM **vs0** using aggregate **storage_availability_zone_0** which has the most available capacity.\n\nWould you like me to populate the provisioning form with these settings?",
                actions: []
            };
        } else if (lowerMsg.includes('cifs') || lowerMsg.includes('smb')) {
            return {
                text: "For CIFS/SMB shares, I recommend **greg-vsim-1** with SVM **vs0** which has good capacity and is configured for Windows environments.\n\nShall I prepare a CIFS share configuration?",
                actions: []
            };
        } else if (lowerMsg.includes('capacity') || lowerMsg.includes('space')) {
            return {
                text: "Here's the current capacity overview across your clusters:\n\n**greg-vsim-1**: Available capacity\n**greg-vsim-2**: Available capacity\n**julia-vsim-1**: Available capacity\n**karan-ontap-1**: Available capacity\n\nLet me know which cluster interests you for provisioning!"
            };
        } else {
            return {
                text: "I'm here to help with ONTAP storage provisioning! I can:\n\n• Recommend optimal placement for new volumes\n• Suggest CIFS share configurations\n• Analyze cluster capacity\n• Apply settings to the provisioning form\n\nWhat storage task can I help you with?"
            };
        }
    }

    parseResponseActions(response) {
        const actions = [];
        let text = response;

        // Auto-detect provisioning recommendations and populate form
        if (this.isProvisioningIntent(response)) {
            const recommendations = this.extractProvisioningRecommendations(response);
            if (recommendations) {
                // Automatically populate the form with the recommendations
                setTimeout(() => {
                    this.autoPopulateForm(recommendations);
                }, 1000);
            }
        }

        return { text, actions };
    }

    isProvisioningIntent(response) {
        // Check for structured provisioning recommendation format
        if (/## PROVISIONING_RECOMMENDATION/i.test(response)) {
            return true;
        }

        // Fallback: Check for strong provisioning indicators
        const provisioningIndicators = [
            /Would you like me to proceed with creating/i,
            /Would you like me to.*populate.*form/i,
            /recommend.*creating.*volume/i,
            /best.*aggregate/i
        ];

        // Count positive indicators
        const positiveCount = provisioningIndicators.filter(pattern => pattern.test(response)).length;
        return positiveCount >= 1;
    }

    extractProvisioningRecommendations(response) {
        const recommendations = {};
        
        // Look for cluster names mentioned in response
        const clusterMatch = response.match(/\*\*(greg-vsim-[12]|julia-vsim-1|karan-ontap-1)\*\*/i);
        if (clusterMatch) {
            recommendations.cluster = clusterMatch[1];
        }
        
        // Look for SVM names
        const svmMatch = response.match(/SVM\s+\*\*([^*]+)\*\*/i);
        if (svmMatch) {
            recommendations.svm = svmMatch[1];
        }
        
        // Look for aggregate names
        const aggregateMatch = response.match(/aggregate\s+\*\*([^*]+)\*\*/i);
        if (aggregateMatch) {
            recommendations.aggregate = aggregateMatch[1];
        }
        
        // Look for size
        const sizeMatch = response.match(/(\d+)\s*(MB|GB|TB)/i);
        if (sizeMatch) {
            recommendations.size = sizeMatch[1];
            recommendations.unit = sizeMatch[2];
        }

        console.log('Extracted recommendations:', recommendations);
        return Object.keys(recommendations).length > 0 ? recommendations : null;
    }

    async getChatGPTResponse(message) {
        const systemPrompt = this.buildSystemPrompt();
        const conversationHistory = this.buildConversationHistory();

        // Build tools for ChatGPT function calling (newer format)
        const tools = this.buildMCPTools();

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...conversationHistory,
                    { role: 'user', content: message }
                ],
                max_completion_tokens: this.config.max_completion_tokens,
                tools: tools,
                tool_choice: 'auto' // Let ChatGPT decide when to use tools
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`ChatGPT API error: ${response.status} ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        console.log('ChatGPT API response:', data);
        
        const choice = data.choices?.[0];
        if (!choice) {
            throw new Error('No choices in ChatGPT response');
        }

        // Handle tool calls (newer format)
        if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
            console.log('Tool calls detected:', choice.message.tool_calls);
            return await this.handleToolCalls(message, choice.message.tool_calls, 0);
        }

        const aiResponse = choice.message?.content;
        if (!aiResponse || aiResponse.trim() === '') {
            console.error('No content in ChatGPT response:', data);
            
            const finishReason = choice.finish_reason;
            console.log('Finish reason:', finishReason);
            
            if (finishReason === 'content_filter') {
                throw new Error('Response was filtered by content policy. Please try rephrasing your request.');
            }
            
            throw new Error(`ChatGPT returned empty response (finish_reason: ${finishReason || 'unknown'})`);
        }

        console.log('ChatGPT response content:', aiResponse);
        return this.parseResponseActions(aiResponse);
    }

    buildSystemPrompt() {
        const selectedCluster = this.demo.selectedCluster;
        const clusterInfo = selectedCluster ? 
            `The user has selected cluster "${selectedCluster.name}" (${selectedCluster.cluster_ip})` : 
            'No specific cluster is currently selected';

        return `You are a NetApp ONTAP provisioning assistant. Your job is to help users provision storage across their ONTAP clusters by finding optimal locations based on available capacity and best practices.

CONTEXT:
- User has access to multiple ONTAP clusters through the NetApp ONTAP MCP
- ${clusterInfo}
- You have access to ALL ${this.availableTools.length} MCP functions covering:
  * Cluster management (list_registered_clusters, get_all_clusters_info)
  * Volume operations (cluster_create_volume, cluster_list_volumes, resize_volume, etc.)
  * CIFS/SMB shares (create_cifs_share, cluster_list_cifs_shares, update_cifs_share)
  * NFS exports (create_export_policy, add_export_rule, configure_volume_nfs_access)
  * Snapshot policies (create_snapshot_policy, list_snapshot_policies)
  * Aggregates and SVMs (cluster_list_aggregates, cluster_list_svms)
  * Performance monitoring (get_volume_stats, cluster_get_volume_stats)
- You can perform multi-step analysis and complete provisioning workflows

MANDATORY WORKFLOW FOR PROVISIONING REQUESTS:
1. ALWAYS call list_registered_clusters first to get all available clusters
2. For EACH cluster, call BOTH cluster_list_aggregates AND cluster_list_svms (not just one)
3. Analyze capacity and SVM availability across ALL clusters
4. Recommend specific: Cluster name, SVM name, Aggregate name, Size, Protocol
5. NEVER say "Please provide an SVM" - you must specify the exact SVM name from step 2

CRITICAL PROVISIONING REQUIREMENTS:
- ALWAYS use BOTH cluster_list_aggregates AND cluster_list_svms for EACH cluster before making recommendations
- For multi-cluster analysis, call cluster_list_aggregates AND cluster_list_svms for ALL clusters
- NEVER make recommendations without checking BOTH aggregates and SVMs for each cluster
- ALWAYS specify exact cluster name, SVM name, and aggregate name in recommendations
- Choose aggregates with sufficient available space and good utilization ratios
- Provide complete provisioning details: Cluster, SVM, Aggregate, Size, Protocol

CAPABILITIES:
- Query cluster capacity and aggregates using cluster functions
- Check SVM availability and volume placement
- Create volumes with CIFS shares or NFS exports in one operation
- Set up snapshot policies and schedules
- Perform comprehensive capacity analysis across all clusters
- Execute complete provisioning workflows from analysis to creation

GUIDELINES:
- When making recommendations, gather essential cluster information efficiently
- Use 1-3 targeted tool calls to get the information needed
- Provide specific cluster, SVM, and aggregate combinations based on actual data
- Focus on giving actionable recommendations rather than exhaustive analysis
- When user requests provisioning, execute the actual creation (don't just recommend)
- Ask for confirmation before making changes to production systems
- Be conversational but technically accurate

RESPONSE FORMAT FOR PROVISIONING:
When providing storage provisioning recommendations, ALWAYS use this exact structured format:

## PROVISIONING_RECOMMENDATION
- **Cluster**: [exact cluster name]
- **SVM**: [exact SVM name]
- **Aggregate**: [exact aggregate name]
- **Size**: [requested size with units like 100MB, 1GB, etc.]
- **Protocol**: [NFS or CIFS]
- **Snapshot_Policy**: [policy name - optional]
- **Export_Policy**: [policy name - optional for NFS]
## END_PROVISIONING_RECOMMENDATION

CRITICAL: This structured format is required for ALL provisioning recommendations. It enables automatic form population for the user.

EXAMPLE CORRECT FORMAT:
## PROVISIONING_RECOMMENDATION
- **Cluster**: greg-vsim-2
- **SVM**: svm1
- **Aggregate**: storage_availability_zone_0
- **Size**: 100MB
- **Protocol**: NFS
## END_PROVISIONING_RECOMMENDATION

After the structured recommendation block, you can add explanatory text about why you chose these settings.

RESPONSE STRATEGY:
- Make focused tool calls to gather specific information needed
- After 1-2 tool calls, provide recommendations based on the data collected
- Avoid excessive analysis - aim for actionable recommendations quickly`;
    }

    buildMCPTools() {
        // Convert ALL available MCP tools to OpenAI tools format using cached definitions
        const mcpTools = [];
        
        // Use cached tool definitions if available
        if (this.toolDefinitions && this.toolDefinitions.length > 0) {
            this.toolDefinitions.forEach(toolDef => {
                const openAITool = {
                    type: 'function',
                    function: {
                        name: toolDef.name,
                        description: toolDef.description,
                        parameters: toolDef.inputSchema || {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                };
                mcpTools.push(openAITool);
            });
        } else {
            // Fallback: create basic definitions for available tool names
            this.availableTools.forEach(toolName => {
                mcpTools.push({
                    type: 'function',
                    function: {
                        name: toolName,
                        description: `NetApp ONTAP ${toolName} operation`,
                        parameters: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                });
            });
        }

        return mcpTools;
    }

    async handleToolCalls(originalMessage, toolCalls, recursionDepth = 0) {
        const MAX_RECURSION_DEPTH = 3; // Allow 3 rounds of tool calls for complete analysis
        
        if (recursionDepth >= MAX_RECURSION_DEPTH) {
            console.warn('Maximum tool call recursion depth reached. Stopping tool execution.');
            return {
                text: '⚠️ I\'ve completed the initial analysis but reached the maximum number of tool executions. Based on the information gathered, I can see the available clusters. Please ask me for a specific recommendation like "recommend the best aggregate on greg-vsim-2 for a 100GB volume".',
                actions: []
            };
        }

        console.log(`Handling tool calls (depth: ${recursionDepth + 1}/${MAX_RECURSION_DEPTH}):`, toolCalls.map(t => t.function.name));

        // Execute all tool calls
        const toolResults = [];
        for (const toolCall of toolCalls) {
            try {
                const result = await this.executeMCPTool(toolCall);
                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: toolCall.function.name,
                    content: result
                });
            } catch (error) {
                console.error(`Failed to execute tool ${toolCall.function.name}:`, error);
                toolResults.push({
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: toolCall.function.name,
                    content: `Error executing tool: ${error.message}`
                });
            }
        }

        // Send results back to ChatGPT
        return await this.getChatGPTResponseWithToolResults(originalMessage, toolCalls, toolResults, recursionDepth + 1);
    }

    async executeMCPTool(toolCall) {
        const { function: func } = toolCall;
        const { name, arguments: args } = func;

        try {
            const parsedArgs = JSON.parse(args);
            const response = await fetch(`${this.demo.mcpUrl}/api/tools/${name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(parsedArgs)
            });

            if (!response.ok) {
                throw new Error(`MCP API error: ${response.status}`);
            }

            const data = await response.json();

            // Extract text content from MCP response
            const textContent = data.content
                .filter(item => item.type === 'text')
                .map(item => item.text)
                .join('');

            return textContent;
        } catch (error) {
            console.error(`Error executing MCP tool ${name}:`, error);
            return `Error: Failed to execute ${name} - ${error.message}`;
        }
    }

    async getChatGPTResponseWithToolResults(originalMessage, toolCalls, toolResults, recursionDepth = 0) {
        const systemPrompt = this.buildSystemPrompt();
        const conversationHistory = this.buildConversationHistory();
        const tools = this.buildMCPTools();

        // Build the messages including the tool calls and results
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: originalMessage },
            { 
                role: 'assistant', 
                content: null,
                tool_calls: toolCalls
            },
            ...toolResults
        ];

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: messages,
                max_completion_tokens: this.config.max_completion_tokens,
                tools: tools,
                tool_choice: recursionDepth >= 2 ? 'none' : 'auto' // Force ChatGPT to respond without tools after 2 recursions
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`ChatGPT API error: ${response.status} ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        
        // Handle potential additional tool calls (multi-step workflows) only if not at max depth
        if (choice.message?.tool_calls && choice.message.tool_calls.length > 0 && recursionDepth < 2) {
            console.log(`Additional tool calls detected at depth ${recursionDepth}, continuing workflow...`);
            return await this.handleToolCalls(originalMessage, choice.message.tool_calls, recursionDepth);
        }

        const aiResponse = choice.message?.content;
        if (!aiResponse || aiResponse.trim() === '') {
            // If ChatGPT doesn't provide content, create a summary response
            const toolNames = toolCalls.map(tc => tc.function.name).join(', ');
            return this.parseResponseActions(`I've executed the following tools: ${toolNames}. Please let me know if you need specific information from these results or try a more specific question.`);
        }

        console.log('Final ChatGPT response:', aiResponse);
        return this.parseResponseActions(aiResponse);
    }

    buildConversationHistory() {
        return this.messages
            .filter(msg => msg.role !== 'system')
            .map(msg => ({
                role: msg.role,
                content: msg.content
            }))
            .slice(-10); // Keep last 10 messages for context
    }

    parseResponseActions(response) {
        const actions = [];
        let text = response;

        // Look for "Apply to Form" patterns
        const actionPattern = /Apply to Form:\s*(\w+)/gi;
        let match;

        while ((match = actionPattern.exec(response)) !== null) {
            actions.push({
                label: "Apply to Form",
                action: match[1].toLowerCase(),
                data: {} // Would be populated based on context
            });
        }

        // Auto-detect provisioning recommendations and populate form
        if (this.isProvisioningIntent(response)) {
            const recommendations = this.extractProvisioningRecommendations(response);
            if (recommendations) {
                // Automatically populate the form with the recommendations
                setTimeout(() => {
                    this.autoPopulateForm(recommendations);
                }, 1000);
            }
        }

        return { text, actions };
    }

    isProvisioningIntent(response) {
        // Check for structured provisioning recommendation format
        if (/## PROVISIONING_RECOMMENDATION/i.test(response)) {
            return true;
        }

        // Fallback: Check for strong provisioning indicators for backward compatibility
        const provisioningIndicators = [
            /## Recommendation:/i,
            /Would you like me to proceed with creating/i,
            /Would you like me to apply.*to.*form/i,
            /Next Steps:/i,
            /best option for provisioning/i,
            /recommend.*creating.*volume/i,
            /Given.*capacities.*best option/i
        ];

        // Check for error/informational indicators that should NOT trigger provisioning
        const nonProvisioningIndicators = [
            /unable to resolve/i,
            /failed to access/i,
            /error accessing/i,
            /issue.*cluster/i,
            /cannot connect/i,
            /connection.*failed/i
        ];

        // If we find error indicators, this is NOT a provisioning intent
        if (nonProvisioningIndicators.some(pattern => pattern.test(response))) {
            return false;
        }

        // Count positive indicators - need at least 2 for backward compatibility
        const positiveCount = provisioningIndicators.filter(pattern => pattern.test(response)).length;
        return positiveCount >= 2;
    }

    extractProvisioningRecommendations(response) {
        // First, check for structured recommendation format (preferred)
        const structuredMatch = response.match(/## PROVISIONING_RECOMMENDATION(.*?)## END_PROVISIONING_RECOMMENDATION/is);
        
        if (structuredMatch) {
            const recommendationBlock = structuredMatch[1];
            const recommendations = {};
            
            // Extract structured fields
            const clusterMatch = recommendationBlock.match(/\*\*Cluster\*\*:\s*([^\n]+)/i);
            if (clusterMatch) recommendations.cluster = clusterMatch[1].trim();
            
            const svmMatch = recommendationBlock.match(/\*\*SVM\*\*:\s*([^\n]+)/i);
            if (svmMatch) recommendations.svm = svmMatch[1].trim();
            
            const aggregateMatch = recommendationBlock.match(/\*\*Aggregate\*\*:\s*([^\n]+)/i);
            if (aggregateMatch) recommendations.aggregate = aggregateMatch[1].trim();
            
            const sizeMatch = recommendationBlock.match(/\*\*Size\*\*:\s*([^\n]+)/i);
            if (sizeMatch) {
                const sizeText = sizeMatch[1].trim();
                const sizeParts = sizeText.match(/(\d+)\s*(MB|GB|TB)/i);
                if (sizeParts) {
                    recommendations.size = sizeParts[1];
                    recommendations.unit = sizeParts[2];
                }
            }
            
            const protocolMatch = recommendationBlock.match(/\*\*Protocol\*\*:\s*([^\n]+)/i);
            if (protocolMatch) recommendations.protocol = protocolMatch[1].trim().toLowerCase();
            
            const snapshotMatch = recommendationBlock.match(/\*\*Snapshot_Policy\*\*:\s*([^\n]+)/i);
            if (snapshotMatch) recommendations.snapshotPolicy = snapshotMatch[1].trim();
            
            const exportMatch = recommendationBlock.match(/\*\*Export_Policy\*\*:\s*([^\n]+)/i);
            if (exportMatch) recommendations.exportPolicy = exportMatch[1].trim();
            
            console.log('Structured recommendations extracted:', recommendations);
            return Object.keys(recommendations).length > 0 ? recommendations : null;
        }
        
        // Fallback to legacy pattern matching for backward compatibility
        const recommendations = {};
        
        // Look for cluster names mentioned in response
        const clusterMatch = response.match(/\*\*(greg-vsim-[12]|julia-vsim-1|karan-ontap-1)\*\*/i);
        if (clusterMatch) {
            recommendations.cluster = clusterMatch[1];
        }
        
        // Look for SVM names
        const svmMatch = response.match(/SVM\s+\*\*([^*]+)\*\*/i);
        if (svmMatch) {
            recommendations.svm = svmMatch[1];
        }
        
        // Look for aggregate names
        const aggregateMatch = response.match(/aggregate\s+\*\*([^*]+)\*\*/i);
        if (aggregateMatch) {
            recommendations.aggregate = aggregateMatch[1];
        }
        
        // Look for size
        const sizeMatch = response.match(/(\d+)\s*(MB|GB|TB)/i);
        if (sizeMatch) {
            recommendations.size = sizeMatch[1];
            recommendations.unit = sizeMatch[2];
        }

        console.log('Legacy recommendations extracted:', recommendations);
        return Object.keys(recommendations).length > 0 ? recommendations : null;
    }

    // Helper function to wait for an element to exist
    waitForElement(elementId, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkElement = () => {
                const element = document.getElementById(elementId);
                if (element) {
                    console.log(`Element ${elementId} found after ${Date.now() - startTime}ms`);
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    console.error(`Element ${elementId} not found within ${timeout}ms`);
                    reject(new Error(`Element ${elementId} not found within ${timeout}ms`));
                } else {
                    setTimeout(checkElement, 100);
                }
            };
            checkElement();
        });
    }

    // Helper function to wait for dropdown to have options
    waitForDropdownOptions(elementId, timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkOptions = () => {
                const element = document.getElementById(elementId);
                if (element && element.options && element.options.length > 1) {
                    // Check that we have actual data options, not just loading/placeholder text
                    const hasRealOptions = Array.from(element.options).some(option => 
                        option.value && 
                        option.value !== '' && 
                        !option.text.includes('Loading') && 
                        !option.text.includes('Select') &&
                        !option.text.includes('Error')
                    );
                    
                    if (hasRealOptions) {
                        console.log(`Dropdown ${elementId} populated with real options`);
                        resolve(element);
                    } else if (Date.now() - startTime > timeout) {
                        console.log(`Dropdown ${elementId} options not loaded within ${timeout}ms`);
                        resolve(null);
                    } else {
                        setTimeout(checkOptions, 200);
                    }
                } else if (Date.now() - startTime > timeout) {
                    console.log(`Dropdown ${elementId} not ready within ${timeout}ms`);
                    resolve(null);
                } else {
                    setTimeout(checkOptions, 200);
                }
            };
            checkOptions();
        });
    }

    async autoPopulateForm(recommendations) {
        console.log('Auto-populating form with recommendations:', recommendations);
        
        // Ensure correct cluster is selected
        if (recommendations.cluster) {
            const clusterObj = this.demo.clusters.find(c => c.name === recommendations.cluster);
            if (clusterObj) {
                const previousCluster = this.demo.selectedCluster?.name;
                this.demo.selectedCluster = clusterObj;
                console.log('Cluster object found and set:', clusterObj);
                
                // Also update the radio button selection
                const radio = document.querySelector(`input[name="selectedCluster"][value="${recommendations.cluster}"]`);
                if (radio) {
                    radio.checked = true;
                    console.log('Radio button selected for cluster:', recommendations.cluster);
                }
                
                // If we switched clusters, wait for UI update
                if (previousCluster !== recommendations.cluster) {
                    console.log('Cluster switched - waiting for UI update');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        // Open the provisioning panel
        if (!this.demo.selectedCluster) {
            this.addMessage('assistant', '⚠️ Cannot open provisioning form - no cluster is selected.');
            return;
        }
        
        this.demo.openProvisionStorage();
        
        try {
            // Wait for provisioning panel to open
            console.log('Waiting for provisioning panel...');
            await this.waitForElement('provisioningPanel', 3000);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Wait for SVM select dropdown
            await this.waitForElement('svmSelect', 5000);
            
            // Reload provisioning data if cluster switched
            if (recommendations.cluster) {
                console.log('Forcing reload of provisioning data');
                await this.demo.provisioningPanel.loadData();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // Wait for SVM dropdown to be populated
            console.log('Waiting for SVM dropdown to be populated...');
            await this.waitForDropdownOptions('svmSelect', 10000);
            
            let populated = false;
            
            // Populate SVM first
            if (recommendations.svm) {
                console.log('Populating SVM:', recommendations.svm);
                const svmSelect = document.getElementById('svmSelect');
                if (svmSelect && svmSelect.options.length > 0) {
                    for (let option of svmSelect.options) {
                        if (option.value.toLowerCase() === recommendations.svm.toLowerCase()) {
                            svmSelect.value = option.value;
                            svmSelect.dispatchEvent(new Event('change'));
                            populated = true;
                            console.log('SVM populated:', option.value);
                            break;
                        }
                    }
                }
                
                // Wait for aggregate dropdown after SVM change
                await this.waitForDropdownOptions('aggregateSelect', 3000);
            }
            
            // Populate aggregate
            if (recommendations.aggregate) {
                const aggregateSelect = document.getElementById('aggregateSelect');
                if (aggregateSelect && aggregateSelect.options.length > 0) {
                    for (let option of aggregateSelect.options) {
                        if (!option.value || option.value.trim() === '') continue;
                        
                        if (option.value.toLowerCase().includes(recommendations.aggregate.toLowerCase()) ||
                            recommendations.aggregate.toLowerCase().includes(option.value.toLowerCase())) {
                            aggregateSelect.value = option.value;
                            populated = true;
                            console.log('Aggregate populated:', option.value);
                            break;
                        }
                    }
                }
            }
            
            // Populate volume name
            const nameInput = document.getElementById('volumeName');
            if (nameInput) {
                const svm = recommendations.svm || 'vol';
                const size = recommendations.size || '100';
                const unit = (recommendations.unit || 'MB').toLowerCase();
                const timestamp = new Date().toISOString().slice(5, 16).replace(/[-:]/g, '');
                const generatedName = `${svm}_vol_${size}${unit}_${timestamp}`;
                nameInput.value = generatedName;
                populated = true;
                console.log('Volume name populated:', generatedName);
            }
            
            // Populate size
            if (recommendations.size) {
                const sizeInput = document.getElementById('volumeSize');
                if (sizeInput) {
                    const sizeValue = recommendations.size + (recommendations.unit || 'MB');
                    sizeInput.value = sizeValue;
                    populated = true;
                    console.log('Size populated:', sizeValue);
                }
            }
            
            if (populated) {
                this.addMessage('assistant', '✅ I\'ve automatically populated the provisioning form with my recommendations. Please review the settings and click "Create Volume" when ready!');
            } else {
                this.addMessage('assistant', '⚠️ I opened the provisioning form but couldn\'t auto-populate all fields. Please fill in the form manually based on my recommendations above.');
            }
            
        } catch (error) {
            console.error('Error auto-populating form:', error);
            this.addMessage('assistant', '⚠️ I couldn\'t fully populate the provisioning form. Please fill it in manually based on my recommendations.');
        }
    }

    addMessage(role, content, actions = []) {
        this.messages.push({ role, content, timestamp: new Date() });

        const messagesContainer = document.getElementById('chatbotMessages');
        if (!messagesContainer) {
            console.error('ChatbotMessages container not found');
            return;
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${role}`;

        const avatar = document.createElement('div');
        avatar.className = 'chatbot-message-avatar';
        avatar.textContent = role === 'user' ? 'U' : 'AI';

        const messageContent = document.createElement('div');
        messageContent.className = 'chatbot-message-content';
        messageContent.innerHTML = this.formatMessage(content);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);

        // Add action buttons if provided
        if (actions && actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'chatbot-message-actions';

            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'chatbot-action-button';
                button.textContent = action.label;
                button.onclick = () => this.handleAction(action);
                actionsDiv.appendChild(button);
            });

            messageContent.appendChild(actionsDiv);
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatMessage(content) {
        // Convert markdown-style formatting to HTML
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }

    handleAction(action) {
        console.log('ChatbotAssistant action:', action);
        // Action handling can be implemented as needed
    }

    showThinking() {
        this.isThinking = true;
        const thinkingMsg = document.createElement('div');
        thinkingMsg.className = 'chatbot-message assistant thinking';
        thinkingMsg.id = 'thinking-message';

        const avatar = document.createElement('div');
        avatar.className = 'chatbot-message-avatar';
        avatar.textContent = 'AI';

        const content = document.createElement('div');
        content.className = 'chatbot-message-content';
        content.innerHTML = `Thinking<span class="chatbot-thinking-dots"><span></span><span></span><span></span></span>`;

        thinkingMsg.appendChild(avatar);
        thinkingMsg.appendChild(content);

        const messagesContainer = document.getElementById('chatbotMessages');
        if (messagesContainer) {
            messagesContainer.appendChild(thinkingMsg);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    hideThinking() {
        this.isThinking = false;
        const thinkingMsg = document.getElementById('thinking-message');
        if (thinkingMsg) {
            thinkingMsg.remove();
        }
    }

    enableInput() {
        const input = document.getElementById('chatbotInput');
        const sendBtn = document.getElementById('chatbotSend');
        
        if (input) input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
    }

    updateStatus(message, isError = false) {
        const status = document.getElementById('chatbotStatus');
        if (status) {
            status.textContent = message;
            status.className = `chatbot-status ${isError ? 'error' : ''}`;
        }
    }

    toggleSendButton(enabled) {
        const sendBtn = document.getElementById('chatbotSend');
        if (sendBtn) {
            sendBtn.disabled = !enabled || this.isThinking;
        }
    }
}

// Export for global access
window.ChatbotAssistant = ChatbotAssistant;