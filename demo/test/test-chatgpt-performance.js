#!/usr/bin/env node

// Test ChatGPT API performance with different payload sizes
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load ChatGPT config
const configPath = path.join(__dirname, '..', 'chatgpt-config.json');
let config;
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
    console.error('❌ Could not load chatgpt-config.json:', error.message);
    console.log('Create demo/chatgpt-config.json with your API key:');
    console.log('{"apiKey": "your-api-key-here", "model": "gpt-4"}');
    process.exit(1);
}

async function testChatGPTCall(testName, messages) {
    console.log(`\n🧪 Testing: ${testName}`);
    console.log(`📏 Payload size: ~${JSON.stringify(messages).length} characters`);
    
    const startTime = Date.now();
    
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model || 'gpt-4',
                messages: messages,
                max_tokens: 500,
                temperature: 0.1
            })
        });

        const responseTime = Date.now() - startTime;
        
        if (!response.ok) {
            const errorData = await response.text();
            console.log(`❌ API Error (${response.status}): ${errorData}`);
            return { success: false, responseTime, error: errorData };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || 'No content';
        
        console.log(`✅ Response time: ${responseTime}ms`);
        console.log(`📝 Response: ${content.substring(0, 100)}...`);
        
        return { success: true, responseTime, content };
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.log(`❌ Network Error: ${error.message}`);
        return { success: false, responseTime, error: error.message };
    }
}

async function runTests() {
    console.log('🚀 ChatGPT API Performance Test');
    console.log('================================\n');

    // Test 1: Small simple request
    const smallRequest = [
        { role: 'user', content: 'Hello, how are you?' }
    ];

    // Test 2: Medium request with system prompt
    const mediumRequest = [
        { 
            role: 'system', 
            content: 'You are a helpful assistant that provides storage recommendations for NetApp ONTAP systems. Be concise and technical.'
        },
        { 
            role: 'user', 
            content: 'I need to provision a 100MB NFS volume for a database. What do you recommend?' 
        }
    ];

    // Test 3: Large request simulating our chatbot after tool calls
    const toolResults = JSON.stringify({
        clusters: ['cluster1', 'cluster2', 'cluster3', 'cluster4'],
        svms: ['svm1', 'svm2', 'svm3'],
        aggregates: ['aggr1_data', 'aggr2_data', 'aggr3_data'],
        policies: ['default', 'policy1', 'policy2', 'policy3', 'policy4']
    });

    const largeRequest = [
        { 
            role: 'system', 
            content: fs.readFileSync(path.join(__dirname, '..', 'CHATBOT_SYSTEM_PROMPT.md'), 'utf8')
        },
        { 
            role: 'user', 
            content: 'I need to provision a 100MB NFS volume for a database.' 
        },
        {
            role: 'assistant',
            content: 'I need to check your available clusters first.',
            tool_calls: [
                {
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'list_registered_clusters', arguments: '{}' }
                }
            ]
        },
        {
            role: 'tool',
            tool_call_id: 'call_1',
            content: `Available clusters: ${toolResults}`
        },
        {
            role: 'assistant',
            content: 'Now let me check snapshot policies.',
            tool_calls: [
                {
                    id: 'call_2',
                    type: 'function',
                    function: { name: 'list_snapshot_policies', arguments: '{"cluster_name":"cluster1"}' }
                }
            ]
        },
        {
            role: 'tool',
            tool_call_id: 'call_2',
            content: `Snapshot policies: ${toolResults}`
        }
    ];

    // Run tests
    const results = {};
    
    results.small = await testChatGPTCall('Small Request (Hello)', smallRequest);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between tests
    
    results.medium = await testChatGPTCall('Medium Request (System + User)', mediumRequest);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    results.large = await testChatGPTCall('Large Request (Full Conversation + Tools)', largeRequest);

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('===========');
    console.log(`Small request:  ${results.small.responseTime}ms`);
    console.log(`Medium request: ${results.medium.responseTime}ms`);
    console.log(`Large request:  ${results.large.responseTime}ms`);
    
    if (results.large.responseTime > results.small.responseTime * 2) {
        console.log('⚠️  Large payload is significantly slower - payload size is likely the issue');
    } else {
        console.log('ℹ️  Response times are similar - payload size may not be the primary factor');
    }
}

// Run the tests
runTests().catch(console.error);