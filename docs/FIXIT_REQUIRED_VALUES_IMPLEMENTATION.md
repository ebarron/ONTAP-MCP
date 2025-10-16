# Fix-It Modal: Required Values Implementation

## Problem Statement
When executing corrective actions (e.g., "Modify volume size"), the CLI command showed unfilled placeholders like `{new_size}`, and the execute button would fail because required parameters weren't provided by the user.

## Solution Overview
Implemented a generic "Required Values" section in the Fix-It modal that:
1. **Detects missing parameters** from both CLI commands and MCP tool parameters
2. **Prompts users to enter missing values** via input fields
3. **Validates inputs** before allowing execution
4. **Updates CLI preview** in real-time as users type
5. **Merges user-supplied values** with auto-resolved parameters before MCP tool execution

## Implementation Details

### 1. HTML Structure Enhancement
Added a new "Required Values" section in the modal between the "Corrective Action" description and the CLI command:

```html
<!-- Required Values Section (for user-supplied parameters) -->
<div id="fixItModalRequiredValues" class="modal-required-values" style="display: none;">
    <h4>Required Values:</h4>
    <div id="fixItModalRequiredValuesContent" class="required-values-content">
        <!-- Required input fields will be injected here -->
    </div>
</div>
```

### 2. CSS Styling
Added yellow-highlighted styling for the required values section:
- Background: `#fff9e6` (light yellow)
- Border: `#ffcc00` (golden yellow)
- Heading color: `#996600` (dark yellow/brown)
- Input fields with focus states and error highlighting

### 3. Parameter Detection Logic

#### `detectMissingParameters(action, alert, resolvedParams)`
Scans two sources for missing parameters:

1. **MCP tool parameters** (`action.mcp_params`):
   - Checks if values are placeholders (e.g., `{new_size}`)
   - Verifies if the value exists in `resolvedParams`

2. **CLI command placeholders**:
   - Uses regex `/\{([^}]+)\}/g` to find all `{placeholder}` patterns
   - Checks if values exist in `resolvedParams` or `alert.labels`

Returns array of missing parameters with:
- `key`: Parameter name for the MCP tool
- `placeholder`: Original placeholder name from CLI command
- `label`: Human-readable label (formatted from snake_case)
- `description`: Help text for the user

#### `formatParameterLabel(paramName)`
Converts technical parameter names to user-friendly labels:
- `new_size` → "New Size"
- `grow_threshold_percent` → "Grow Threshold Percent"
- `maximum_size` → "Maximum Size"

#### `getParameterDescription(paramName, action)`
Provides contextual help text for common parameters:
- `new_size`: "New size for the volume (e.g., 100GB, 1TB)"
- `grow_threshold_percent`: "Percentage full to trigger growth (e.g., 85)"
- `maximum_size`: "Maximum size limit (e.g., 500GB, 2TB)"

### 4. Dynamic UI Rendering

#### `renderRequiredValues(missingParams)`
- Creates input fields for each missing parameter
- Adds event listeners to update CLI preview and validate on input
- Shows/hides the section based on whether parameters are missing

Example output for `new_size`:
```html
<div class="required-value-item">
    <label class="required-value-label" for="required_new_size">
        New Size:
    </label>
    <input 
        type="text" 
        id="required_new_size" 
        class="required-value-input" 
        placeholder="New size for the volume (e.g., 100GB, 1TB)"
        data-param-key="new_size"
        data-param-placeholder="new_size"
    />
</div>
```

### 5. Real-Time CLI Preview Updates

#### `updateCliCommandPreview()`
- Triggered on every input change
- Collects values from all input fields
- Merges with auto-resolved parameters
- Updates the CLI command display in real-time
- Replaces placeholders like `{new_size}` with actual user input

Example flow:
1. User types "200GB" in the "New Size" field
2. CLI command updates from: `volume modify -vserver vs0 -volume full_vol_1 -size {new_size}`
3. To: `volume modify -vserver vs0 -volume full_vol_1 -size 200GB`

### 6. Input Validation

