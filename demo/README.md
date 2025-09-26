# NetApp ONTAP MCP Demo Interface# NetApp ONTAP MCP Demo Interface# NetApp ONTAP MCP Demo Interface# NetApp ONTAP MCP Demo Interface



A web-based demonstration interface for the NetApp ONTAP MCP server featuring authentic NetApp BlueXP styling, complete storage provisioning workflows, and intelligent chatbot assistance.



## 🚀 Quick StartA web-based demonstration interface for the NetApp ONTAP MCP server featuring authentic NetApp BlueXP styling, complete storage provisioning workflows, and intelligent chatbot assistance.



### Prerequisites

- NetApp ONTAP MCP server built and configured (see main `README.md`)

- Test clusters configured in `test/clusters.json`## 🚀 Quick StartA web-based demonstration interface for the NetApp ONTAP MCP server featuring authentic NetApp BlueXP styling, complete storage provisioning workflows, and intelligent chatbot assistance.A web-based demonstration interface for the NetApp ONTAP MCP server featuring authentic NetApp BlueXP styling, complete storage provisioning workflows, and intelligent chatbot assistance.

- Python 3 for web server



### Start Demo

```bash### Prerequisites

# From ONTAP-MCP root directory (automated startup)

./start-demo.sh- NetApp ONTAP MCP server built and configured (see main `README.md`)



# Access demo at: http://localhost:8080- Test clusters configured in `test/clusters.json`## 🚀 Quick Start## 🚀 Quick Start

# MCP API available at: http://localhost:3000

```- Python 3 for web server



The startup script automatically:

- Builds the MCP server if needed

- Loads ALL clusters from `test/clusters.json`### Start Demo

- Starts MCP HTTP server on port 3000 with proper environment variables

- Starts demo web server from `demo/` directory on port 8080```bash### Prerequisites### Prerequisites

- Validates both servers are responding correctly

# From ONTAP-MCP root directory (automated startup)

### Stop Demo

```bash./start-demo.sh- NetApp ONTAP MCP server built and configured (see main `README.md`)- NetApp ONTAP MCP server built and configured (see main `README.md`)

./stop-demo.sh

```



## 🎯 Purpose# Access demo at: http://localhost:8080- Test clusters configured in `test/clusters.json`- Test clusters configured in `test/clusters.json`



This demo serves multiple functions:# MCP API available at: http://localhost:3000



1. **Visual Showcase**: Demonstrates MCP capabilities through authentic NetApp BlueXP interface```- Python 3 for web server- Python 3 for web server

2. **HTTP API Validation**: Comprehensive validation of all 48 MCP tools via real workflows

3. **Storage Provisioning**: Complete end-to-end volume and CIFS share creation

4. **Intelligent Assistant**: ChatGPT-powered provisioning recommendations with auto-form population

5. **Development Foundation**: Extensible architecture for future agentic/LLM integrationThe startup script automatically:



## 🏗️ Architecture- Builds the MCP server if needed



### ES6 Modular Design- Loads ALL clusters from `test/clusters.json`### Start Demo### Start Demo

The demo follows a component-based architecture with clear separation of concerns:

- Starts MCP HTTP server on port 3000 with proper environment variables

```

demo/- Starts demo web server from `demo/` directory on port 8080```bash```bash

├── app.js                          # Main orchestrator (499 lines)

├── js/- Validates both servers are responding correctly

│   ├── core/

│   │   ├── McpApiClient.js        # MCP HTTP transport# From ONTAP-MCP root directory (automated startup)# From ONTAP-MCP root directory (automated startup)

│   │   └── utils.js               # Shared utilities

│   ├── ui/### Stop Demo

│   │   └── ToastNotifications.js  # User notifications

│   └── components/```bash./start-demo.sh./start-demo.sh

│       ├── ChatbotAssistant.js    # AI provisioning assistant

│       ├── ProvisioningPanel.js   # Storage provisioning workflow./stop-demo.sh

│       └── ExportPolicyModal.js   # NFS export policy management

``````



### Key Components



#### Main Application (499 lines)## 🎯 Purpose# Access demo at: http://localhost:8080# Access demo at: http://localhost:8080

- Cluster management and selection

- UI orchestration and event handling

- Component coordination

This demo serves multiple functions:# MCP API available at: http://localhost:3000# MCP API available at: http://localhost:3000

#### ProvisioningPanel (581 lines)

- Complete storage provisioning workflow

- NFS and CIFS/SMB protocol support

- Form validation and dropdown population1. **Visual Showcase**: Demonstrates MCP capabilities through authentic NetApp BlueXP interface``````

- Volume creation with optional CIFS share

2. **HTTP API Validation**: Comprehensive validation of all 48 MCP tools via real workflows

#### ChatbotAssistant (1040+ lines)  

- ChatGPT integration with function calling3. **Storage Provisioning**: Complete end-to-end volume and CIFS share creation

- Intelligent capacity analysis across clusters

- Structured recommendation parsing4. **Intelligent Assistant**: ChatGPT-powered provisioning recommendations with auto-form population

- Auto-form population from AI recommendations

5. **Development Foundation**: Extensible architecture for future agentic/LLM integrationThe startup script automatically:The startup script automatically:

## 🛠️ Features



### Storage Provisioning Workflow

- **Multi-cluster Support**: Provision across any registered ONTAP cluster## 🏗️ Architecture- Builds the MCP server if needed- Builds the MCP server if needed

- **Protocol Selection**: NFS or CIFS/SMB with appropriate configuration

- **Validation**: Real-time form validation and ONTAP naming compliance

- **Safety**: Prevents invalid configurations and provides clear error messages

### ES6 Modular Design- Loads ALL clusters from `test/clusters.json`- Loads ALL clusters from `test/clusters.json`

### CIFS/SMB Integration

- **Share Creation**: Simultaneous volume and CIFS share creationThe demo follows a component-based architecture with clear separation of concerns:

- **Access Control**: Windows users/groups with granular permissions

- **Share Properties**: Configurable encryption, offline files, oplocks- Starts MCP HTTP server on port 3000 with proper environment variables- Starts MCP HTTP server on port 3000 with proper environment variables

- **Security Styles**: Support for NTFS, Unix, mixed security styles

```

### Intelligent Chatbot Assistant

- **Capacity Analysis**: Real-time cluster capacity evaluationdemo/- Starts demo web server from `demo/` directory on port 8080- Starts demo web server from `demo/` directory on port 8080

- **Smart Recommendations**: AI-powered storage placement decisions

- **Auto-Population**: Seamless form filling from chatbot recommendations├── app.js                          # Main orchestrator (499 lines)

- **Multi-step Workflows**: Complex provisioning scenarios with tool chaining

├── js/- Validates both servers are responding correctly- Validates both servers are responding correctly

### Cluster Management

- **Dynamic Registration**: Add clusters at runtime│   ├── core/

- **Connection Testing**: Validate cluster connectivity

- **Multi-cluster Views**: Unified management interface│   │   ├── McpApiClient.js        # MCP HTTP transport

- **Detailed Information**: Cluster health and configuration display

│   │   └── utils.js               # Shared utilities

### User Interface

- **NetApp BlueXP Styling**: Authentic NetApp design system│   ├── ui/### Stop Demo### Stop Demo

- **Responsive Design**: Mobile-friendly interface

- **Progressive Enhancement**: Core functionality without JavaScript│   │   └── ToastNotifications.js  # User notifications

- **Accessibility**: WCAG-compliant design patterns

│   └── components/```bash```bash

## 🤖 AI Assistant Integration

│       ├── ChatbotAssistant.js    # AI provisioning assistant

### ChatGPT Integration

The demo includes a sophisticated AI assistant powered by ChatGPT for intelligent storage provisioning recommendations.│       ├── ProvisioningPanel.js   # Storage provisioning workflow./stop-demo.sh./stop-demo.sh



**Setup Instructions**: See `CHATBOT_README.md` for complete configuration guide  │       └── ExportPolicyModal.js   # NFS export policy management

**API Response Format**: See `CHATBOT_STRUCTURED_FORMAT.md` for integration specifications

`````````

