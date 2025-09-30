#!/usr/bin/env node

// Simple ChatGPT API test using curl to avoid auth issues
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

async function testChatGPTPerformance() {
    console.log('🚀 ChatGPT API Performance Test (via curl)');
    console.log('============================================\n');

    // Load API key from demo config
    let apiKey;
    try {
        const configPath = path.join(__dirname, '..', 'chatgpt-config.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        apiKey = config.api_key || config.apiKey;
        
        if (!apiKey || apiKey === 'your-api-key-here' || apiKey.includes('your-api-key')) {
            console.log('❌ No valid API key found in demo/chatgpt-config.json');
            console.log('Please add your OpenAI API key to test ChatGPT performance');
            return;
        }
    } catch (error) {
        console.log('❌ Could not load ChatGPT config:', error.message);
        return;
    }

    // Test 1: Small request
    console.log('🧪 Test 1: Small Request');
    const smallPayload = JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello, respond with just 'Hi'" }],
        max_tokens: 10
    });
    
    await testRequest('Small', smallPayload, apiKey);
    
    // Test 2: Large request with system prompt
    console.log('\n🧪 Test 2: Large Request (with system prompt)');
    const systemPrompt = fs.readFileSync(path.join(__dirname, '..', 'CHATBOT_SYSTEM_PROMPT.md'), 'utf8');
    const largePayload = JSON.stringify({
        model: "gpt-4",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "I need a 100MB volume for database storage" },
            { role: "assistant", content: "I'll help you provision that volume. Let me check your available clusters first." },
            { role: "user", content: "Here are my clusters: cluster1 (100TB free), cluster2 (50TB free), cluster3 (200TB free). All have default snapshot policies available." }
        ],
        max_tokens: 200
    });
    
    await testRequest('Large', largePayload, apiKey);
}

async function testRequest(testName, payload, apiKey) {
    console.log(`📏 ${testName} payload size: ${payload.length} characters`);
    
    const startTime = Date.now();
    
    try {
        const curlCommand = `curl -s -w "HTTPSTATUS:%{http_code}" -X POST https://api.openai.com/v1/chat/completions \\
            -H "Content-Type: application/json" \\
            -H "Authorization: Bearer ${apiKey}" \\
            -d '${payload.replace(/'/g, "'\"'\"'")}'`;
        
        const { stdout, stderr } = await execAsync(curlCommand);
        const responseTime = Date.now() - startTime;
        
        if (stderr) {
            console.log(`❌ Error: ${stderr}`);
            return;
        }
        
        // Parse curl response (body + HTTP status)
        const parts = stdout.split('HTTPSTATUS:');
        const responseBody = parts[0];
        const httpStatus = parts[1];
        
        console.log(`✅ Response time: ${responseTime}ms (HTTP ${httpStatus})`);
        
        try {
            const jsonResponse = JSON.parse(responseBody);
            if (jsonResponse.choices) {
                const content = jsonResponse.choices[0]?.message?.content || 'No content';
                console.log(`📝 Response: ${content.substring(0, 50)}...`);
                console.log(`🔧 Usage: ${JSON.stringify(jsonResponse.usage)}`);
            } else if (jsonResponse.error) {
                console.log(`❌ API Error: ${jsonResponse.error.message}`);
            }
        } catch (parseError) {
            console.log(`❌ Could not parse response: ${responseBody.substring(0, 100)}...`);
        }
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.log(`❌ Request failed after ${responseTime}ms: ${error.message}`);
    }
}

// Run the test
testChatGPTPerformance().catch(console.error);