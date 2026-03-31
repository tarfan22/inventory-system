#!/usr/bin/env python3
"""
Update quantities for all items in a category
"""

import sqlite3

DATABASE = 'inventory.db'
CATEGORY = 'Art'
NEW_QUANTITY = 0

def update_quantities():
    """Update quantities for all items in the Art category"""

    try:
        # Connect to database
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        # Check current state
        cursor.execute('SELECT COUNT(*) FROM inventory WHERE category = ?', (CATEGORY,))
        total_items = cursor.fetchone()[0]

        cursor.execute('SELECT SUM(quantity) FROM inventory WHERE category = ?', (CATEGORY,))
        total_quantity = cursor.fetchone()[0] or 0

        print(f"Found {total_items} items in '{CATEGORY}' category")
        print(f"Total current quantity: {total_quantity}")

        # Update quantities
        cursor.execute('''
            UPDATE inventory
            SET quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE category = ?
        ''', (NEW_QUANTITY, CATEGORY))

        affected_rows = cursor.rowcount
        conn.commit()

        print(f"\n✅ Successfully updated {affected_rows} items")
        print(f"Set quantity to {NEW_QUANTITY} for all '{CATEGORY}' items")

        # Verify the update
        cursor.execute('SELECT COUNT(*) FROM inventory WHERE category = ? AND quantity = ?', (CATEGORY, NEW_QUANTITY))
        verified = cursor.fetchone()[0]
        print(f"Verification: {verified} items now have quantity {NEW_QUANTITY}")

        conn.close()
        return True

    except Exception as e:
        print(f"Error updating quantities: {e}")
        return False

if __name__ == '__main__':
    update_quantities()