### Key Capabilities

- **Multi-cluster Analysis**: Evaluates capacity across all registered clusters

- **Intelligent Placement**: AI-driven storage location recommendations

- **Auto-form Population**: Seamless integration with provisioning workflow### Key Components

- **Context Awareness**: Maintains conversation history and cluster state



## 🔧 Configuration

#### Main Application (499 lines)## 🎯 Purpose## 🎯 Purpose

### Manual Setup (if automated startup fails)

```bash- Cluster management and selection

# Terminal 1: Start MCP HTTP server with test clusters

cd /Users/ebarron/ONTAP-MCP- UI orchestration and event handling

export ONTAP_CLUSTERS=$(cat test/clusters.json)

node build/index.js --http=3000- Component coordination



# Terminal 2: Start demo web server FROM DEMO DIRECTORYThis demo serves multiple functions:This demo serves multiple functions:

cd /Users/ebarron/ONTAP-MCP/demo  

python3 -m http.server 8080#### ProvisioningPanel (581 lines)

```

- Complete storage provisioning workflow

### Environment Variables

- `ONTAP_CLUSTERS`: JSON array of cluster configurations for automatic loading- NFS and CIFS/SMB protocol support

- `CHATGPT_API_KEY`: Optional - enables AI assistant functionality

- Form validation and dropdown population1. **Visual Showcase**: Demonstrates MCP capabilities through authentic NetApp BlueXP interface1. **Visual Showcase**: Demonstrates MCP capabilities through authentic NetApp BlueXP interface

### CORS Configuration

The MCP HTTP server includes CORS headers for browser compatibility:- Volume creation with optional CIFS share

- `Access-Control-Allow-Origin: *`

- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`2. **HTTP API Validation**: Comprehensive validation of all 48 MCP tools via real workflows2. **HTTP API Validation**: Comprehensive validation of all 48 MCP tools via real workflows

- `Access-Control-Allow-Headers: Content-Type, Authorization`

#### ChatbotAssistant (1040+ lines)  

## 📊 API Coverage

- ChatGPT integration with function calling3. **Storage Provisioning**: Complete end-to-end volume and CIFS share creation3. **Storage Provisioning**: Complete end-to-end volume and CIFS share creation

The demo exercises all 48 MCP tools through realistic workflows:

- Intelligent capacity analysis across clusters

### Complete Volume Lifecycle

1. **Discovery**: `list_registered_clusters`, `cluster_list_svms`, `cluster_list_aggregates`- Structured recommendation parsing4. **Intelligent Assistant**: ChatGPT-powered provisioning recommendations with auto-form population4. **Intelligent Assistant**: ChatGPT-powered provisioning recommendations with auto-form population

2. **Provisioning**: `cluster_create_volume`, `create_export_policy`, `add_export_rule`

3. **Management**: `get_volume_configuration`, `resize_volume`, `update_volume_comment`- Auto-form population from AI recommendations

4. **Protection**: `create_snapshot_policy`, `list_snapshot_schedules`

5. **Cleanup**: `cluster_offline_volume`, `cluster_delete_volume`5. **Development Foundation**: Extensible architecture for future agentic/LLM integration5. **Development Foundation**: Extensible architecture for future agentic/LLM integration



### CIFS/SMB Workflow## 🛠️ Features

1. **Share Creation**: `cluster_create_cifs_share`, `create_cifs_share`

2. **Management**: `cluster_list_cifs_shares`, `get_cifs_share`

3. **Updates**: `update_cifs_share` permissions and properties

4. **Cleanup**: `cluster_delete_cifs_share`### Storage Provisioning Workflow



### Policy Management- **Multi-cluster Support**: Provision across any registered ONTAP cluster## 🏗️ Architecture## 🏗️ Architecture

1. **Export Policies**: `list_export_policies`, `create_export_policy`, `add_export_rule`

2. **Snapshot Policies**: `list_snapshot_policies`, `create_snapshot_policy`- **Protocol Selection**: NFS or CIFS/SMB with appropriate configuration

3. **Schedule Management**: `list_snapshot_schedules`, `create_snapshot_schedule`

- **Validation**: Real-time form validation and ONTAP naming compliance

## 🎨 Design System

- **Safety**: Prevents invalid configurations and provides clear error messages

### NetApp BlueXP Styling

- **Colors**: NetApp blue (#0067C5), purple (#7b2cbf), semantic color palette### ES6 Modular Design### ES6 Modular Design

- **Typography**: Open Sans font family with consistent weight hierarchy

- **Components**: Authentic BlueXP buttons, forms, tables, and navigation### CIFS/SMB Integration

- **Icons**: NetApp-style iconography and visual elements

- **Layout**: Responsive grid system with proper spacing- **Share Creation**: Simultaneous volume and CIFS share creationThe demo follows a component-based architecture with clear separation of concerns:The demo follows a component-based architecture with clear separation of concerns:



### Component Patterns- **Access Control**: Windows users/groups with granular permissions

- **Search Expansion**: Click-to-expand search functionality

- **Loading States**: Visual feedback during API operations- **Share Properties**: Configurable encryption, offline files, oplocks

- **Error Handling**: Graceful degradation with user-friendly messages

- **Progressive Disclosure**: Information revealed as needed- **Security Styles**: Support for NTFS, Unix, mixed security styles



## 📚 Documentation``````



### Component Documentation### Intelligent Chatbot Assistant

- **AI Assistant**: See `CHATBOT_README.md` for setup and usage

- **API Integration**: See `CHATBOT_STRUCTURED_FORMAT.md` for response format specifications- **Capacity Analysis**: Real-time cluster capacity evaluationdemo/demo/

- **Testing Guide**: See `test/README.md` for comprehensive testing documentation

- **API Testing**: Use `test/test-api.html` for interactive MCP tool testing- **Smart Recommendations**: AI-powered storage placement decisions



### Development References- **Auto-Population**: Seamless form filling from chatbot recommendations├── app.js                          # Main orchestrator (499 lines)├── app.js                          # Main orchestrator (499 lines)

- **Main Project**: See main `README.md` for MCP server architecture

- **Development Guide**: See `.github/copilot-instructions.md` for detailed development patterns- **Multi-step Workflows**: Complex provisioning scenarios with tool chaining



## 🔄 Development Workflow├── js/├── js/



### Building Changes### Cluster Management

```bash

# Build MCP server changes- **Dynamic Registration**: Add clusters at runtime│   ├── core/│   ├── core/

npm run build

- **Connection Testing**: Validate cluster connectivity

# Restart demo (rebuilds automatically)

./stop-demo.sh && ./start-demo.sh- **Multi-cluster Views**: Unified management interface│   │   ├── McpApiClient.js        # MCP HTTP transport│   │   ├── McpApiClient.js        # MCP HTTP transport

