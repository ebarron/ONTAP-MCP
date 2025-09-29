// NetApp ONTAP Provisioning Assistant (Chatbot)
// Complete implementation with full functionality from original app.js
class ChatbotAssistant {
    constructor(demo, options = {}) {
        this.demo = demo;
        this.options = {
            pageType: 'default',
            skipWorkingEnvironment: false,
            useStorageClassProvisioning: false,
            ...options
        };
        
        this.isInitialized = false;
        this.config = null;
        this.messages = [];           // UI messages (user/assistant only)
        this.conversationThread = []; // Complete OpenAI thread (all message types)
        this.availableTools = [];
        this.toolDefinitions = [];
        this.mockMode = false;
        this.isThinking = false;
        this.systemPromptTemplate = null; // Will be loaded from file
        this.lastChatGPTCallTime = 0; // Track last ChatGPT API call for rate limiting
        this.toolCallSignatures = new Map(); // Track unique tool call signatures to detect duplicates
        
        this.init();
    }

    async init() {
        // Load ChatGPT configuration
        await this.loadConfig();
        
        // Load system prompt template from file
        await this.loadSystemPromptTemplate();
        
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

    async loadSystemPromptTemplate() {
        try {
            const response = await fetch('./CHATBOT_SYSTEM_PROMPT.md');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.systemPromptTemplate = await response.text();
            console.log('System prompt template loaded successfully');
        } catch (error) {
            console.warn('System prompt template load failed, using fallback:', error.message);
            // Fallback to basic template if file load fails
            this.systemPromptTemplate = `You are a NetApp ONTAP provisioning assistant. Your job is to help users provision storage across their ONTAP clusters.

When providing storage provisioning recommendations, ALWAYS use this exact structured format:

## PROVISIONING_RECOMMENDATION
- **Cluster**: [exact cluster name]
- **SVM**: [exact SVM name]
- **Aggregate**: [exact aggregate name]
- **Size**: [requested size with units]
- **Protocol**: [NFS or CIFS]
## END_PROVISIONING_RECOMMENDATION

{{CLUSTER_INFO}}
Available tools: {{TOOLS_COUNT}}`;
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
                console.log(`Discovered ${this.availableTools.length} ONTAP tools`);
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
                'cluster_get_volume_stats'
            ];
            this.toolDefinitions = []; // Empty cache for fallback
        }
    }

    toggleChatbot() {
        const container = document.querySelector('.chatbot-container');
        container.classList.toggle('collapsed');
    }

    showWelcomeMessage() {
        let welcomeMsg;
        
        if (this.options.pageType === 'storage-classes') {
            // Storage classes page welcome message
            welcomeMsg = this.mockMode 
                ? "👋 Hello! I'm your NetApp ONTAP storage class assistant (running in demo mode). I can help you provision storage using your predefined storage classes: Hospital EDR, HR Records, and Medical Images.\n\nTry asking me: \"Provision 50GB of Hospital EDR storage for patient records\""
                : "👋 Hello! I'm your NetApp ONTAP storage class assistant. I can help you provision storage using your predefined storage classes: Hospital EDR, HR Records, and Medical Images.\n\nTry asking me: \"Provision 50GB of Hospital EDR storage for patient records\"";
        } else {
            // Default page welcome message
            welcomeMsg = this.mockMode 
                ? "👋 Hello! I'm your NetApp ONTAP provisioning assistant (running in demo mode). I can help you find the best storage locations across your ONTAP clusters based on available capacity and best practices.\n\nTry asking me: \"Provision a 100mb NFS volume for a database workload\""
                : "👋 Hello! I'm your NetApp ONTAP provisioning assistant. I can help you find the best storage locations across your ONTAP clusters based on available capacity and best practices.\n\nTry asking me: \"Provision a 100mb NFS volume for a database workload\"";
        }

        this.addMessage('assistant', welcomeMsg);
    }

    async sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();
        
        if (!message || this.isThinking) return;

        // Reset tool call statistics and conversation thread for new conversation
        this.toolCallFrequency = {};
        this.toolCallHistory = [];
        this.toolCallSignatures = new Map(); // Reset duplicate detection
        this.conversationThread = []; // Reset conversation thread for new message
        console.log('🔄 Reset tool call statistics and conversation thread for new message');

        // Add user message to both UI and conversation thread
        this.addMessage('user', message);
        this.addToConversationThread({ role: 'user', content: message });
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
            this.addToConversationThread({ role: 'assistant', content: response.text });

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
        // Enforce global rate limiting
        await this.enforceGlobalRateLimit();
        
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
            
