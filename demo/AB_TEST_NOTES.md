# A/B Test: Prompt Efficiency Enhancement

## Test Purpose
Reduce excessive ChatGPT API calls that are causing 429 rate limit errors.

## Problem Statement  
- **Before**: ChatGPT making 20+ API calls, 33 tool calls (list_snapshot_policies), hitting rate limits
- **Target**: Reduce to 5-8 ChatGPT API calls, max 8 tool calls total

## Files Changed
- `CHATBOT_SYSTEM_PROMPT.md` - Enhanced with efficiency constraints
- `CHATBOT_SYSTEM_PROMPT.old` - Original prompt backup
- `ChatbotAssistant.js` - Added budget tracking logs

## Key Changes Made

### 1. Tool Call Budget (8 calls max)
- Explicit constraint at top of prompt
- Forces strategic thinking over exhaustive exploration
- JavaScript logging to track budget usage

### 2. Conversation Memory Rules
- Instructions to track what's already known
- Prevent redundant calls for same information

### 3. Efficient Workflow Phases
- Phase 1: Quick elimination (calls 1-2)
- Phase 2: Targeted filtering (calls 3-5)  
- Phase 3: Final selection (calls 6-8)

### 4. Forbidden Patterns
- No simultaneous calling same tool on all clusters
- No investigating eliminated clusters
- No "just to be sure" calls

### 5. Smart Investigation Strategy
- Target most promising clusters first
- Eliminate immediately if missing required policies
- Stop when good option found

## Testing Instructions

### Original Prompt Test:
```bash
cp CHATBOT_SYSTEM_PROMPT.old CHATBOT_SYSTEM_PROMPT.md
# Test with demo interface
# Record: API calls, tool calls, rate limit errors
```

### Enhanced Prompt Test:  
```bash
cp CHATBOT_SYSTEM_PROMPT.new CHATBOT_SYSTEM_PROMPT.md  # (if we create this)
# Test with demo interface
# Record: API calls, tool calls, rate limit errors
```

## Success Metrics
- **Primary**: Reduce ChatGPT API calls from 20+ to <8
- **Secondary**: Maintain recommendation quality
- **Tertiary**: Eliminate 429 rate limit errors

## Test Scenarios
1. **Hospital EDR Storage Class** - Complex scenario requiring policy validation
2. **Basic Volume Request** - Simple scenario for baseline comparison
3. **CIFS Share Request** - Protocol-specific scenario

## Expected Results
- 60-80% reduction in API calls
- Faster response times  
- No rate limiting errors
- Maintained recommendation accuracy