```

- **Detailed Information**: Cluster health and configuration display

### Component Development

- Each component is self-contained with clear dependencies│   │   └── utils.js               # Shared utilities│   │   └── utils.js               # Shared utilities

- Global access via `window.ComponentName` pattern

- HTML integration through `app.componentName.methodName()`### User Interface

- Consistent error handling and user feedback

- **NetApp BlueXP Styling**: Authentic NetApp design system│   ├── ui/│   ├── ui/

### Testing Integration

- All demo functionality validated through real ONTAP API calls- **Responsive Design**: Mobile-friendly interface

- No mocking - ensures authentic behavior

- Cross-browser compatibility testing- **Progressive Enhancement**: Core functionality without JavaScript│   │   └── ToastNotifications.js  # User notifications│   │   └── ToastNotifications.js  # User notifications

- Mobile responsiveness validation

- **Accessibility**: WCAG-compliant design patterns

## 🛠️ File Structure

│   └── components/│   └── components/

```

demo/## 🤖 AI Assistant Integration

├── README.md                       # This documentation

├── CHATBOT_README.md              # AI assistant setup and configuration│       ├── ChatbotAssistant.js    # AI provisioning assistant│       ├── ChatbotAssistant.js    # AI provisioning assistant

├── CHATBOT_STRUCTURED_FORMAT.md   # ChatGPT integration specifications

├── index.html                     # Main interface structure### ChatGPT Integration

├── styles.css                     # NetApp BlueXP design system

├── app.js                         # Main application (499 lines)The demo includes a sophisticated AI assistant powered by ChatGPT for intelligent storage provisioning recommendations.│       ├── ProvisioningPanel.js   # Storage provisioning workflow│       ├── ProvisioningPanel.js   # Storage provisioning workflow

├── chatgpt-config.json.example    # ChatGPT configuration template

├── js/

│   ├── core/

│   │   ├── McpApiClient.js        # HTTP transport layer**Setup Instructions**: See `CHATBOT_README.md` for complete configuration guide│       └── ExportPolicyModal.js   # NFS export policy management│       └── ExportPolicyModal.js   # NFS export policy management

│   │   └── utils.js               # Shared utilities

