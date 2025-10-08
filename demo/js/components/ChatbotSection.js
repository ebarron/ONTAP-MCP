/**
 * ChatbotSection Component
 * Renders the NetApp ONTAP Provisioning Assistant chatbot UI
 */
class ChatbotSection {
    constructor() {
        this.containerId = 'chatbot-section';
    }

    // Render the complete chatbot section HTML
    render() {
        return `
            <!-- NetApp ONTAP Provisioning Assistant -->
            <section class="chatbot-section" id="${this.containerId}">
                <div class="chatbot-container">
                    <div class="chatbot-header">
                        <div class="chatbot-header-content">
                            <div class="chatbot-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C10.25 22 8.59 21.57 7.14 20.78L2 22L3.22 16.86C2.43 15.41 2 13.75 2 12C2 6.48 6.48 2 12 2ZM12 4C7.59 4 4 7.59 4 12C4 13.66 4.5 15.2 5.36 16.5L4.82 19.18L7.5 18.64C8.8 19.5 10.34 20 12 20C16.41 20 20 16.41 20 12C20 7.59 16.41 4 12 4Z" fill="var(--icon-primary)"/>
                                    <circle cx="9" cy="12" r="1" fill="var(--icon-primary)"/>
                                    <circle cx="12" cy="12" r="1" fill="var(--icon-primary)"/>
                                    <circle cx="15" cy="12" r="1" fill="var(--icon-primary)"/>
                                </svg>
                            </div>
                            <div class="chatbot-title">
                                <h3>NetApp ONTAP Provisioning Assistant</h3>
                                <span class="chatbot-subtitle">Intelligent storage recommendations based on capacity and best practices</span>
                            </div>
                            <button class="chatbot-toggle" id="chatbotToggle">
                                <svg class="chevron-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 6L8 10L12 6" stroke="var(--icon-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="chatbot-content" id="chatbotContent">
                        <div class="chatbot-messages" id="chatbotMessages">
                            <!-- Welcome message will be inserted here -->
                        </div>
                        <div class="chatbot-input-container">
                            <div class="chatbot-input-wrapper">
                                <input type="text" id="chatbotInput" class="chatbot-input" placeholder="Ask me about provisioning storage across your ONTAP clusters..." disabled>
                                <button class="chatbot-send" id="chatbotSend" disabled>
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2 10L18 2L10 18L8 10L2 10Z" fill="var(--icon-primary)"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="chatbot-status" id="chatbotStatus">
                                Initializing AI assistant...
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    // Initialize the component (inject HTML into DOM)
    init(parentElement) {
        // Check if chatbot section already exists
        if (document.getElementById(this.containerId)) {
            return;
        }
        
        const chatbotHTML = this.render();
        parentElement.insertAdjacentHTML('beforeend', chatbotHTML);
    }

    // Show the chatbot section
    show() {
        const section = document.getElementById(this.containerId);
        if (section) {
            section.style.display = 'block';
        }
    }

    // Hide the chatbot section
    hide() {
        const section = document.getElementById(this.containerId);
        if (section) {
            section.style.display = 'none';
        }
    }
}

// Create global instance
const chatbotSection = new ChatbotSection();
