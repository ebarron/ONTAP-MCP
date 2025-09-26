#!/usr/bin/env node

/**
 * Test script to verify the new intent detection logic for the chatbot
 */

// Mock the chatbot assistant's intent detection methods
class TestChatbotAssistant {
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

    parseStructuredRecommendation(content) {
        const recommendations = {};
        
        // Extract structured fields
        const patterns = {
            cluster: /-\s*\*\*Cluster\*\*[:\s]*([^\n\r]+)/i,
            svm: /-\s*\*\*SVM\*\*[:\s]*([^\n\r]+)/i,
            aggregate: /-\s*\*\*Aggregate\*\*[:\s]*([^\n\r]+)/i,
            size: /-\s*\*\*Size\*\*[:\s]*(\d+(?:\.\d+)?)\s*(MB|GB|TB)/i,
            protocol: /-\s*\*\*Protocol\*\*[:\s]*([^\n\r]+)/i,
            snapshot_policy: /-\s*\*\*Snapshot_Policy\*\*[:\s]*([^\n\r]+)/i,
            export_policy: /-\s*\*\*Export_Policy\*\*[:\s]*([^\n\r]+)/i
        };

        // Extract each field
        for (const [field, pattern] of Object.entries(patterns)) {
            const match = content.match(pattern);
            if (match) {
                if (field === 'size') {
                    recommendations.size = match[1];
                    recommendations.unit = match[2] || 'GB';
                } else {
                    // Clean up the value by removing backticks and trimming
                    recommendations[field] = match[1].replace(/[`'"]/g, '').trim();
                }
            }
        }

        return Object.keys(recommendations).length > 0 ? recommendations : null;
    }

    extractProvisioningRecommendations(response) {
        // First, check for structured recommendation format (preferred)
        const structuredMatch = response.match(/## PROVISIONING_RECOMMENDATION(.*?)## END_PROVISIONING_RECOMMENDATION/is);
        
        if (structuredMatch) {
            return this.parseStructuredRecommendation(structuredMatch[1]);
        }

        // For testing, we'll skip the legacy parsing
        return null;
    }
}

// Test cases
const testCases = [
    {
        name: "Structured Provisioning Response",
        response: `Here's my analysis of your storage needs:

## PROVISIONING_RECOMMENDATION
- **Cluster**: greg-vsim-1
- **SVM**: vs0
- **Aggregate**: sti245_vsim_ocvs026b_aggr1
- **Size**: 100MB
- **Protocol**: NFS
- **Export_Policy**: vs0_nfs_policy
## END_PROVISIONING_RECOMMENDATION

Would you like me to apply these settings to the provisioning form?`,
        expectedIntent: true,
        expectedRecommendations: {
            cluster: "greg-vsim-1",
            svm: "vs0",
            aggregate: "sti245_vsim_ocvs026b_aggr1",
            size: "100",
            unit: "MB",
            protocol: "NFS",
            export_policy: "vs0_nfs_policy"
        }
    },
    {
        name: "Legacy Provisioning Response",
        response: `Here's a detailed analysis of the available clusters and recommendations for provisioning a 100MB NFS volume for your database workload:

## Recommendation:
Given the current capacities, the best option for provisioning a 100MB NFS volume is on Cluster greg-vsim-1.

- Cluster: greg-vsim-1
- SVM: vs0
- Aggregate: sti245_vsim_ocvs026b_aggr1
- Size: 100MB
- Protocol: NFS

### Next Steps:
Would you like me to proceed with creating the volume using these details, or would you like more information?`,
        expectedIntent: true,
        expectedRecommendations: null // Legacy parsing not implemented in test
    },
    {
        name: "Error Response - Should NOT Trigger",
        response: `It seems that there is an issue in accessing the details for the cluster "julia-vsim-1". The system is unable to resolve the cluster's address.

Would you like me to assist you in resolving this issue, or is there anything else you would like to explore?`,
        expectedIntent: false,
        expectedRecommendations: null
    },
    {
        name: "Informational Response - Should NOT Trigger",
        response: `Here are the current details for cluster greg-vsim-2:

- Status: Online
- Version: ONTAP 9.8
- Total capacity: 500GB
- Available capacity: 127.9GB

The cluster is healthy and operating normally. Is there anything specific you'd like to know about this cluster?`,
        expectedIntent: false,
        expectedRecommendations: null
    },
    {
        name: "User's Actual Response Format (Should NOT Trigger)",
        response: `Here's my recommendation for provisioning a 100MB NFS volume for your database workload:

### Cluster: greg-vsim-2
- SVM: svm1
- Aggregate: storage_availability_zone_0
- Size: 100MB
- Protocol: NFS

The greg-vsim-2 cluster has plenty of available space on the storage_availability_zone_0 aggregate, and the svm1 SVM is running and ready for use. Please confirm if you would like me to proceed with the volume creation, or if you have any additional requirements!`,
        expectedIntent: false, // This should NOT trigger until LLM uses proper format
        expectedRecommendations: null
    },
    {
        name: "CIFS Provisioning with All Fields",
        response: `## PROVISIONING_RECOMMENDATION
- **Cluster**: greg-vsim-2
- **SVM**: svm1
- **Aggregate**: storage_availability_zone_0
- **Size**: 500GB
- **Protocol**: CIFS
- **Snapshot_Policy**: daily_snapshots
## END_PROVISIONING_RECOMMENDATION`,
        expectedIntent: true,
        expectedRecommendations: {
            cluster: "greg-vsim-2",
            svm: "svm1", 
            aggregate: "storage_availability_zone_0",
            size: "500",
            unit: "GB",
            protocol: "CIFS",
            snapshot_policy: "daily_snapshots"
        }
    }
];

// Run tests
console.log("🧪 Testing Intent Detection and Structured Parsing\n");

const chatbot = new TestChatbotAssistant();
let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log("─".repeat(50));
    
    // Test intent detection
    const actualIntent = chatbot.isProvisioningIntent(testCase.response);
    const intentCorrect = actualIntent === testCase.expectedIntent;
    
    console.log(`Intent Detection: ${intentCorrect ? '✅' : '❌'} Expected: ${testCase.expectedIntent}, Got: ${actualIntent}`);
    
    // Test recommendation extraction (only for structured responses)
    let recommendationCorrect = true;
    if (testCase.expectedRecommendations) {
        const actualRecommendations = chatbot.extractProvisioningRecommendations(testCase.response);
        
        if (!actualRecommendations) {
            recommendationCorrect = false;
            console.log(`Recommendation Extraction: ❌ Expected recommendations, got null`);
        } else {
            // Check each expected field
            for (const [key, expectedValue] of Object.entries(testCase.expectedRecommendations)) {
                if (actualRecommendations[key] !== expectedValue) {
                    recommendationCorrect = false;
                    console.log(`Recommendation Extraction: ❌ Field '${key}' - Expected: '${expectedValue}', Got: '${actualRecommendations[key]}'`);
                }
            }
            if (recommendationCorrect) {
                console.log(`Recommendation Extraction: ✅ All fields parsed correctly`);
                console.log(`  Parsed:`, actualRecommendations);
            }
        }
    } else {
        console.log(`Recommendation Extraction: N/A (not expected for this test)`);
    }
    
    if (intentCorrect && recommendationCorrect) {
        passed++;
        console.log(`Result: ✅ PASSED\n`);
    } else {
        failed++;
        console.log(`Result: ❌ FAILED\n`);
    }
});

console.log("🎯 Test Summary");
console.log("═".repeat(30));
console.log(`Total Tests: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Success Rate: ${Math.round(passed / testCases.length * 100)}%`);

if (failed === 0) {
    console.log("\n🎉 All tests passed! The intent detection logic is working correctly.");
    process.exit(0);
} else {
    console.log("\n⚠️ Some tests failed. Please review the implementation.");
    process.exit(1);
}