│   ├── ui/**API Response Format**: See `CHATBOT_STRUCTURED_FORMAT.md` for integration specifications

│   │   └── ToastNotifications.js  # User notifications

│   └── components/``````

│       ├── ChatbotAssistant.js    # AI provisioning assistant

│       ├── ProvisioningPanel.js   # Storage provisioning workflow### Key Capabilities

│       ├── ExportPolicyModal.js   # NFS export policy management

│       └── app-initialization.js  # Component initialization- **Multi-cluster Analysis**: Evaluates capacity across all registered clusters

└── test/

    ├── README.md                  # Testing documentation- **Intelligent Placement**: AI-driven storage location recommendations

    ├── test-api.html              # Interactive API testing

    ├── debug.html                 # Development debugging tools- **Auto-form Population**: Seamless integration with provisioning workflow### Key Components### Key Components

    └── test-intent-detection.js   # Chatbot testing utilities

```- **Context Awareness**: Maintains conversation history and cluster state



## 🔧 Configuration

#### Main Application (499 lines)#### Main Application (499 lines)

### Manual Setup (if automated startup fails)

```bash- Cluster management and selection- Cluster management and selection

# Terminal 1: Start MCP HTTP server with test clusters

cd /Users/ebarron/ONTAP-MCP- UI orchestration and event handling- UI orchestration and event handling

export ONTAP_CLUSTERS=$(cat test/clusters.json)

node build/index.js --http=3000- Component coordination- Component coordination



# Terminal 2: Start demo web server FROM DEMO DIRECTORY

cd /Users/ebarron/ONTAP-MCP/demo  

python3 -m http.server 8080#### ProvisioningPanel (581 lines)#### ProvisioningPanel (581 lines)

```

- Complete storage provisioning workflow- Complete storage provisioning workflow

### Environment Variables

- `ONTAP_CLUSTERS`: JSON array of cluster configurations for automatic loading- NFS and CIFS/SMB protocol support- NFS and CIFS/SMB protocol support

- `CHATGPT_API_KEY`: Optional - enables AI assistant functionality

- Form validation and dropdown population- Form validation and dropdown population

### CORS Configuration

The MCP HTTP server includes CORS headers for browser compatibility:- Volume creation with optional CIFS share- Volume creation with optional CIFS share

- `Access-Control-Allow-Origin: *`

- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`

- `Access-Control-Allow-Headers: Content-Type, Authorization`

#### ChatbotAssistant (1040+ lines)  #### ChatbotAssistant (1040+ lines)  

## 📊 API Coverage

- ChatGPT integration with function calling- ChatGPT integration with function calling

The demo exercises all 48 MCP tools through realistic workflows:

- Intelligent capacity analysis across clusters- Intelligent capacity analysis across clusters

### Complete Volume Lifecycle

1. **Discovery**: `list_registered_clusters`, `cluster_list_svms`, `cluster_list_aggregates`- Structured recommendation parsing- Structured recommendation parsing

2. **Provisioning**: `cluster_create_volume`, `create_export_policy`, `add_export_rule`

3. **Management**: `get_volume_configuration`, `resize_volume`, `update_volume_comment`- Auto-form population from AI recommendations- Auto-form population from AI recommendations

4. **Protection**: `create_snapshot_policy`, `list_snapshot_schedules`

5. **Cleanup**: `cluster_offline_volume`, `cluster_delete_volume`



### CIFS/SMB Workflow## 🛠️ Features## 🛠️ Features

1. **Share Creation**: `cluster_create_cifs_share`, `create_cifs_share`

2. **Management**: `cluster_list_cifs_shares`, `get_cifs_share`

3. **Updates**: `update_cifs_share` permissions and properties

4. **Cleanup**: `cluster_delete_cifs_share`### Storage Provisioning Workflow### Storage Provisioning Workflow



### Policy Management- **Multi-cluster Support**: Provision across any registered ONTAP cluster- **Multi-cluster Support**: Provision across any registered ONTAP cluster

1. **Export Policies**: `list_export_policies`, `create_export_policy`, `add_export_rule`

2. **Snapshot Policies**: `list_snapshot_policies`, `create_snapshot_policy`- **Protocol Selection**: NFS or CIFS/SMB with appropriate configuration- **Protocol Selection**: NFS or CIFS/SMB with appropriate configuration

3. **Schedule Management**: `list_snapshot_schedules`, `create_snapshot_schedule`

- **Validation**: Real-time form validation and ONTAP naming compliance- **Validation**: Real-time form validation and ONTAP naming compliance

## 🎨 Design System

- **Safety**: Prevents invalid configurations and provides clear error messages- **Safety**: Prevents invalid configurations and provides clear error messages

### NetApp BlueXP Styling

- **Colors**: NetApp blue (#0067C5), purple (#7b2cbf), semantic color palette

- **Typography**: Open Sans font family with consistent weight hierarchy

- **Components**: Authentic BlueXP buttons, forms, tables, and navigation### CIFS/SMB Integration### CIFS/SMB Integration

- **Icons**: NetApp-style iconography and visual elements

- **Layout**: Responsive grid system with proper spacing- **Share Creation**: Simultaneous volume and CIFS share creation- **Share Creation**: Simultaneous volume and CIFS share creation



### Component Patterns- **Access Control**: Windows users/groups with granular permissions- **Access Control**: Windows users/groups with granular permissions

- **Search Expansion**: Click-to-expand search functionality

- **Loading States**: Visual feedback during API operations- **Share Properties**: Configurable encryption, offline files, oplocks- **Share Properties**: Configurable encryption, offline files, oplocks

- **Error Handling**: Graceful degradation with user-friendly messages

- **Progressive Disclosure**: Information revealed as needed- **Security Styles**: Support for NTFS, Unix, mixed security styles- **Security Styles**: Support for NTFS, Unix, mixed security styles



## 📚 Documentation



### Component Documentation### Intelligent Chatbot Assistant### Intelligent Chatbot Assistant

- **AI Assistant**: See `CHATBOT_README.md` for setup and usage

- **API Integration**: See `CHATBOT_STRUCTURED_FORMAT.md` for response format specifications- **Capacity Analysis**: Real-time cluster capacity evaluation- **Capacity Analysis**: Real-time cluster capacity evaluation

- **Testing Guide**: See `test/README.md` for comprehensive testing documentation

- **API Testing**: Use `test/test-api.html` for interactive MCP tool testing- **Smart Recommendations**: AI-powered storage placement decisions- **Smart Recommendations**: AI-powered storage placement decisions



### Development References- **Auto-Population**: Seamless form filling from chatbot recommendations- **Auto-Population**: Seamless form filling from chatbot recommendations

- **Main Project**: See main `README.md` for MCP server architecture

- **Development Guide**: See `.github/copilot-instructions.md` for detailed development patterns- **Multi-step Workflows**: Complex provisioning scenarios with tool chaining- **Multi-step Workflows**: Complex provisioning scenarios with tool chaining



## 🔄 Development Workflow



### Building Changes### Cluster Management### Cluster Management

```bash

# Build MCP server changes- **Dynamic Registration**: Add clusters at runtime- **Dynamic Registration**: Add clusters at runtime

npm run build

- **Connection Testing**: Validate cluster connectivity- **Connection Testing**: Validate cluster connectivity

# Restart demo (rebuilds automatically)

./stop-demo.sh && ./start-demo.sh- **Multi-cluster Views**: Unified management interface- **Multi-cluster Views**: Unified management interface

```

- **Detailed Information**: Cluster health and configuration display- **Detailed Information**: Cluster health and configuration display

### Component Development

- Each component is self-contained with clear dependencies

- Global access via `window.ComponentName` pattern

- HTML integration through `app.componentName.methodName()`### User Interface### User Interface

- Consistent error handling and user feedback

- **NetApp BlueXP Styling**: Authentic NetApp design system- **NetApp BlueXP Styling**: Authentic NetApp design system

### Testing Integration

- All demo functionality validated through real ONTAP API calls- **Responsive Design**: Mobile-friendly interface- **Responsive Design**: Mobile-friendly interface

- No mocking - ensures authentic behavior

- Cross-browser compatibility testing- **Progressive Enhancement**: Core functionality without JavaScript- **Progressive Enhancement**: Core functionality without JavaScript

- Mobile responsiveness validation

- **Accessibility**: WCAG-compliant design patterns- **Accessibility**: WCAG-compliant design patterns

## 🛠️ File Structure



```

demo/## 🤖 AI Assistant Integration## 🔧 Configuration

├── README.md                       # This documentation

├── CHATBOT_README.md              # AI assistant setup and configuration

├── CHATBOT_STRUCTURED_FORMAT.md   # ChatGPT integration specifications

├── index.html                     # Main interface structure### ChatGPT Integration### Manual Setup (if automated startup fails)

├── styles.css                     # NetApp BlueXP design system

├── app.js                         # Main application (499 lines)The demo includes a sophisticated AI assistant powered by ChatGPT for intelligent storage provisioning recommendations.```bash

├── chatgpt-config.json.example    # ChatGPT configuration template

├── js/# Terminal 1: Start MCP HTTP server with test clusters

│   ├── core/

│   │   ├── McpApiClient.js        # HTTP transport layer**Setup Instructions**: See `CHATBOT_README.md` for complete configuration guidecd /Users/ebarron/ONTAP-MCP

│   │   └── utils.js               # Shared utilities

│   ├── ui/**API Response Format**: See `CHATBOT_STRUCTURED_FORMAT.md` for integration specificationsexport ONTAP_CLUSTERS=$(cat test/clusters.json)

│   │   └── ToastNotifications.js  # User notifications

│   └── components/node build/index.js --http=3000

│       ├── ChatbotAssistant.js    # AI provisioning assistant

│       ├── ProvisioningPanel.js   # Storage provisioning workflow### Key Capabilities

│       ├── ExportPolicyModal.js   # NFS export policy management

│       └── app-initialization.js  # Component initialization- **Multi-cluster Analysis**: Evaluates capacity across all registered clusters# Terminal 2: Start demo web server FROM DEMO DIRECTORY

└── test/

    ├── README.md                  # Testing documentation- **Intelligent Placement**: AI-driven storage location recommendationscd /Users/ebarron/ONTAP-MCP/demo  

    ├── test-api.html              # Interactive API testing

    ├── debug.html                 # Development debugging tools- **Auto-form Population**: Seamless integration with provisioning workflowpython3 -m http.server 8080

    └── test-intent-detection.js   # Chatbot testing utilities

```- **Context Awareness**: Maintains conversation history and cluster state```



## 🔧 Configuration### Environment Variables

- `ONTAP_CLUSTERS`: JSON array of cluster configurations for automatic loading

### Manual Setup (if automated startup fails)- `CHATGPT_API_KEY`: Optional - enables AI assistant functionality

```bash

# Terminal 1: Start MCP HTTP server with test clusters### CORS Configuration

cd /Users/ebarron/ONTAP-MCPThe MCP HTTP server includes CORS headers for browser compatibility:

export ONTAP_CLUSTERS=$(cat test/clusters.json)- `Access-Control-Allow-Origin: *`

node build/index.js --http=3000- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`

- `Access-Control-Allow-Headers: Content-Type, Authorization`

# Terminal 2: Start demo web server FROM DEMO DIRECTORY

cd /Users/ebarron/ONTAP-MCP/demo  ## 📊 API Coverage

python3 -m http.server 8080

```The demo exercises all 48 MCP tools through realistic workflows:



### Environment Variables### Complete Volume Lifecycle

- `ONTAP_CLUSTERS`: JSON array of cluster configurations for automatic loading1. **Discovery**: `list_registered_clusters`, `cluster_list_svms`, `cluster_list_aggregates`

- `CHATGPT_API_KEY`: Optional - enables AI assistant functionality (see `CHATBOT_README.md`)2. **Provisioning**: `cluster_create_volume`, `create_export_policy`, `add_export_rule`

3. **Management**: `get_volume_configuration`, `resize_volume`, `update_volume_comment`

### CORS Configuration4. **Protection**: `create_snapshot_policy`, `list_snapshot_schedules`

The MCP HTTP server includes CORS headers for browser compatibility:5. **Cleanup**: `cluster_offline_volume`, `cluster_delete_volume`

- `Access-Control-Allow-Origin: *`

- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`### CIFS/SMB Workflow

- `Access-Control-Allow-Headers: Content-Type, Authorization`1. **Share Creation**: `cluster_create_cifs_share`, `create_cifs_share`

2. **Management**: `cluster_list_cifs_shares`, `get_cifs_share`

## 📊 API Coverage3. **Updates**: `update_cifs_share` permissions and properties

4. **Cleanup**: `cluster_delete_cifs_share`

The demo exercises all 48 MCP tools through realistic workflows:

### Policy Management

### Complete Volume Lifecycle1. **Export Policies**: `list_export_policies`, `create_export_policy`, `add_export_rule`

1. **Discovery**: `list_registered_clusters`, `cluster_list_svms`, `cluster_list_aggregates`2. **Snapshot Policies**: `list_snapshot_policies`, `create_snapshot_policy`

2. **Provisioning**: `cluster_create_volume`, `create_export_policy`, `add_export_rule`3. **Schedule Management**: `list_snapshot_schedules`, `create_snapshot_schedule`

3. **Management**: `get_volume_configuration`, `resize_volume`, `update_volume_comment`

4. **Protection**: `create_snapshot_policy`, `list_snapshot_schedules`## 🎨 Design System

5. **Cleanup**: `cluster_offline_volume`, `cluster_delete_volume`

### NetApp BlueXP Styling

### CIFS/SMB Workflow- **Colors**: NetApp blue (#0067C5), purple (#7b2cbf), semantic color palette

1. **Share Creation**: `cluster_create_cifs_share`, `create_cifs_share`- **Typography**: Open Sans font family with consistent weight hierarchy

2. **Management**: `cluster_list_cifs_shares`, `get_cifs_share`- **Components**: Authentic BlueXP buttons, forms, tables, and navigation

3. **Updates**: `update_cifs_share` permissions and properties- **Icons**: NetApp-style iconography and visual elements

4. **Cleanup**: `cluster_delete_cifs_share`- **Layout**: Responsive grid system with proper spacing



### Policy Management### Component Patterns

1. **Export Policies**: `list_export_policies`, `create_export_policy`, `add_export_rule`- **Search Expansion**: Click-to-expand search functionality

2. **Snapshot Policies**: `list_snapshot_policies`, `create_snapshot_policy`- **Loading States**: Visual feedback during API operations

3. **Schedule Management**: `list_snapshot_schedules`, `create_snapshot_schedule`- **Error Handling**: Graceful degradation with user-friendly messages

- **Progressive Disclosure**: Information revealed as needed

## 🎨 Design System

## 📚 Documentation

### NetApp BlueXP Styling

- **Colors**: NetApp blue (#0067C5), purple (#7b2cbf), semantic color palette- **Testing Guide**: See `test/README.md` for comprehensive testing documentation

- **Typography**: Open Sans font family with consistent weight hierarchy- **API Testing**: Use `test/test-api.html` for interactive MCP tool testing

- **Components**: Authentic BlueXP buttons, forms, tables, and navigation- **Development**: See main `README.md` and `.github/copilot-instructions.md`

- **Icons**: NetApp-style iconography and visual elements

- **Layout**: Responsive grid system with proper spacing## 🔄 Development Workflow



### Component Patterns### Building Changes

- **Search Expansion**: Click-to-expand search functionality```bash

- **Loading States**: Visual feedback during API operations# Build MCP server changes

- **Error Handling**: Graceful degradation with user-friendly messagesnpm run build

- **Progressive Disclosure**: Information revealed as needed

# Restart demo (rebuilds automatically)

## 📚 Documentation./stop-demo.sh && ./start-demo.sh

```

### Component Documentation

- **AI Assistant**: See `CHATBOT_README.md` for setup and usage### Component Development

- **API Integration**: See `CHATBOT_STRUCTURED_FORMAT.md` for response format specifications- Each component is self-contained with clear dependencies

- **Testing Guide**: See `test/README.md` for comprehensive testing documentation- Global access via `window.ComponentName` pattern

- **API Testing**: Use `test/test-api.html` for interactive MCP tool testing- HTML integration through `app.componentName.methodName()`

- Consistent error handling and user feedback

### Development References

- **Main Project**: See main `README.md` for MCP server architecture### Testing Integration

- **Development Guide**: See `.github/copilot-instructions.md` for detailed development patterns- All demo functionality validated through real ONTAP API calls

- No mocking - ensures authentic behavior

## 🔄 Development Workflow- Cross-browser compatibility testing

- Mobile responsiveness validation

### Building Changes

```bash1. **HTTP API Validation**: Comprehensive testing of ONTAP MCP server's HTTP API endpoints through real provisioning workflows

# Build MCP server changes2. **Visual Demonstration**: Provide an authentic NetApp BlueXP-style interface to showcase MCP capabilities  

npm run build3. **Testing Framework**: Complete end-to-end testing of storage provisioning including volume creation, NFS/CIFS configuration

4. **API Integration Validation**: Test all 46+ MCP tools through realistic user scenarios

# Restart demo (rebuilds automatically)

./stop-demo.sh && ./start-demo.sh## Architecture

```

### Components

### Component Development

- Each component is self-contained with clear dependencies- **`index.html`**: Main interface structure with NetApp BlueXP-authentic styling

- Global access via `window.ComponentName` pattern- **`styles.css`**: Complete NetApp design system implementation with proper colors, typography, and layout

- HTML integration through `app.componentName.methodName()`- **`app.js`**: JavaScript application handling MCP API calls and UI interactions

- Consistent error handling and user feedback

## Current Features

### Testing Integration

- All demo functionality validated through real ONTAP API calls### Storage Provisioning Workflow

- No mocking - ensures authentic behavior- **Complete Volume Creation**: End-to-end volume provisioning with NFS and CIFS support

- Cross-browser compatibility testing- **SVM-Dependent Dropdowns**: Smart form controls that populate based on selected cluster and SVM

- Mobile responsiveness validation- **Aggregate Selection**: Automatic aggregate discovery and selection for volume placement

- **Export Policy Management**: NFS export policy assignment with SVM-specific policy discovery

## 🛠️ File Structure- **CIFS Share Configuration**: Complete CIFS/SMB share creation with access control lists

- **Volume Validation**: Client-side validation ensuring ONTAP-compatible naming conventions

```- **Real-time Testing**: Each provisioning step validates multiple MCP HTTP API endpoints

demo/

├── README.md                       # This documentation### CIFS/SMB Integration

├── CHATBOT_README.md              # AI assistant setup and configurationEnhanced CIFS provisioning support includes:

├── CHATBOT_STRUCTURED_FORMAT.md   # ChatGPT integration specifications- **Users/Groups Configuration**: Specify user and group access for CIFS shares

├── index.html                     # Main interface structure- **Permission Levels**: Full control, change, read, or no access permissions  

├── styles.css                     # NetApp BlueXP design system- **Access Control Lists**: Complete ACL configuration with user type support (Windows, Unix users/groups)

├── app.js                         # Main application (499 lines)- **Share Properties**: Optional share comments and advanced CIFS properties

├── chatgpt-config.json.example    # ChatGPT configuration template- **Protocol Switching**: Dynamic form fields that appear only when CIFS is selected

├── js/- **API Compatibility**: Aligns with NetApp ONTAP MCP server schema and ONTAP HTTP API v1/v2

│   ├── core/

│   │   ├── McpApiClient.js        # HTTP transport layer### Cluster Management

│   │   └── utils.js               # Shared utilities- **List Registered Clusters**: Displays all configured ONTAP clusters

│   ├── ui/- **Real-time Data**: Fetches live cluster information via HTTP API

│   │   └── ToastNotifications.js  # User notifications- **Search Functionality**: Filter clusters with expanding search widget

│   └── components/

│       ├── ChatbotAssistant.js    # AI provisioning assistant### Authentication & CORS

│       ├── ProvisioningPanel.js   # Storage provisioning workflow- **Cross-Origin Support**: Properly configured CORS headers for browser compatibility

│       ├── ExportPolicyModal.js   # NFS export policy management- **Environment Configuration**: Clusters pre-loaded via environment variables

│       └── app-initialization.js  # Component initialization

└── test/### User Interface

    ├── README.md                  # Testing documentation- **NetApp BlueXP Styling**: Authentic visual design matching NetApp's interface

    ├── test-api.html              # Interactive API testing- **Responsive Layout**: Proper spacing, typography, and interactive elements

    ├── debug.html                 # Development debugging tools- **Search Widget**: Expandable search functionality with authentic animations

    └── test-intent-detection.js   # Chatbot testing utilities

```## MCP HTTP API Testing Through Provisioning Workflow

### Complete API Coverage
The provisioning workflow comprehensively tests these MCP HTTP endpoints in a realistic sequence:

#### Cluster Discovery Phase
- `POST /api/tools/list_registered_clusters` - Enumerate available clusters
- `POST /api/tools/cluster_list_svms` - Discover SVMs for selected cluster
- `POST /api/tools/cluster_list_aggregates` - Get available aggregates for SVM

#### NFS Configuration Phase  
- `POST /api/tools/list_export_policies` - Enumerate export policies for SVM
- `POST /api/tools/get_export_policy` - Get detailed policy information
- `POST /api/tools/create_export_policy` - Create new policies if needed
- `POST /api/tools/add_export_rule` - Configure NFS access rules

#### Volume Provisioning Phase
- `POST /api/tools/cluster_create_volume` - Create volume with optional CIFS share
- `POST /api/tools/configure_volume_nfs_access` - Apply export policies to volume
- `POST /api/tools/cluster_list_volumes` - Verify volume creation
- `POST /api/tools/get_volume_configuration` - Validate volume settings

#### CIFS Configuration Phase (Optional)
- `POST /api/tools/cluster_create_cifs_share` - Create SMB shares during volume creation
- `POST /api/tools/cluster_list_cifs_shares` - Verify CIFS share creation
- `POST /api/tools/get_cifs_share` - Validate share configuration

### Testing Methodology

#### 1. Prerequisites Setup
```bash
# Quick Start: Use the automated startup script (RECOMMENDED)
cd /Users/ebarron/ONTAP-MCP
./start-demo.sh

# This automatically:
# - Loads all clusters from test/clusters.json
# - Starts MCP HTTP server on port 3000
# - Starts demo web server from demo/ directory on port 8080
# - Validates both servers are working correctly

# Demo will be available at: http://localhost:8080 (no /demo suffix needed!)
```

#### Manual Setup (if needed)
```bash
# Terminal 1: Start MCP HTTP server with test clusters
cd /Users/ebarron/ONTAP-MCP
export ONTAP_CLUSTERS='[{"name":"karan-ontap-1","cluster_ip":"10.196.61.123","username":"admin","password":"netapp1!","description":"Karans hardware system"}]'
node build/index.js --http=3000

# Terminal 2: Start demo web server FROM DEMO DIRECTORY
cd /Users/ebarron/ONTAP-MCP/demo  
python3 -m http.server 8080
```

#### 2. End-to-End Provisioning Test
1. **Navigate to Demo**: Open http://localhost:8080
2. **Select Cluster**: Choose from registered clusters (tests `list_registered_clusters`)
3. **Select SVM**: Choose SVM from dropdown (tests `cluster_list_svms`)
4. **Select Aggregate**: Choose aggregate (tests `cluster_list_aggregates`)
5. **Configure NFS**: Select export policy (tests `list_export_policies`)
6. **Create Volume**: Submit form (tests `cluster_create_volume`, `configure_volume_nfs_access`)
7. **Verify Creation**: Check volume appears in cluster (tests `cluster_list_volumes`)

#### 3. API Validation Points
Each form interaction validates specific API endpoints:
- **Dropdown Population**: Tests list/enumeration APIs
- **Real-time Validation**: Tests configuration validation APIs  
- **Form Submission**: Tests creation/modification APIs
- **Result Verification**: Tests retrieval/status APIs

#### 4. Error Handling Testing
The demo tests error scenarios:
- **Invalid Volume Names**: Client-side validation prevents HTTP 500 errors
- **Missing Dependencies**: SVM-dependent loading prevents invalid configurations
- **Network Failures**: Graceful handling of API timeouts
- **ONTAP Errors**: Proper display of ONTAP-specific error messages

## Advanced Testing Scenarios

### Volume Lifecycle Testing
Test complete volume management through the UI:
```javascript
// Example: Test volume creation with NFS export
const volumeCreation = {
  cluster_name: "karan-ontap-1",
  svm_name: "svm143", 
  volume_name: "test_volume_demo",
  size: "100GB",
  aggregate_name: "aggr1",
  export_policy_name: "mcp-read-only"
};

// This tests multiple APIs in sequence:
// 1. cluster_create_volume
// 2. configure_volume_nfs_access  
// 3. cluster_list_volumes (verification)
```

### CIFS Share Testing
Test SMB share creation during volume provisioning:
```javascript
// Volume with CIFS share creation
const cifsVolumeCreation = {
  cluster_name: "karan-ontap-1",
  svm_name: "svm143",
  volume_name: "cifs_test_volume", 
  size: "200GB",
  cifs_share: {
    share_name: "TestShare",
    access_control: [
      { user_or_group: "Everyone", permission: "full_control" }
    ]
  }
};

// Tests: cluster_create_volume with CIFS + cluster_list_cifs_shares
```

### Policy Management Testing
Test export policy creation and management:
```javascript
// Create custom export policy for testing
const exportPolicyCreation = {
  cluster_name: "karan-ontap-1",
  svm_name: "svm143",
  policy_name: "demo-test-policy",
  comment: "Created via demo interface"
};

// Tests: create_export_policy + add_export_rule + list_export_policies
```

### Error Condition Testing
Test various error scenarios through the UI:
- **Volume Name Validation**: Try invalid characters (spaces, special chars)
- **Missing Dependencies**: Submit form without required fields
- **Duplicate Resources**: Try creating existing volume names
- **Network Timeouts**: Test with unreachable cluster IPs
- **Authentication Failures**: Test with invalid credentials

## Demo Testing Utilities

### Built-in API Testing Tools
The demo includes additional testing utilities:

#### `test/test-api.html`
Direct MCP API testing interface:
- Raw JSON input/output for any MCP tool
- Useful for debugging specific API calls
- Validates tool registration and parameter handling

#### `test/debug.html` 
Development debugging interface:
- Real-time API call logging
- Network request inspection
- Error message debugging

### Example Test Workflows

#### Daily Smoke Test
1. Load demo at http://localhost:8080
2. Verify all clusters load (tests cluster enumeration)
3. Select each cluster and verify SVM loading
4. Create test volume with unique name
5. Verify volume appears in cluster volume list
6. Delete test volume (via API testing tools)

#### Integration Test
1. Create volume with NFS export policy
2. Create volume with CIFS share
3. Test policy modification through demo
4. Verify all configurations via ONTAP CLI
5. Clean up test resources

#### Performance Test  
1. Load demo with multiple clusters configured
2. Rapidly switch between clusters (tests API response times)
3. Submit multiple volume creation requests
4. Monitor API response times in browser dev tools

## Using the Demo for MCP API Testing

### Quick Start Testing Guide

#### 1. Basic Setup
```bash
# Ensure MCP server is built
npm run build

# Start MCP HTTP server with your clusters
export ONTAP_CLUSTERS='[{"name":"your-cluster","cluster_ip":"10.x.x.x","username":"admin","password":"yourpass","description":"Test cluster"}]'
node build/index.js --http=3000

# Start demo server
cd demo && python3 -m http.server 8080
```

#### 2. Storage Provisioning Test
1. **Open Demo**: Navigate to http://localhost:8080
2. **Click "Provision Storage"**: Opens the provisioning interface
3. **Select Cluster**: Choose from dropdown (validates cluster connectivity)
4. **Select SVM**: Choose SVM (tests SVM enumeration API)
5. **Configure Volume**:
   - Name: `demo_test_vol_001` (tests volume naming validation)
   - Size: `100GB` 
   - Aggregate: Select from dropdown (tests aggregate enumeration)
6. **Configure NFS** (Optional):
   - Export Policy: Select existing or create new
   - Tests export policy APIs
7. **Configure CIFS** (Optional):
   - Share Name: `DemoShare`
   - Access Control: Configure user permissions
   - Tests CIFS share creation APIs
8. **Submit**: Creates volume and validates all configurations

#### 3. Verification Steps
1. **Check Volume Creation**: Volume should appear in cluster volume list
2. **Verify NFS Config**: Export policy should be applied correctly
3. **Verify CIFS Config**: CIFS share should be accessible (if configured)
4. **API Logs**: Check browser dev tools for API call details

### Comprehensive API Testing Workflow

The provisioning workflow tests these MCP tools in realistic sequence:

#### Phase 1: Discovery (Dropdown Population)
```
list_registered_clusters → cluster_list_svms → cluster_list_aggregates → list_export_policies
```

#### Phase 2: Configuration Validation  
```
get_export_policy → create_export_policy (if needed) → add_export_rule (if needed)
```

#### Phase 3: Provisioning
```
cluster_create_volume → configure_volume_nfs_access → cluster_create_cifs_share (if CIFS)
```

#### Phase 4: Verification
```
cluster_list_volumes → get_volume_configuration → cluster_list_cifs_shares (if CIFS)
```

## MCP Server Integration

The demo connects to the MCP server using its HTTP API at `http://localhost:3000`. The provisioning workflow integrates these MCP tools:

### Core Infrastructure Tools
- `list_registered_clusters` - Load all registered clusters
- `cluster_list_svms` - Get SVMs for cluster selection
- `cluster_list_aggregates` - Get aggregates for volume placement
- `cluster_list_volumes` - List and verify volumes

### NFS/Export Policy Tools
- `list_export_policies` - Enumerate available export policies
- `get_export_policy` - Get detailed policy configuration
- `create_export_policy` - Create new export policies
- `add_export_rule` - Configure NFS access rules
- `configure_volume_nfs_access` - Apply export policies to volumes

### CIFS/SMB Tools  
- `cluster_create_cifs_share` - Create SMB shares
- `cluster_list_cifs_shares` - List CIFS shares
- `get_cifs_share` - Get detailed share configuration
- `update_cifs_share` - Modify share properties

### Volume Management Tools
- `cluster_create_volume` - Create volumes with optional CIFS integration
- `get_volume_configuration` - Validate volume settings
- `resize_volume` - Modify volume size
- `cluster_offline_volume` - Take volumes offline
- `cluster_delete_volume` - Remove volumes

## Architecture

```
Browser (Demo UI) ←→ HTTP Server (port 8080) ←→ MCP Server (port 3000) ←→ ONTAP Clusters
```

- **Demo UI**: HTML/CSS/JavaScript interface
- **HTTP Server**: Serves static demo files
- **MCP Server**: Provides ONTAP management tools via HTTP API
- **ONTAP Clusters**: Target NetApp storage systems

## Troubleshooting

### CORS Issues
If you see CORS errors in the browser console, ensure:
1. The MCP server is running in HTTP mode: `node build/index.js --http=3000`
2. The demo is accessed via HTTP server (not file://)
3. Both servers are running on localhost

### Connection Errors
If cluster operations fail:
1. Verify ONTAP cluster credentials in ONTAP_CLUSTERS environment variable
2. Check network connectivity to the cluster
3. Ensure the cluster IP/FQDN is correct
4. Verify ONTAP HTTP API is enabled

### Volume Creation Failures
If volume provisioning fails:
1. **Invalid Names**: Ensure volume names use only alphanumeric and underscores
2. **Duplicate Names**: Volume names must be unique within the SVM
3. **Aggregate Space**: Verify selected aggregate has sufficient free space
4. **SVM Configuration**: Ensure SVM supports the requested protocols (NFS/CIFS)

### Export Policy Issues
If NFS export policies don't populate:
1. **SVM Selection**: Export policies are SVM-specific, select SVM first
2. **Policy Creation**: Create policies via ONTAP CLI if none exist
3. **Demo Fallback**: Demo provides fallback policies if none found

### Demo Server Issues
If the startup script fails:
1. **Permission Issues**: Ensure scripts are executable: `chmod +x start-demo.sh stop-demo.sh`
2. **Port Conflicts**: Check for existing processes: `lsof -i :3000` and `lsof -i :8080`
3. **Wrong Directory**: Script must be run from ONTAP-MCP root directory
4. **Missing Files**: Ensure `test/clusters.json` and `demo/` directory exist
5. **Build Failures**: Check TypeScript compilation: `npm run build`

### URL Path Issues  
If you see a directory listing instead of the demo:
1. **Wrong Server Directory**: Use `./start-demo.sh` (starts from demo/ directory automatically)
2. **Manual Start**: If starting manually, ensure: `cd demo && python3 -m http.server 8080`
3. **Correct URL**: Should be `http://localhost:8080` (no /demo suffix needed)

### Cluster Configuration Issues
If clusters don't appear in demo:
1. **Missing Clusters**: Startup script loads from `test/clusters.json` automatically
2. **Invalid JSON**: Validate `test/clusters.json` syntax with `node -e "JSON.parse(require('fs').readFileSync('test/clusters.json'))"`
3. **Environment Variables**: Startup script handles this automatically
4. **Manual Setup**: Must export ONTAP_CLUSTERS with proper JSON array format

### API Testing Failures
If specific API calls fail:
1. **Tool Registration**: Verify tool is registered in both STDIO and HTTP modes
2. **Parameter Validation**: Check required parameters are provided correctly
3. **Authentication**: Verify cluster credentials are correct
4. **Network**: Test direct curl calls to isolate browser vs server issues

### Example Debugging Commands
```bash
# Test MCP server health
curl -s http://localhost:3000/health

# Test cluster enumeration
curl -s -X POST http://localhost:3000/api/tools/list_registered_clusters \
  -H "Content-Type: application/json" -d '{}'

# Test volume creation directly
curl -s -X POST http://localhost:3000/api/tools/cluster_create_volume \
  -H "Content-Type: application/json" \
  -d '{"cluster_name":"karan-ontap-1","svm_name":"svm143","volume_name":"test_vol","size":"100GB"}'

# Verify volume was created
curl -s -X POST http://localhost:3000/api/tools/cluster_list_volumes \
  -H "Content-Type: application/json" \
  -d '{"cluster_name":"karan-ontap-1","svm_name":"svm143"}'
```

## Files

### Core Demo Files
- **`index.html`** - Main demo interface structure with provisioning workflow UI
- **`styles.css`** - Complete NetApp BlueXP styling and responsive layout  
- **`app.js`** - JavaScript functionality with comprehensive MCP API integration
- **`README.md`** - This comprehensive documentation

### Testing Utilities
- **`test/test-api.html`** - Direct MCP API testing interface for individual tool validation
- **`test/debug.html`** - Development debugging interface with real-time API logging  
- **`test/debug-test.html`** - Enhanced debugging with network inspection tools

### Demo Testing Directory (`test/`)
- **`test-intent-detection.js`** - Chatbot intent detection and structured recommendation parsing tests
- **`README.md`** - Demo testing documentation and usage instructions
- **`run-demo-tests.sh`** - Automated test runner for all demo functionality tests

**Run Demo Tests:**
```bash
# From project root
./demo/test/run-demo-tests.sh
# or individually
node demo/test/test-intent-detection.js
```

### Reference Materials
- **`existingPage/`** - Original NetApp BlueXP design reference files
- **`ProvionNFSPage/`** - Additional NetApp interface patterns and styling

## Comprehensive Testing Checklist

### Pre-Test Setup ✓
- [ ] MCP server built: `npm run build`
- [ ] ONTAP_CLUSTERS environment variable configured
- [ ] MCP HTTP server running on port 3000
- [ ] Demo HTTP server running on port 8080 from demo directory
- [ ] Demo loads at http://localhost:8080 without errors

### Basic API Connectivity ✓
- [ ] Cluster enumeration works (clusters appear in main table)
- [ ] Search functionality works (can filter clusters)
- [ ] Health check passes: `curl http://localhost:3000/health`
- [ ] Basic MCP call succeeds: `list_registered_clusters`

### Provisioning Workflow Testing ✓

#### Phase 1: Discovery APIs
- [ ] Click "Provision Storage" - form appears
- [ ] Cluster dropdown populates from `list_registered_clusters`
- [ ] Select cluster - SVM dropdown populates from `cluster_list_svms`  
- [ ] Select SVM - aggregates populate from `cluster_list_aggregates`
- [ ] Select SVM - export policies populate from `list_export_policies`

#### Phase 2: Form Validation
- [ ] Volume name validation prevents invalid characters
- [ ] Size field accepts valid ONTAP size formats (100GB, 1TB, etc.)
- [ ] Required fields prevent form submission when empty
- [ ] SVM-dependent fields reset when SVM changes

#### Phase 3: Volume Creation
- [ ] NFS-only volume creation succeeds
- [ ] Volume with export policy assignment succeeds
- [ ] CIFS volume creation with share succeeds
- [ ] Dual-protocol (NFS+CIFS) volume succeeds

#### Phase 4: Verification
- [ ] Created volume appears in cluster volume list
- [ ] Volume configuration matches submitted parameters
- [ ] NFS export policy correctly applied
- [ ] CIFS share created with correct permissions (if applicable)

### Error Condition Testing ✓
- [ ] Invalid volume name shows client-side validation error
- [ ] Missing required fields prevent submission
- [ ] Network timeout handled gracefully
- [ ] Invalid cluster credentials show appropriate error
- [ ] Duplicate volume name handled correctly

### Browser Compatibility ✓
- [ ] Chrome/Safari/Firefox all load demo correctly
- [ ] JavaScript functions work across browsers
- [ ] CSS layout renders correctly on different screen sizes
- [ ] No console errors in any supported browser

### API Integration Validation ✓
- [ ] All 20+ provisioning-related MCP tools tested
- [ ] HTTP vs STDIO mode consistency verified
- [ ] CORS headers allow browser access
- [ ] Response parsing handles all expected formats
- [ ] Error responses formatted correctly for UI display

### Performance Testing ✓  
- [ ] Demo loads quickly (<3 seconds with local servers)
- [ ] API calls complete within reasonable time (<10 seconds)
- [ ] Multiple rapid form submissions handled correctly
- [ ] Large cluster lists (10+ clusters) display properly
- [ ] Simultaneous user sessions don't interfere

### Documentation Verification ✓
- [ ] README instructions accurate for current demo version
- [ ] Setup commands work as documented
- [ ] Troubleshooting section covers encountered issues
- [ ] Code examples reflect actual implementation
- [ ] API endpoint documentation matches implementation

This checklist ensures comprehensive validation of the MCP HTTP API through realistic storage provisioning workflows.

## Development

### Extending the Demo

To modify or extend the demo for additional API testing:

#### 1. Adding New MCP Tools
```javascript
// In app.js, add new API call function
async function callNewTool(params) {
    const response = await fetch(`http://localhost:3000/api/tools/new_tool_name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    // Handle response...
}

// Integrate into UI workflow
document.getElementById('newButton').addEventListener('click', async () => {
    const result = await callNewTool({param1: 'value1'});
    updateUI(result);
});
```

#### 2. Adding New Test Scenarios
```javascript
// Create new test functions for specific workflows
async function testSnapshotWorkflow() {
    // Test snapshot policy creation, assignment, and verification
    const policies = await callMcp('list_snapshot_policies', {cluster_name: 'test'});
    const creation = await callMcp('create_snapshot_policy', {...});
    const verification = await callMcp('get_snapshot_policy', {...});
    // Validate results...
}
```

#### 3. Enhancing Validation
```javascript
// Add comprehensive validation functions
function validateVolumeCreation(response) {
    // Check for expected volume properties
    // Validate ONTAP-specific configurations
    // Return detailed validation results
}
```

### Testing New Features

#### 1. HTML Structure Changes
Edit `index.html` for:
- New form fields for additional MCP tool parameters
- Additional UI sections for new testing workflows
- Enhanced validation feedback displays

#### 2. Styling Updates
Modify `styles.css` for:
- New form elements using NetApp design variables
- Additional responsive layouts
- Enhanced error/success state styling

#### 3. JavaScript Functionality
Update `app.js` for:
- New MCP tool integration functions
- Enhanced error handling and validation
- Additional testing workflow orchestration

### API Testing Patterns

#### Standard MCP Call Pattern
```javascript
async function callMcp(toolName, params = {}) {
    try {
        const response = await fetch(`http://localhost:3000/api/tools/${toolName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');
    } catch (error) {
        console.error(`MCP call failed for ${toolName}:`, error);
        throw error;
    }
}
```

#### Validation Pattern
```javascript
function validateMcpResponse(response, expectedFields) {
    const validation = {
        success: true,
        errors: [],
        warnings: []
    };
    
    // Check for expected content
    expectedFields.forEach(field => {
        if (!response.includes(field)) {
            validation.errors.push(`Missing expected field: ${field}`);
            validation.success = false;
        }
    });
    
    return validation;
}
```

#### Error Handling Pattern
```javascript
function handleMcpError(error, context) {
    const errorInfo = {
        context: context,
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
    };
    
    // Log for debugging
    console.error('MCP Error:', errorInfo);
    
    // Display user-friendly message
    displayErrorMessage(`Operation failed: ${context}. Please check console for details.`);
    
    // Return structured error for testing validation
    return errorInfo;
}
```

The demo uses modern JavaScript (ES6+) and CSS Grid/Flexbox for responsive design, following NetApp BlueXP design patterns for authentic integration testing.