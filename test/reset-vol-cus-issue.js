#!/usr/bin/env node

/**
 * Reset vol_cus_issue volume on umeng-aff300-01-02 cluster
 * Disables autosize to prepare for testing
 */

import http from 'http';

const MCP_SERVER = 'http://localhost:3000';
let sessionId = null;

/**
 * Initialize MCP session via Streamable HTTP transport
 */
async function initSession() {
    return new Promise((resolve, reject) => {
        const req = http.get(`${MCP_SERVER}/mcp`, (res) => {
            let buffer = '';
            
            res.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    if (line.startsWith('event: endpoint')) {
                        const nextLine = lines[lines.indexOf(line) + 1];
                        if (nextLine && nextLine.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(nextLine.substring(6));
                                sessionId = data.sessionId;
                                console.log(`✅ MCP session initialized: ${sessionId}`);
                                req.destroy(); // Close SSE connection
                                resolve();
                            } catch (error) {
                                reject(new Error(`Failed to parse endpoint data: ${error.message}`));
                            }
                        }
                    }
                }
            });
            
            res.on('error', reject);
            setTimeout(() => reject(new Error('Timeout waiting for session ID')), 5000);
        });
        
        req.on('error', reject);
    });
}

/**
 * Call MCP tool via Streamable HTTP transport
 */
async function callMcp(toolName, params) {
    if (!sessionId) {
        throw new Error('MCP session not initialized');
    }
    
    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substring(7);
        
        const jsonRpcRequest = {
            jsonrpc: '2.0',
            id: requestId,
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: params
            }
        };
        
        const postData = JSON.stringify(jsonRpcRequest);
        
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Mcp-Session-Id': sessionId
            }
        };
        
        const req = http.request(`${MCP_SERVER}/messages`, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.error) {
                        reject(new Error(response.error.message || 'MCP tool call failed'));
                    } else {
                        resolve(response.result);
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Main execution
 */
async function main() {
    try {
        console.log('🔧 Resetting vol_cus_issue on umeng-aff300-01-02...\n');
        
        // Initialize session
        await initSession();
        
        // Disable autosize
        console.log('📋 Disabling autosize on vol_cus_issue...');
        const result = await callMcp('cluster_enable_volume_autosize', {
            cluster_name: 'umeng-aff300-01-02',
            volume_uuid: '4f94b612-b3b2-11ef-8417-00a098d39e12',
            mode: 'off'
        });
        
        console.log('✅ Volume reset successfully!');
        console.log('   Cluster: umeng-aff300-01-02');
        console.log('   SVM: vs_test');
        console.log('   Volume: vol_cus_issue');
        console.log('   UUID: 4f94b612-b3b2-11ef-8417-00a098d39e12');
        console.log('   Autosize: DISABLED\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
