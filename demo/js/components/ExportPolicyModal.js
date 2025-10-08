class ExportPolicyModal {
    constructor() {
        this.modal = null;
        this.form = null;
        this.rulesContainer = null;
        this.ruleCounter = 0;
    }
    
    render() {
        return `
            <!-- Export Policy Creation Modal -->
            <div class="modal-overlay" id="exportPolicyModal" style="display: none;">
                <div class="modal-content export-policy-modal">
                    <div class="modal-header">
                        <input type="text" id="exportPolicyNameHeader" class="modal-title-input" value="New Export Policy" placeholder="Enter policy name...">
                        <button class="modal-close" id="closeExportPolicyModal">&times;</button>
                    </div>
                    <form id="exportPolicyForm">
                        <div class="form-group">
                            <label for="exportPolicyDescription">Description (Optional)</label>
                            <textarea id="exportPolicyDescription" name="description" rows="2" placeholder="Enter policy description..."></textarea>
                        </div>
                        
                        <div class="export-rules-section">
                            <h3>Export Rules</h3>
                            <div id="rulesContainer">
                                <!-- Rules will be added dynamically -->
                            </div>
                            <button type="button" class="btn-secondary add-rule-btn" id="addExportRule">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 1V15M1 8H15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                                Add Rule
                            </button>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" id="cancelExportPolicy">Cancel</button>
                            <button type="submit" class="btn-primary" id="createExportPolicy">Create Policy</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
    
    init(parentElement) {
        // Inject HTML into DOM
        parentElement.insertAdjacentHTML('beforeend', this.render());
        
        // Now get references to DOM elements
        this.modal = document.getElementById('exportPolicyModal');
        this.form = document.getElementById('exportPolicyForm');
        this.rulesContainer = document.getElementById('rulesContainer');
        
        // Bind events after HTML is in DOM
        this.bindEvents();
        this.addInitialRule();
    }
    
    bindEvents() {
        // Modal close events
        document.getElementById('closeExportPolicyModal').addEventListener('click', () => this.close());
        document.getElementById('cancelExportPolicy').addEventListener('click', () => this.close());
        
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Add rule button
        document.getElementById('addExportRule').addEventListener('click', () => this.addRule());
        
        // Close modal when clicking outside
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
    }
    
    open() {
        this.modal.style.display = 'flex';
        this.reset();
        this.addInitialRule();
        
        // Focus on policy name input
        setTimeout(() => {
            document.getElementById('exportPolicyNameHeader').select();
        }, 100);
    }
    
    close() {
        this.modal.style.display = 'none';
        this.reset();
    }
    
    reset() {
        this.form.reset();
        document.getElementById('exportPolicyNameHeader').value = 'new_export_policy';
        this.rulesContainer.innerHTML = '';
        this.ruleCounter = 0;
    }
    
    addInitialRule() {
        this.addRule();
    }
    
    addRule() {
        this.ruleCounter++;
        const ruleDiv = document.createElement('div');
        ruleDiv.className = 'rule-item';
        ruleDiv.innerHTML = `
            <div class="rule-header">
                <span class="rule-title">Rule ${this.ruleCounter}</span>
                <button type="button" class="rule-remove" onclick="app.exportPolicyModal.removeRule(this)">Remove</button>
            </div>
            <div class="rule-fields">
                <div class="rule-field">
                    <label>Client Specification (IP/Mask)</label>
                    <input type="text" name="clientSpec" placeholder="e.g., 192.168.1.0/24 or 0.0.0.0/0" required>
                    <div class="rule-validation-error" style="display: none;"></div>
                </div>
                <div class="rule-field">
                    <label>Access Control</label>
                    <select name="accessControl" required>
                        <option value="rw">Read/Write</option>
                        <option value="ro">Read Only</option>
                    </select>
                </div>
                <div class="rule-field">
                    <label>Super User Access</label>
                    <select name="superUser" required>
                        <option value="any">Yes</option>
                        <option value="none">No</option>
                    </select>
                </div>
                <div class="rule-field">
                    <label>NFS Protocols</label>
                    <select name="protocols" required>
                        <option value="any">All</option>
                        <option value="nfs3">NFSv3</option>
                        <option value="nfs4">NFSv4</option>
                        <option value="nfs41">NFSv4.1</option>
                    </select>
                </div>
            </div>
        `;
        
        this.rulesContainer.appendChild(ruleDiv);
        
        // Add validation to client spec input
        const clientInput = ruleDiv.querySelector('input[name="clientSpec"]');
        clientInput.addEventListener('input', () => this.validateClientSpec(clientInput));
    }
    
    removeRule(button) {
        const ruleItem = button.closest('.rule-item');
        if (this.rulesContainer.children.length > 1) {
            ruleItem.remove();
            this.updateRuleNumbers();
        } else {
            app.showError('At least one rule is required');
        }
    }
    
    updateRuleNumbers() {
        const rules = this.rulesContainer.querySelectorAll('.rule-item');
        rules.forEach((rule, index) => {
            rule.querySelector('.rule-title').textContent = `Rule ${index + 1}`;
        });
    }
    
    validateClientSpec(input) {
        const value = input.value.trim();
        const errorDiv = input.parentNode.querySelector('.rule-validation-error');
        
        if (!value) {
            this.showFieldError(input, errorDiv, '');
            return true;
        }
        
        // IPv4 CIDR validation
        const ipv4CidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
        if (!ipv4CidrPattern.test(value)) {
            this.showFieldError(input, errorDiv, 'Invalid format. Use IP/mask (e.g., 192.168.1.0/24)');
            return false;
        }
        
        // Validate IP parts and CIDR
        const [ip, cidr] = value.split('/');
        const ipParts = ip.split('.');
        const cidrNum = parseInt(cidr);
        
        if (ipParts.some(part => parseInt(part) > 255) || cidrNum > 32) {
            this.showFieldError(input, errorDiv, 'Invalid IP address or CIDR value');
            return false;
        }
        
        this.showFieldError(input, errorDiv, '');
        return true;
    }
    
    showFieldError(input, errorDiv, message) {
        if (message) {
            input.style.borderColor = 'var(--text-destructive)';
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        } else {
            input.style.borderColor = 'var(--field-border)';
            errorDiv.style.display = 'none';
        }
    }
    
    collectRules() {
        const rules = [];
        const ruleItems = this.rulesContainer.querySelectorAll('.rule-item');
        
        for (const ruleItem of ruleItems) {
            const clientSpec = ruleItem.querySelector('input[name="clientSpec"]').value.trim();
            const accessControl = ruleItem.querySelector('select[name="accessControl"]').value;
            const superUser = ruleItem.querySelector('select[name="superUser"]').value;
            const protocols = ruleItem.querySelector('select[name="protocols"]').value;
            
            if (!this.validateClientSpec(ruleItem.querySelector('input[name="clientSpec"]'))) {
                return null; // Validation failed
            }
            
            rules.push({
                clients: [{ match: clientSpec }],
                ro_rule: ['sys'],
                rw_rule: [accessControl === 'rw' ? 'sys' : 'none'],
                superuser: [superUser],
                protocols: [protocols]
            });
        }
        
        return rules;
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const policyName = document.getElementById('exportPolicyNameHeader').value.trim();
        const description = document.getElementById('exportPolicyDescription').value.trim();
        const rules = this.collectRules();
        
        if (!rules) {
            app.showError('Please fix validation errors');
            return;
        }
        
        if (!policyName) {
            app.showError('Policy name is required');
            return;
        }
        
        try {
            const createBtn = document.getElementById('createExportPolicy');
            createBtn.disabled = true;
            createBtn.textContent = 'Creating...';
            
            await this.createPolicyWithRules(policyName, description, rules);
            
            app.showInfo('Export policy created successfully');
            this.close();
            
            // Refresh the export policy dropdown and select the new policy
            const svmSelect = document.getElementById('svmSelect');
            if (svmSelect && svmSelect.value) {
                await app.loadExportPoliciesForProvisioning();
                const exportPolicySelect = document.getElementById('exportPolicy');
                if (exportPolicySelect) {
                    exportPolicySelect.value = policyName;
                }
            }
            
        } catch (error) {
            console.error('Error creating export policy:', error);
            app.showError(`Failed to create export policy: ${error.message}`);
        } finally {
            const createBtn = document.getElementById('createExportPolicy');
            createBtn.disabled = false;
            createBtn.textContent = 'Create Policy';
        }
    }
    
    async createPolicyWithRules(policyName, description, rules) {
        const selectedCluster = app.selectedCluster?.name;
        const svmSelect = document.getElementById('svmSelect');
        const selectedSvm = svmSelect ? svmSelect.value : null;
        
        if (!selectedCluster || !selectedSvm) {
            throw new Error('Please select a cluster and SVM first');
        }
        
        let policyCreated = false;
        
        try {
            // Create the export policy
            const policyParams = {
                cluster_name: selectedCluster,
                policy_name: policyName,
                svm_name: selectedSvm
            };
            
            console.log('Creating export policy:', policyParams);
            await app.callMcp('create_export_policy', policyParams);
            policyCreated = true;
            
            // Add each rule
            for (let i = 0; i < rules.length; i++) {
                const rule = rules[i];
                const ruleParams = {
                    cluster_name: selectedCluster,
                    policy_name: policyName,
                    svm_name: selectedSvm,
                    clients: rule.clients,
                    ro_rule: rule.ro_rule,
                    rw_rule: rule.rw_rule,
                    superuser: rule.superuser,
                    protocols: rule.protocols
                };
                
                await app.callMcp('add_export_rule', ruleParams);
            }
            
        } catch (error) {
            // If policy was created but rules failed, try to clean up
            if (policyCreated) {
                try {
                    console.log('Cleaning up failed policy:', policyName);
                    await app.callMcp('delete_export_policy', {
                        cluster_name: selectedCluster,
                        policy_name: policyName,
                        svm_name: selectedSvm
                    });
                } catch (cleanupError) {
                    console.error('Failed to cleanup policy:', cleanupError);
                }
            }
            throw error;
        }
    }
}

// Export for global access
window.ExportPolicyModal = ExportPolicyModal;