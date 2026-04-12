# Barcode Advanced Features

## Delete All Barcodes
- **Button:** 🗑️ Delete All Barcodes (red)
- **Purpose:** Delete all barcode files and clear barcode field from all items
- **API Endpoint:** POST `/api/delete-all-barcodes`
- **Requires:** Login (admin or user)
- **Warning:** Cannot be undone - prompts for confirmation

## Generate Barcodes with Prefixes
- **Button:** ✏️ Generate with Prefixes (blue)
- **Purpose:** Generate barcodes for specific categories with custom prefixes
- **API Endpoint:** POST `/api/generate-all-barcodes`
- **Body:** `{ "category_prefixes": { "category": "prefix" } }`
- **Format:** One prefix per line: `category_name,prefix`
- **Examples:**
  - `art,art` → barcodes start with "art_"
  - `Knives,knives` → barcodes start with "knives_"
  - `Olight,olight` → barcodes start with "olight_"
  - `OL,ol` → barcodes start with "ol_"
  - `Switch games,sw` → barcodes start with "sw_"
  - `SW,sw` → barcodes start with "sw_"

## Usage Workflow
1. Click **🗑️ Delete All Barcodes** to remove existing barcodes
2. Click **✏️ Generate with Prefixes** to add new ones
3. Enter prefixes in format: `category_name,prefix`
4. Confirm and wait for generation
5. Items automatically reload with new barcodes

## Technical Notes
- Barcode format: `prefix_serialnumber` (e.g., `art_ABC123XYZ`)
- Only generates for items without existing barcodes
- Can generate for all items or specific categories
- If no category prefix specified, uses serial number only
