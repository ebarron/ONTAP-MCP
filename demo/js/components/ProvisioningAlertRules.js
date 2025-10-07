// Centralized Provisioning Alert Rules Module
// Shared logic for creating monitoring alerts across provisioning workflows

class ProvisioningAlertRules {
    constructor(demo) {
        this.demo = demo;
        this.apiClient = demo.apiClient;
    }

    // Generate capacity monitoring alert rules
    generateCapacityAlertRules(volumeName, svmName, clusterName) {
        const alerts = [];
        
        // Alert 1: Volume capacity breach (>90% used)
        alerts.push({
            alert: `${clusterName}_${svmName}_${volumeName}_capacity_breach`,
            expr: `volume_size_used_percent{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} > 90`,
            for: '5m',
            labels: {
                severity: 'warning',
                cluster: clusterName,
                svm: svmName,
                volume: volumeName,
                alert_type: 'capacity'
            },
            annotations: {
                summary: `Volume ${volumeName} capacity usage exceeds 90%`,
                description: `Volume ${volumeName} on SVM ${svmName} in cluster ${clusterName} is using more than 90% of its allocated capacity. Current usage: {{ $value }}%. Consider expanding the volume or freeing up space.`,
                runbook_url: 'https://docs.netapp.com/ontap-9/topic/com.netapp.doc.dot-cm-vsmg/GUID-4D6C6F06-5E1D-4D9F-8C1E-1D6F6E6F6F6F.html'
            }
        });

        // Alert 2: Volume offline
        alerts.push({
            alert: `${clusterName}_${svmName}_${volumeName}_offline`,
            expr: `volume_new_status{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} == 0`,
            for: '1m',
            labels: {
                severity: 'critical',
                cluster: clusterName,
                svm: svmName,
                volume: volumeName,
                alert_type: 'availability'
            },
            annotations: {
                summary: `Volume ${volumeName} is offline`,
                description: `Volume ${volumeName} on SVM ${svmName} in cluster ${clusterName} has gone offline (status=0). This volume is currently inaccessible to clients. Immediate action required.`,
                runbook_url: 'https://docs.netapp.com/ontap-9/topic/com.netapp.doc.dot-cm-vsmg/GUID-volume-offline.html'
            }
        });

        return alerts;
    }

    // Generate performance monitoring alert rules
    async generatePerformanceAlertRules(volumeName, svmName, clusterName, qosPolicyName) {
        const alerts = [];

        // Fetch QoS policy details to get max throughput
        const qosDetails = await this.getQosPolicyDetails(qosPolicyName, svmName, clusterName);
        
        if (!qosDetails || !qosDetails.maxThroughput) {
            console.warn('Could not fetch QoS policy max throughput for performance alert');
            return alerts;
        }

        // Calculate 95% of max throughput for alert threshold
        const alertThreshold = qosDetails.maxThroughput * 0.95;
        const unit = qosDetails.unit || 'iops';

        // Alert: QoS limit approaching (>95% max throughput + high latency)
        alerts.push({
            alert: `${clusterName}_${svmName}_${volumeName}_qos_limit_reached`,
            expr: `(volume_read_ops{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} + volume_write_ops{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"}) > ${alertThreshold} and volume_avg_latency{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} > 10`,
            for: '5m',
            labels: {
                severity: 'warning',
                cluster: clusterName,
                svm: svmName,
                volume: volumeName,
                alert_type: 'performance',
                qos_policy: qosPolicyName
            },
            annotations: {
                summary: `Volume ${volumeName} approaching QoS policy limit`,
                description: `Volume ${volumeName} on SVM ${svmName} in cluster ${clusterName} is experiencing rate limiting. Current IOPS: {{ $value }}${unit}, QoS max: ${qosDetails.maxThroughput}${unit}, Threshold: ${alertThreshold}${unit}. Latency is also elevated (>10ms). Consider increasing QoS limits or reducing workload.`,
                runbook_url: 'https://docs.netapp.com/ontap-9/topic/com.netapp.doc.pow-perf-mon/GUID-qos-limits.html'
            }
        });

        return alerts;
    }

