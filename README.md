# Inventory Management System

A simple web-based inventory system for tracking items with descriptions, serial numbers, quantities, and costs.

## Features

- ✅ Add, edit, and delete inventory items
- 🔍 Search by description or serial number
- 📊 View total inventory count and value
- 💾 SQLite database (file-based, no setup required)
- 🎨 Clean, responsive web interface

## Requirements

- Python 3.8 or higher

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Start the server:
```bash
python app.py
```

3. Open your browser to:
```
http://localhost:5000
```

## Usage

### Adding Items
1. Fill in the item details (description, serial number, quantity, cost)
2. Click "Add Item"

### Editing Items
1. Click the "Edit" button on any item
2. Modify the details
3. Click "Update Item"

### Deleting Items
1. Click the "Delete" button on any item
2. Confirm the deletion

### Searching
- Use the search box to filter items by description or serial number

## Database

The system uses SQLite (`inventory.db`) which is created automatically on first run.

Database schema:
```sql
CREATE TABLE inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    serial_number TEXT UNIQUE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

## Stopping the Server

Press `Ctrl+C` in the terminal to stop the server.