            // Handle rate limit errors specifically
            if (response.status === 429) {
                throw new Error(`Rate limit exceeded. Please wait a moment and try again. The system made too many requests to ChatGPT in a short time.`);
            }
            
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
        this.addToConversationThread({ role: 'assistant', content: aiResponse });
        return this.parseResponseActions(aiResponse);
    }

    buildSystemPrompt() {
        const selectedCluster = this.demo.selectedCluster;
        const clusterInfo = selectedCluster ? 
            `The user has selected cluster "${selectedCluster.name}" (${selectedCluster.cluster_ip})` : 
            'No specific cluster is currently selected';

        // Use the loaded template and replace placeholders
        if (!this.systemPromptTemplate) {
            console.error('System prompt template not loaded, using fallback');
            return `You are a NetApp ONTAP provisioning assistant. Available clusters: ${clusterInfo}. Available tools: ${this.availableTools.length}`;
        }

        return this.systemPromptTemplate
            .replace('{{CLUSTER_INFO}}', clusterInfo)
            .replace('{{TOOLS_COUNT}}', this.availableTools.length);
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
        const MAX_RECURSION_DEPTH = 25; // Allow 25 rounds of tool calls for very complex operations with many dependencies
        
        // Add call frequency tracking and pattern detection
        this.toolCallFrequency = this.toolCallFrequency || {};
        this.toolCallHistory = this.toolCallHistory || [];
        
        // Track frequency and detect excessive calls
        const currentCallPattern = toolCalls.map(tc => tc.function.name).join(', ');
        console.log(`🔧 TOOL CALL PATTERN [Depth ${recursionDepth + 1}]: ${currentCallPattern}`);
        
        // Calculate total tool calls made so far
        const totalCallsSoFar = Object.values(this.toolCallFrequency || {}).reduce((sum, count) => sum + count, 0);
        const plannedCalls = totalCallsSoFar + toolCalls.length;
        console.log(`🧮 TOOL CALL BUDGET: ${plannedCalls}/8 calls planned (current: ${totalCallsSoFar})`);
        
        if (plannedCalls > 8) {
            console.warn(`⚠️ BUDGET EXCEEDED: ${plannedCalls}/8 calls - ChatGPT is being inefficient!`);
        }
        
        toolCalls.forEach(tc => {
            const key = tc.function.name;
            this.toolCallFrequency[key] = (this.toolCallFrequency[key] || 0) + 1;
            if (this.toolCallFrequency[key] > 8) {
                console.log(`🚨 FREQUENCY ALERT: ${key} called ${this.toolCallFrequency[key]} times - possible loop detected`);
            }
        });
        
        // Add pattern detection for repeating call sequences
        this.toolCallHistory.push(currentCallPattern);
        if (this.toolCallHistory.length > 3) {
            const recentPatterns = this.toolCallHistory.slice(-3);
            const hasRepeatingPattern = recentPatterns.every(pattern => pattern === recentPatterns[0]);
            if (hasRepeatingPattern) {
                console.log(`🚨 REPEATING PATTERN DETECTED: "${recentPatterns[0]}" - potential infinite loop`);
            }
        }
        
        if (recursionDepth >= MAX_RECURSION_DEPTH) {
            console.warn('Maximum tool call recursion depth reached. Stopping tool execution.');
            return {
                text: '⚠️ I\'ve completed the initial analysis but reached the maximum number of tool executions. Based on the information gathered, I can see the available clusters. Please ask me for a specific recommendation like "recommend the best aggregate on greg-vsim-2 for a 100GB volume".',
                actions: []
            };
        }

        console.log(`Handling tool calls (depth: ${recursionDepth + 1}/${MAX_RECURSION_DEPTH}):`, toolCalls.map(t => t.function.name));

        // Execute all MCP tool calls in parallel to reduce total execution time
        // but still maintain delays between ChatGPT API calls
        const toolPromises = toolCalls.map(async (toolCall, index) => {
            try {
                // Add staggered delays for MCP tool calls to prevent overwhelming the server
                if (index > 0 && toolCalls.length > 3) {
                    const delay = Math.min(index * 200, 1000); // Stagger by 200ms each, max 1s
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                const result = await this.executeMCPTool(toolCall);
                return {
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: toolCall.function.name,
                    content: result
                };
            } catch (error) {
                console.error(`Failed to execute tool ${toolCall.function.name}:`, error);
                return {
                    tool_call_id: toolCall.id,
                    role: 'tool',
                    name: toolCall.function.name,
                    content: `Error executing tool: ${error.message}`
                };
            }
        });

        // Wait for all tool calls to complete
        console.log('Executing all MCP tools in parallel...');
        const toolResults = await Promise.all(toolPromises);
        console.log('All MCP tools completed, sending results to ChatGPT...');

        // Store the assistant message with tool_calls followed by tool results in conversation thread
        this.addToConversationThread({
            role: 'assistant',
            content: null,
            tool_calls: toolCalls
        });
        
        toolResults.forEach(result => {
            this.addToConversationThread(result);
        });

        // Add a smart exponential backoff delay with 5s cap before making the ChatGPT API call to prevent rate limiting
        if (recursionDepth > 0) {
            // Smart backoff: starts at 2s, grows logarithmically, caps at 5s
            // Depth 1: 2s, Depth 2: 3s, Depth 3: 4s, Depth 4+: 5s
            const delayMs = Math.min(2000 + Math.floor(Math.log2(recursionDepth) * 1000), 5000);
            console.log(`Adding ${delayMs}ms smart backoff delay before ChatGPT API call (depth ${recursionDepth}) to prevent rate limiting...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Send results back to ChatGPT with retry logic for rate limiting
        return await this.getChatGPTResponseWithToolResultsWithRetry(originalMessage, toolCalls, toolResults, recursionDepth + 1);
    }

    async getChatGPTResponseWithToolResultsWithRetry(originalMessage, toolCalls, toolResults, recursionDepth = 0, retryCount = 0) {
        const maxRetries = 3; // Allow up to 3 retries for rate limit errors
        
        try {
            return await this.getChatGPTResponseWithToolResults(originalMessage, toolCalls, toolResults, recursionDepth);
        } catch (error) {
            // If it's a rate limit error and we haven't exceeded max retries, wait and retry
            if (error.message.includes('Rate limit exceeded') && retryCount < maxRetries) {
                // Smart retry delays: 3s, 5s, 7s (more reasonable than 10s, 20s, 30s)
                const retryDelay = 3000 + (retryCount * 2000);
                console.log(`Rate limit hit, waiting ${retryDelay}ms before retry ${retryCount + 1}/${maxRetries}...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return await this.getChatGPTResponseWithToolResultsWithRetry(originalMessage, toolCalls, toolResults, recursionDepth, retryCount + 1);
            }
            
            // If it's not a rate limit error or we've exceeded retries, rethrow
            throw error;
        }
    }

    async executeMCPTool(toolCall) {
        const { function: func } = toolCall;
        const { name, arguments: args } = func;

        try {
            const parsedArgs = JSON.parse(args);
            
            // Create unique signature for duplicate detection
            const toolSignature = `${name}:${JSON.stringify(parsedArgs, Object.keys(parsedArgs).sort())}`;
            
            // Track and detect duplicate calls
            if (this.toolCallSignatures.has(toolSignature)) {
                const count = this.toolCallSignatures.get(toolSignature) + 1;
                this.toolCallSignatures.set(toolSignature, count);
                console.log(`� DUPLICATE TOOL CALL [${count}x]: ${name} with args`, parsedArgs);
                console.log(`🔧 TOOL SIGNATURE: ${toolSignature}`);
            } else {
                this.toolCallSignatures.set(toolSignature, 1);
            }
            
            // �🔍 DIAGNOSTIC: Log parameters for problematic tools
            const problematicTools = ['cluster_list_aggregates', 'cluster_list_svms', 'list_snapshot_policies', 'cluster_list_qos_policies'];
            if (problematicTools.includes(name)) {
                console.log(`🔧 DIAGNOSTIC [${name}]:`, {
                    toolCall: toolCall,
                    parsedArgs: parsedArgs,
                    hasClusterName: !!parsedArgs.cluster_name,
                    clusterNameValue: parsedArgs.cluster_name,
                    signature: toolSignature,
                    callCount: this.toolCallSignatures.get(toolSignature)
                });
            }
            
            const response = await fetch(`${this.demo.mcpUrl}/api/tools/${name}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(parsedArgs)
            });

            if (!response.ok) {
                // 🔍 DIAGNOSTIC: Capture error details for problematic tools
                if (name === 'cluster_list_aggregates' || name === 'cluster_list_svms') {
                    try {
                        const errorData = await response.text();
                        console.log(`🚨 DIAGNOSTIC ERROR [${name}]:`, {
                            status: response.status,
                            statusText: response.statusText,
                            errorData: errorData,
                            sentParams: parsedArgs
                        });
                    } catch (logError) {
                        console.log(`🚨 DIAGNOSTIC ERROR [${name}]: Failed to read error response`, logError);
                    }
                }
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

    async enforceGlobalRateLimit() {
        const minTimeBetweenCalls = 3000; // Minimum 3 seconds between ChatGPT API calls (reduced from 4s)
        const now = Date.now();
        const timeSinceLastCall = now - this.lastChatGPTCallTime;
        
        if (timeSinceLastCall < minTimeBetweenCalls) {
            const waitTime = minTimeBetweenCalls - timeSinceLastCall;
            console.log(`Global rate limit: waiting ${waitTime}ms since last ChatGPT call...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastChatGPTCallTime = Date.now();
    }

    async getChatGPTResponseWithToolResults(originalMessage, toolCalls, toolResults, recursionDepth = 0) {
        // Enforce global rate limiting
        await this.enforceGlobalRateLimit();
        
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
                tool_choice: recursionDepth >= 20 ? 'none' : 'auto' // Allow tools until depth 20, then force completion
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Handle rate limit errors specifically
            if (response.status === 429) {
                throw new Error(`Rate limit exceeded. Please wait a moment and try again. The system made too many requests to ChatGPT in a short time.`);
            }
            
            throw new Error(`ChatGPT API error: ${response.status} ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        
        // Don't store assistant message with tool_calls here - it will be stored when handleToolCalls completes

        // Handle potential additional tool calls (multi-step workflows) only if not at max depth
        if (choice.message?.tool_calls && choice.message.tool_calls.length > 0 && recursionDepth < 25) {
            console.log(`Additional tool calls detected at depth ${recursionDepth}, continuing workflow...`);
            return await this.handleToolCalls(originalMessage, choice.message.tool_calls, recursionDepth);
        }

        // Log final tool call statistics
        if (this.toolCallFrequency && Object.keys(this.toolCallFrequency).length > 0) {
            console.log('📊 FINAL TOOL CALL STATISTICS:', this.toolCallFrequency);
            const totalCalls = Object.values(this.toolCallFrequency).reduce((sum, count) => sum + count, 0);
            const topCalls = Object.entries(this.toolCallFrequency)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([name, count]) => `${name}(${count})`)
                .join(', ');
            console.log(`📈 TOTAL: ${totalCalls} calls | TOP: ${topCalls}`);
        }

        const aiResponse = choice.message?.content;
        if (!aiResponse || aiResponse.trim() === '') {
            // If ChatGPT doesn't provide content, create a summary response
            const toolNames = toolCalls.map(tc => tc.function.name).join(', ');
            const summaryResponse = `I've executed the following tools: ${toolNames}. Please let me know if you need specific information from these results or try a more specific question.`;
            this.addToConversationThread({ role: 'assistant', content: summaryResponse });
            return this.parseResponseActions(summaryResponse);
        }

        console.log('Final ChatGPT response:', aiResponse);
        this.addToConversationThread({ role: 'assistant', content: aiResponse });
        return this.parseResponseActions(aiResponse);
    }

    buildConversationHistory() {
        return this.conversationThread
            .filter(msg => msg.role !== 'system')
            .slice(-20); // Keep more context since tool results can be large
    }

    addToConversationThread(message) {
        this.conversationThread.push(message);
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
            console.log('Found structured recommendation block:', recommendationBlock);
            
            // Extract structured fields - handle both with and without bullet point prefix
            const clusterMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*Cluster\*\*:\s*([^\n]+)/im);
            if (clusterMatch) recommendations.cluster = clusterMatch[1].trim();
            
            const svmMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*SVM\*\*:\s*([^\n]+)/im);
            if (svmMatch) recommendations.svm = svmMatch[1].trim();
            
            const aggregateMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*Aggregate\*\*:\s*([^\n]+)/im);
            if (aggregateMatch) recommendations.aggregate = aggregateMatch[1].trim();
            
            const sizeMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*Size\*\*:\s*([^\n]+)/im);
            if (sizeMatch) {
                const sizeText = sizeMatch[1].trim();
                const sizeParts = sizeText.match(/(\d+)\s*(MB|GB|TB)/i);
                if (sizeParts) {
                    recommendations.size = sizeParts[1];
                    recommendations.unit = sizeParts[2];
                }
            }
            
            const protocolMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*Protocol\*\*:\s*([^\n]+)/im);
            if (protocolMatch) recommendations.protocol = protocolMatch[1].trim().toLowerCase();
            
            // New storage class support
            const storageClassMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*Storage_Class\*\*:\s*([^\n]+)/im);
            if (storageClassMatch) recommendations.storageClass = storageClassMatch[1].trim();
            
            const qosMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*QoS_Policy\*\*:\s*([^\n]+)/im);
            if (qosMatch) recommendations.qosPolicy = qosMatch[1].trim();
            
            const snapshotMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*Snapshot_Policy\*\*:\s*([^\n]+)/im);
            if (snapshotMatch) recommendations.snapshotPolicy = snapshotMatch[1].trim();
            
            const exportMatch = recommendationBlock.match(/(?:^-?\s*)?\*\*Export_Policy\*\*:\s*([^\n]+)/im);
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
        
        // Handle storage classes page differently
        if (this.options.pageType === 'storage-classes' && this.options.useStorageClassProvisioning) {
            // Open storage class provisioning panel
            this.demo.openStorageClassProvisioning();
            
            try {
                // Wait for storage class provisioning panel to open
                console.log('Waiting for storage class provisioning panel...');
                await this.waitForElement('storageClassProvisioningPanel', 3000);
                await new Promise(resolve => setTimeout(resolve, 500));

                // Wait for storage classes to load in the dropdown
                console.log('Waiting for storage classes to load...');
                await this.waitForStorageClassesLoad();

                // 1. Handle storage class selection if specified in recommendations
                if (recommendations.storageClass) {
                    const storageClassSelect = document.getElementById('storageClassSelect');
                    if (storageClassSelect) {
                        console.log('🔍 DEBUG: Looking for storage class:', recommendations.storageClass);
                        console.log('🔍 DEBUG: Available options in dropdown:');
                        
                        for (let i = 0; i < storageClassSelect.options.length; i++) {
                            const option = storageClassSelect.options[i];
                            console.log(`  [${i}] value: "${option.value}" | text: "${option.text}"`);
                        }
                        
                        let found = false;
                        for (let option of storageClassSelect.options) {
                            // Skip empty options
                            if (!option.value || option.value.trim() === '') continue;
                            
                            const optionValue = option.value.toLowerCase().trim();
                            const recommendationValue = recommendations.storageClass.toLowerCase().trim();
                            
                            console.log(`🔍 DEBUG: Comparing "${optionValue}" vs "${recommendationValue}"`);
                            
                            if (optionValue === recommendationValue ||
                                optionValue.includes(recommendationValue) ||
                                recommendationValue.includes(optionValue)) {
                                storageClassSelect.value = option.value;
                                storageClassSelect.dispatchEvent(new Event('change'));
                                console.log('✅ Storage class selected:', option.value);
                                found = true;
                                break;
                            }
                        }
                        
                        if (!found) {
                            console.log('❌ Storage class not found in dropdown:', recommendations.storageClass);
                        } else {
                            // Store recommendation data on the storage class panel for later use
                            if (this.demo.storageClassProvisioningPanel) {
                                this.demo.storageClassProvisioningPanel.currentRecommendations = recommendations;
                            }
                        }
                    }
                }

                // 2. Generate and populate volume name
                const volumeNameInput = document.getElementById('scVolumeName');
                if (volumeNameInput) {
                    // Generate a volume name if not provided
                    const storageClass = recommendations.storageClass || 'storage';
                    const size = recommendations.size || '100';
                    const unit = (recommendations.unit || 'MB').toLowerCase();
                    const timestamp = new Date().toISOString().slice(5, 16).replace(/[-:T]/g, '');
                    const generatedName = `${storageClass.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${size}${unit}_${timestamp}`;
                    volumeNameInput.value = generatedName;
                    console.log('✅ Volume name generated:', generatedName);
                }

                // 3. Populate volume size
                if (recommendations.size && recommendations.unit) {
                    const volumeSizeInput = document.getElementById('scVolumeSize');
                    if (volumeSizeInput) {
                        const sizeValue = recommendations.size + recommendations.unit;
                        volumeSizeInput.value = sizeValue;
                        console.log('✅ Volume size populated:', sizeValue);
                    }
                }

                // 4. Handle protocol selection
                if (recommendations.protocol) {
                    const protocolValue = recommendations.protocol.toLowerCase();
                    const protocolInput = document.querySelector(`input[name="scProtocol"][value="${protocolValue}"]`);
                    if (protocolInput) {
                        protocolInput.checked = true;
                        protocolInput.dispatchEvent(new Event('change'));
                        console.log('✅ Protocol selected:', protocolValue);
                    }
                }

                // 5. Handle target details (cluster, SVM, aggregate) selection
                if (recommendations.cluster || recommendations.svm || recommendations.aggregate) {
                    await this.populateTargetDetailsInStorageClassForm(recommendations);
                }

                // 6. Handle export policy selection (after a delay to let export policies load)
                if (recommendations.exportPolicy && recommendations.protocol?.toLowerCase() === 'nfs') {
                    setTimeout(async () => {
                        await this.selectExportPolicyInStorageClassForm(recommendations.exportPolicy);
                    }, 2000);
                }

                // 7. Show success message
                const populatedFields = [];
                if (recommendations.storageClass) populatedFields.push('Storage Class');
                if (recommendations.size) populatedFields.push('Volume Size');
                if (recommendations.protocol) populatedFields.push('Protocol');
                if (recommendations.cluster) populatedFields.push('Target Details');
                
                if (populatedFields.length > 0) {
                    console.log('✅ Storage class form auto-populated:', populatedFields.join(', '));
                }
                
            } catch (error) {
                console.error('Error auto-populating storage class form:', error);
                this.addMessage('assistant', '❌ Error populating storage class provisioning form.');
            }
            return;
        }
        
        // Original working environment logic
        // Ensure correct cluster is selected
        if (recommendations.cluster && !this.options.skipWorkingEnvironment) {
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
        if (!this.options.skipWorkingEnvironment && !this.demo.selectedCluster) {
            this.addMessage('assistant', '⚠️ Cannot open provisioning form - no cluster is selected.');
            return;
        }
        
        // Open appropriate provisioning panel
        if (this.options.useStorageClassProvisioning) {
            this.demo.openStorageClassProvisioning();
        } else {
            this.demo.openProvisionStorage();
        }
        
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
                
                // Wait for snapshot policy dropdown after SVM change
                await this.waitForDropdownOptions('snapshotPolicy', 3000);
                
                // Wait for export policy dropdown after SVM change (NFS only)
                if (recommendations.protocol === 'nfs') {
                    await this.waitForDropdownOptions('exportPolicy', 3000);
                }
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
            
            // Wait for snapshot policy dropdown to be populated (if we have a snapshot policy to set)
            if (recommendations.snapshotPolicy) {
                console.log('Waiting for snapshot policy dropdown to be populated...');
                await this.waitForDropdownOptions('snapshotPolicy', 8000);
            }
            
            // Populate common form fields
            await this.populateCommonFormFields(recommendations);
            
        } catch (error) {
            console.error('Error auto-populating form:', error);
            this.addMessage('assistant', '⚠️ I couldn\'t fully populate the provisioning form. Please fill it in manually based on my recommendations.');
        }
    }

    async populateCommonFormFields(recommendations) {
        // Populate common fields like volume name, size, etc.
        let populated = false;
        
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

        // Handle protocol selection
        if (recommendations.protocol) {
            const protocolInput = document.querySelector(`input[name="protocol"][value="${recommendations.protocol}"]`);
            if (protocolInput) {
                protocolInput.checked = true;
                protocolInput.dispatchEvent(new Event('change'));
                console.log('Protocol selected:', recommendations.protocol);
                populated = true;
            }
        }

        // Populate SVM selection
        if (recommendations.svm) {
            const svmSelect = document.getElementById('svmSelect');
            if (svmSelect && svmSelect.options.length > 0) {
                for (let option of svmSelect.options) {
                    if (option.value.toLowerCase() === recommendations.svm.toLowerCase()) {
                        svmSelect.value = option.value;
                        svmSelect.dispatchEvent(new Event('change')); // Trigger aggregate loading
                        populated = true;
                        console.log('✅ SVM selected:', option.value);
                        
                        // Wait a moment for aggregates to load, then select aggregate
                        if (recommendations.aggregate) {
                            setTimeout(async () => {
                                await this.selectAggregate(recommendations.aggregate);
                            }, 1000);
                        }
                        break;
                    }
                }
            } else {
                console.log('❌ SVM select not found or not populated');
            }
        }

        // Populate aggregate selection (if SVM not in recommendations, try direct selection)
        if (recommendations.aggregate && !recommendations.svm) {
            setTimeout(async () => {
                await this.selectAggregate(recommendations.aggregate);
            }, 500);
        }

        // Populate snapshot policy
        if (recommendations.snapshotPolicy) {
            console.log('=== SNAPSHOT POLICY DEBUGGING ===');
            console.log('Attempting to populate snapshot policy:', recommendations.snapshotPolicy);
            console.log('Looking for element ID: snapshotPolicy');
            
            const snapshotSelect = document.getElementById('snapshotPolicy');
            console.log('Element found:', !!snapshotSelect);
            
            if (snapshotSelect) {
                console.log('Element type:', snapshotSelect.tagName);
                console.log('Element options count:', snapshotSelect.options.length);
                
                if (snapshotSelect.options.length > 0) {
                    console.log('Available options in dropdown:');
                    for (let i = 0; i < snapshotSelect.options.length; i++) {
                        const option = snapshotSelect.options[i];
                        console.log(`  [${i}] value: "${option.value}" | text: "${option.text}"`);
                    }
                    
                    console.log('Attempting to match:', `"${recommendations.snapshotPolicy}"`);
                    
                    let found = false;
                    for (let option of snapshotSelect.options) {
                        const optionValueLower = option.value.toLowerCase();
                        const recommendationLower = recommendations.snapshotPolicy.toLowerCase();
                        
                        console.log(`Comparing: "${optionValueLower}" === "${recommendationLower}"?`, optionValueLower === recommendationLower);
                        
                        if (optionValueLower === recommendationLower) {
                            console.log('MATCH FOUND! Setting value to:', option.value);
                            snapshotSelect.value = option.value;
                            
                            // Trigger change event
                            snapshotSelect.dispatchEvent(new Event('change'));
                            
                            populated = true;
                            found = true;
                            console.log('Snapshot policy successfully populated and change event dispatched');
                            break;
                        }
                    }
                    
                    if (!found) {
                        console.log('❌ NO MATCH FOUND for snapshot policy');
                        console.log('Available values:', Array.from(snapshotSelect.options).map(o => `"${o.value}"`));
                        console.log('Looking for:', `"${recommendations.snapshotPolicy}"`);
                    }
                } else {
                    console.log('❌ Snapshot policy dropdown has no options');
                }
            } else {
                console.log('❌ Snapshot policy element not found in DOM');
                console.log('Available elements with "snapshot" in ID:');
                const allElements = document.querySelectorAll('[id*="snapshot"], [id*="Snapshot"]');
                allElements.forEach(el => console.log(`  Found element: ${el.id}`));
            }
            console.log('=== END SNAPSHOT POLICY DEBUGGING ===');
        }

        // Populate export policy for NFS
        if (recommendations.exportPolicy) {
            const exportSelect = document.getElementById('exportPolicy');
            if (exportSelect && exportSelect.options.length > 0) {
                for (let option of exportSelect.options) {
                    if (option.value.toLowerCase() === recommendations.exportPolicy.toLowerCase()) {
                        exportSelect.value = option.value;
                        populated = true;
                        console.log('Export policy populated:', option.value);
                        break;
                    }
                }
            } else {
                console.log('Export policy select not found or not populated:', recommendations.exportPolicy);
            }
        }

        if (populated) {
            const message = this.options.pageType === 'storage-classes' 
                ? '✅ I\'ve automatically populated the storage class provisioning form with my recommendations. Please review the settings and click "Create Volume" when ready!'
                : '✅ I\'ve automatically populated the provisioning form with my recommendations. Please review the settings and click "Create Volume" when ready!';
            this.addMessage('assistant', message);
        } else {
            this.addMessage('assistant', '⚠️ I opened the provisioning form but couldn\'t auto-populate all fields. Please fill in the form manually based on my recommendations above.');
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

    // Helper method to select aggregate in dropdown
    async selectAggregate(aggregateName) {
        console.log('🔍 selectAggregate called with:', aggregateName);
        const aggregateSelect = document.getElementById('aggregateSelect');
        
        if (!aggregateSelect) {
            console.log('❌ Aggregate select element not found');
            return false;
        }
        
        console.log('🔍 Aggregate dropdown found, options count:', aggregateSelect.options.length);
        console.log('🔍 Available options:', Array.from(aggregateSelect.options).map(o => `"${o.value}"`));
        
        if (aggregateSelect.options.length > 0) {
            for (let option of aggregateSelect.options) {
                console.log(`🔍 Comparing "${aggregateName.toLowerCase()}" with option "${option.value.toLowerCase()}"`);
                
                // Skip empty options (like placeholder options)
                if (!option.value || option.value.trim() === '') {
                    console.log('⏭️ Skipping empty option');
                    continue;
                }
                
                // Match aggregate name (handle both with and without suffix)
                if (option.value.toLowerCase().includes(aggregateName.toLowerCase()) ||
                    aggregateName.toLowerCase().includes(option.value.toLowerCase())) {
                    console.log('🎯 Found matching aggregate, setting value to:', option.value);
                    aggregateSelect.value = option.value;
                    
                    // Trigger change event to ensure any listeners are notified
                    const changeEvent = new Event('change', { bubbles: true });
                    aggregateSelect.dispatchEvent(changeEvent);
                    
                    console.log('✅ Aggregate selected:', option.value);
                    console.log('✅ Dropdown value after selection:', aggregateSelect.value);
                    return true;
                }
            }
            console.log('❌ Aggregate not found in dropdown:', aggregateName);
            console.log('Available aggregates:', Array.from(aggregateSelect.options).map(o => o.value));
        } else {
            console.log('❌ Aggregate select not populated (no options)');
        }
        return false;
    }

    async selectExportPolicyInStorageClassForm(policyName) {
        const exportPolicySelect = document.getElementById('scExportPolicy');
        if (exportPolicySelect) {
            // Wait for options to be populated
            let attempts = 0;
            const maxAttempts = 20;
            
            while (attempts < maxAttempts) {
                const options = Array.from(exportPolicySelect.options);
                const matchingOption = options.find(opt => 
                    opt.value.toLowerCase().includes(policyName.toLowerCase()) ||
                    opt.textContent.toLowerCase().includes(policyName.toLowerCase())
                );
                
                if (matchingOption && matchingOption.value !== '') {
                    exportPolicySelect.value = matchingOption.value;
                    exportPolicySelect.dispatchEvent(new Event('change'));
                    console.log('✅ Export policy selected:', matchingOption.textContent);
                    return;
                }
                
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            console.log('🔧 Export policy not found after waiting:', policyName);
        }
    }

    // Helper method to wait for storage classes to load in dropdown
    async waitForStorageClassesLoad(timeout = 3000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const storageClassSelect = document.getElementById('storageClassSelect');
            if (storageClassSelect && storageClassSelect.options.length > 1) {
                // Check if we have real options (not just placeholder)
                let hasRealOptions = false;
                for (let option of storageClassSelect.options) {
                    if (option.value && option.value.trim() !== '') {
                        hasRealOptions = true;
                        break;
                    }
                }
                if (hasRealOptions) {
                    console.log('✅ Storage classes loaded in dropdown');
                    return true;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('❌ Timeout waiting for storage classes to load');
        return false;
    }

    async populateTargetDetailsInStorageClassForm(recommendations) {
        try {
            console.log('🔍 Populating target details in storage class form:', recommendations);

            // 1. Update target cluster display
            if (recommendations.cluster) {
                const clusterSpan = document.getElementById('selectedCluster');
                if (clusterSpan) {
                    clusterSpan.textContent = recommendations.cluster;
                    console.log('✅ Storage class cluster displayed:', recommendations.cluster);
                }
            }

            // 2. Update target SVM display
            if (recommendations.svm) {
                const svmSpan = document.getElementById('selectedSvm');
                if (svmSpan) {
                    svmSpan.textContent = recommendations.svm;
                    console.log('✅ Storage class SVM displayed:', recommendations.svm);
                }
            }

            // 3. Update target aggregate display
            if (recommendations.aggregate) {
                const aggregateSpan = document.getElementById('selectedAggregate');
                if (aggregateSpan) {
                    aggregateSpan.textContent = recommendations.aggregate;
                    console.log('✅ Storage class aggregate displayed:', recommendations.aggregate);
                }
            }

            // 4. Load export policies now that target details are populated (for NFS)
            if (recommendations.cluster && recommendations.svm && recommendations.protocol === 'nfs') {
                console.log('🔄 Loading export policies after target details populated');
                // Get the storage class provisioning panel instance and load export policies
                const storagePanel = this.demo.storageClassProvisioningPanel;
                if (storagePanel && typeof storagePanel.loadExportPolicies === 'function') {
                    setTimeout(() => storagePanel.loadExportPolicies(), 100); // Small delay to ensure DOM is updated
                }
            }

        } catch (error) {
            console.error('Error populating target details in storage class form:', error);
        }
    }
}

// Export for global access
window.ChatbotAssistant = ChatbotAssistant;