    // Generate data protection monitoring alert rules
    async generateDataProtectionAlertRules(volumeName, svmName, clusterName, snapshotPolicyName) {
        const alerts = [];

        // Fetch snapshot policy details to determine minimum retention period
        const policyDetails = await this.getSnapshotPolicyDetails(snapshotPolicyName, svmName, clusterName);
        
        // Alert 1: Snapshot reserve space low (>90% used)
        alerts.push({
            alert: `${clusterName}_${svmName}_${volumeName}_snapshot_space_low`,
            expr: `volume_snapshot_reserve_percent{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"} > 90`,
            for: '10m',
            labels: {
                severity: 'warning',
                cluster: clusterName,
                svm: svmName,
                volume: volumeName,
                alert_type: 'data_protection'
            },
            annotations: {
                summary: `Volume ${volumeName} snapshot reserve space is low`,
                description: `Volume ${volumeName} on SVM ${svmName} in cluster ${clusterName} has used more than 90% of its snapshot reserve space. Current usage: {{ $value }}%. New snapshots may fail. Consider increasing snapshot reserve or deleting old snapshots.`,
                runbook_url: 'https://docs.netapp.com/ontap-9/topic/com.netapp.doc.dot-cm-vsmg/GUID-snapshot-reserve.html'
            }
        });

        // Alert 2: Snapshot creation failures (EMS event)
        alerts.push({
            alert: `${clusterName}_${svmName}_${volumeName}_snapshot_create_fail`,
            expr: `increase(ems_events{cluster="${clusterName}",event="wafl.snap.create.fail",volume="${volumeName}"}[5m]) > 0`,
            for: '1m',
            labels: {
                severity: 'critical',
                cluster: clusterName,
                svm: svmName,
                volume: volumeName,
                alert_type: 'data_protection'
            },
            annotations: {
                summary: `Snapshot creation failed for volume ${volumeName}`,
                description: `Snapshot creation has failed for volume ${volumeName} on SVM ${svmName} in cluster ${clusterName}. This may indicate insufficient space, I/O errors, or configuration issues. Check EMS logs for details.`,
                runbook_url: 'https://docs.netapp.com/ontap-9/topic/com.netapp.doc.dot-cm-vsmg/GUID-snapshot-troubleshooting.html'
            }
        });

        // Alert 3: Snapshot deletion failures (EMS event)
        alerts.push({
            alert: `${clusterName}_${svmName}_${volumeName}_snapshot_delete_fail`,
            expr: `increase(ems_events{cluster="${clusterName}",event="wafl.snap.delete.fail",volume="${volumeName}"}[5m]) > 0`,
            for: '1m',
            labels: {
                severity: 'warning',
                cluster: clusterName,
                svm: svmName,
                volume: volumeName,
                alert_type: 'data_protection'
            },
            annotations: {
                summary: `Snapshot deletion failed for volume ${volumeName}`,
                description: `Snapshot deletion has failed for volume ${volumeName} on SVM ${svmName} in cluster ${clusterName}. This may indicate locked snapshots, busy volumes, or system errors. Snapshot space may continue to grow.`,
                runbook_url: 'https://docs.netapp.com/ontap-9/topic/com.netapp.doc.dot-cm-vsmg/GUID-snapshot-troubleshooting.html'
            }
        });

        // Alert 4: Snapshot creation skipped (EMS event)
        alerts.push({
            alert: `${clusterName}_${svmName}_${volumeName}_snapshot_create_skip`,
            expr: `increase(ems_events{cluster="${clusterName}",event="wafl.snap.create.skip",volume="${volumeName}"}[5m]) > 0`,
            for: '5m',
            labels: {
                severity: 'warning',
                cluster: clusterName,
                svm: svmName,
                volume: volumeName,
                alert_type: 'data_protection'
            },
            annotations: {
                summary: `Scheduled snapshot skipped for volume ${volumeName}`,
                description: `Scheduled snapshot creation was skipped for volume ${volumeName} on SVM ${svmName} in cluster ${clusterName}. This may indicate the volume was busy or a previous snapshot is still in progress.`,
                runbook_url: 'https://docs.netapp.com/ontap-9/topic/com.netapp.doc.dot-cm-vsmg/GUID-snapshot-troubleshooting.html'
            }
        });

        // Alert 5: Stale snapshots (age exceeds retention policy)
        if (policyDetails && policyDetails.minRetentionHours) {
            const retentionSeconds = policyDetails.minRetentionHours * 3600;
            alerts.push({
                alert: `${clusterName}_${svmName}_${volumeName}_snapshot_stale`,
                expr: `(time() - volume_snapshot_created_time{cluster="${clusterName}",svm="${svmName}",volume="${volumeName}"}) > ${retentionSeconds}`,
                for: '1h',
                labels: {
                    severity: 'info',
                    cluster: clusterName,
                    svm: svmName,
                    volume: volumeName,
                    alert_type: 'data_protection',
                    snapshot_policy: snapshotPolicyName
                },
                annotations: {
                    summary: `Stale snapshots detected for volume ${volumeName}`,
                    description: `Volume ${volumeName} on SVM ${svmName} in cluster ${clusterName} has snapshots older than the minimum retention period (${policyDetails.minRetentionHours}h) defined in policy ${snapshotPolicyName}. Consider reviewing snapshot retention settings.`,
                    runbook_url: 'https://docs.netapp.com/ontap-9/topic/com.netapp.doc.dot-cm-vsmg/GUID-snapshot-policies.html'
                }
            });
        }

        return alerts;
    }