#### `validateRequiredValues()`
- Checks if all input fields have values
- Adds `.error` class to empty fields (red border)
- Enables/disables the "Execute" button based on validation
- Returns `true` if all values are provided, `false` otherwise

Button state management:
- **Invalid**: `opacity: 0.5`, `cursor: not-allowed`, `disabled: true`
- **Valid**: `opacity: 1`, `cursor: pointer`, `disabled: false`

### 7. Execution Flow

#### Updated `execute()` method:
1. **Validate required values** - If any are missing, show error toast and abort
2. **Collect user-supplied values** - Read from input fields
3. **Merge with resolved params** - Create `finalParams` object
4. **Log parameters** - Console output for debugging
5. **Execute MCP tool** - Pass `finalParams` instead of `resolvedParams`
6. **Capture state** - For undo functionality (uses `finalParams`)

Example parameter merging:
```javascript
const finalParams = { ...this.resolvedParams };

// User typed "200GB" in new_size field
finalParams.new_size = "200GB";

// Final params sent to MCP tool:
{
    cluster_name: "ontap-cluster1",
    volume_uuid: "abc-123",
    new_size: "200GB"  // User-supplied value
}
```

### 8. Modal Cleanup

#### Updated `close()` method:
- Clears `this.missingParams`
- Hides required values section
- Resets execute button state
- Removes error highlighting from inputs

## Usage Examples

### Example 1: Volume Resize
**Alert**: Volume full_vol_1 is full (95% used)

**Corrective Action**: Modify volume size

**CLI Command**: `volume modify -vserver vs0 -volume full_vol_1 -size {new_size}`

**Required Values Prompt**:
- Label: "New Size"
- Placeholder: "New size for the volume (e.g., 100GB, 1TB)"
- User enters: "500GB"

**Final CLI Command**: `volume modify -vserver vs0 -volume full_vol_1 -size 500GB`

**MCP Tool Call**: `cluster_update_volume({ cluster_name: "ontap-cluster1", volume_uuid: "abc-123", new_size: "500GB" })`

### Example 2: Enable Autosize
**CLI Command**: `volume autosize -vserver vs0 -volume full_vol_1 -mode grow -maximum-size {maximum_size} -grow-threshold {grow_threshold}`

**Required Values Prompts**:
1. Label: "Maximum Size"
   - User enters: "1TB"
2. Label: "Grow Threshold"
   - User enters: "85"

**Final CLI Command**: `volume autosize -vserver vs0 -volume full_vol_1 -mode grow -maximum-size 1TB -grow-threshold 85`

## Benefits

1. **Generic Solution**: Works for any corrective action with missing parameters
2. **User Guidance**: Clear labels and help text guide users
3. **Real-time Feedback**: CLI preview updates as users type
4. **Input Validation**: Prevents execution with incomplete data
5. **Better UX**: Yellow highlighting makes required values stand out
6. **No Hardcoding**: Automatically detects missing parameters from action definitions

## Testing Checklist

- [ ] Modal shows "Required Values" section when parameters are missing
- [ ] Input fields render with correct labels and placeholders
- [ ] CLI command preview updates in real-time
- [ ] Execute button is disabled until all values are entered
- [ ] Empty fields show error styling (red border)
- [ ] User-supplied values are included in MCP tool call
- [ ] Values are merged correctly with auto-resolved parameters
- [ ] Modal clears required values section on close
- [ ] Multiple missing parameters are handled correctly
- [ ] Toast notification shows when trying to execute with missing values

## Files Modified

1. `/Users/ebarron/ONTAP-MCP/demo/js/components/FixItModal.js`
   - Added HTML structure for required values section
   - Added CSS styling for yellow-highlighted section
   - Added `detectMissingParameters()` method
   - Added `formatParameterLabel()` method
   - Added `getParameterDescription()` method
   - Added `renderRequiredValues()` method
   - Added `updateCliCommandPreview()` method
   - Added `validateRequiredValues()` method
   - Updated `show()` method to detect and render missing parameters
   - Updated `execute()` method to validate, collect, and merge user values
   - Updated `close()` method to clean up required values state