    // Fetch QoS policy details including max throughput
    async getQosPolicyDetails(policyName, svmName, clusterName) {
        try {
            // Try fetching policy - first without SVM (for admin/cluster policies), then with SVM
            let response;
            
            // Try without SVM first (cluster-level/admin policies)
            response = await this.apiClient.callMcp('cluster_get_qos_policy', {
                cluster_name: clusterName,
                policy_name: policyName
                // Omit svm_name for cluster-level policies
            });

            // If not found or error, try with SVM specified
            if (!response || response.includes('not found') || response.includes('❌')) {
                console.log('Policy not found at cluster level, trying SVM-specific...');
                response = await this.apiClient.callMcp('cluster_get_qos_policy', {
                    cluster_name: clusterName,
                    policy_name: policyName,
                    svm_name: svmName
                });
            }

            if (!response || typeof response !== 'string') {
                console.warn('QoS policy response is null or not a string:', response);
                return null;
            }

            console.log('QoS Policy Response:', response);

            // Parse the response to extract max throughput
            // Try multiple patterns to match different response formats
            
            // Pattern 1: "Max Throughput: 5000 IOPS"
            let maxThroughputMatch = response.match(/Max[imum]*\s+Throughput:\s*(\d+(?:\.\d+)?)\s*(IOPS|iops|MB\/s|mb\/s|GB\/s|gb\/s)/i);
            
            // Pattern 2: "max_throughput: 5000iops" (JSON-like format)
            if (!maxThroughputMatch) {
                maxThroughputMatch = response.match(/max[_-]?throughput["\s:]*(\d+(?:\.\d+)?)\s*(iops|mb\/s|gb\/s)/i);
            }
            
            // Pattern 3: Look for any number followed by IOPS or MB/s
            if (!maxThroughputMatch) {
                maxThroughputMatch = response.match(/(\d+(?:\.\d+)?)\s*(IOPS|iops|MB\/s|mb\/s|GB\/s|gb\/s)/i);
            }
            
            if (maxThroughputMatch) {
                const value = parseFloat(maxThroughputMatch[1]);
                const unit = maxThroughputMatch[2].toLowerCase();
                
                console.log(`Parsed QoS max throughput: ${value} ${unit}`);
                
                return {
                    maxThroughput: value,
                    unit
                };
            }

            console.warn('Could not parse max throughput from QoS policy response:', response);
            return null;
        } catch (error) {
            console.error('Error fetching QoS policy details:', error);
            return null;
        }
    }

    // Fetch snapshot policy details to determine minimum retention period
    async getSnapshotPolicyDetails(policyName, svmName, clusterName) {
        try {
            // Try fetching policy - first without SVM (for cluster-level policies), then with SVM
            let response;
            
            // Try without SVM first (cluster-level policies)
            response = await this.apiClient.callMcp('get_snapshot_policy', {
                cluster_name: clusterName,
                policy_name: policyName
                // Omit svm_name for cluster-level policies
            });

            // If not found or error, try with SVM specified
            if (!response || response.includes('not found') || response.includes('❌')) {
                console.log('Policy not found at cluster level, trying SVM-specific...');
                response = await this.apiClient.callMcp('get_snapshot_policy', {
                    cluster_name: clusterName,
                    policy_name: policyName,
                    svm_name: svmName
                });
            }

            if (!response || typeof response !== 'string') {
                console.warn('Snapshot policy response is null or not a string:', response);
                return null;
            }

            console.log('Snapshot Policy Response:', response);

            // Parse the response to find the smallest schedule interval
            // Expected format includes schedule information like "hourly", "daily", "weekly"
            // We'll look for patterns like "Count: X" with "Schedule: Y"
            
            let minRetentionHours = null;
            const lines = response.split('\n');
            
            for (const line of lines) {
                // Look for schedule patterns: hourly = 1h, daily = 24h, weekly = 168h
                if (line.match(/hourly/i)) {
                    minRetentionHours = minRetentionHours ? Math.min(minRetentionHours, 1) : 1;
                } else if (line.match(/daily/i)) {
                    minRetentionHours = minRetentionHours ? Math.min(minRetentionHours, 24) : 24;
                } else if (line.match(/weekly/i)) {
                    minRetentionHours = minRetentionHours ? Math.min(minRetentionHours, 168) : 168;
                }
            }

            if (minRetentionHours) {
                console.log(`Parsed snapshot policy min retention: ${minRetentionHours}h`);
                return { minRetentionHours };
            }

            return null;
        } catch (error) {
            console.error('Error fetching snapshot policy details:', error);
            return null;
        }
    }

    // Create monitoring alerts via Harvest MCP
    async createMonitoringAlerts(alerts) {
        if (!alerts || alerts.length === 0) {
            return { success: true, count: 0 };
        }

        const results = {
            success: true,
            count: 0,
            failed: 0,
            errors: []
        };

        // Create each alert rule via Harvest MCP
        for (const alert of alerts) {
            try {
                const response = await this.demo.clientManager.callTool('create_alert_rule', {
                    rule_name: alert.alert,
                    expression: alert.expr,
                    duration: alert.for,
                    severity: alert.labels.severity,
                    summary: alert.annotations.summary,
                    description: alert.annotations.description
                });
                
                console.log(`✅ Created alert rule: ${alert.alert}`);
                results.count++;
            } catch (error) {
                console.error(`❌ Failed to create alert rule ${alert.alert}:`, error);
                results.failed++;
                results.errors.push({ alert: alert.alert, error: error.message });
                results.success = false;
            }
        }

        return results;
    }

    // Show alert rules preview modal
    showAlertRulesModal(rules, title) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('alertRulesPreviewModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'alertRulesPreviewModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2 id="alertRulesModalTitle">${title}</h2>
                        <button class="modal-close" onclick="document.getElementById('alertRulesPreviewModal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div id="alertRulesContainer"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="document.getElementById('alertRulesPreviewModal').remove()">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            document.getElementById('alertRulesModalTitle').textContent = title;
        }

        // Populate alert rules
        const container = document.getElementById('alertRulesContainer');
        if (rules.length === 0) {
            container.innerHTML = '<p>No alert rules to display. Policy configuration may be missing required details.</p>';
        } else {
            container.innerHTML = rules.map((rule, index) => `
                <div class="alert-rule-preview">
                    <h4>Alert ${index + 1}: ${rule.alert}</h4>
                    <div class="alert-detail">
                        <strong>Expression:</strong>
                        <code>${rule.expr}</code>
                    </div>
                    <div class="alert-detail">
                        <strong>Duration:</strong> ${rule.for}
                    </div>
                    <div class="alert-detail">
                        <strong>Severity:</strong> <span class="severity-${rule.labels.severity}">${rule.labels.severity}</span>
                    </div>
                    <div class="alert-detail">
                        <strong>Summary:</strong> ${rule.annotations.summary}
                    </div>
                    <div class="alert-detail">
                        <strong>Description:</strong> ${rule.annotations.description}
                    </div>
                </div>
            `).join('');
        }

        // Show modal
        modal.style.display = 'flex';
    }
}
