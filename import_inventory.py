#!/usr/bin/env python3
"""
Clear database and import inventory from Excel file
"""

import sqlite3
import pandas as pd
import os

DATABASE = 'inventory.db'
EXCEL_FILE = "/Users/dhively/Documents/Consignor Access - Home.xlsx"

def clear_and_import():
    """Clear all inventory items and import from Excel"""

    try:
        # Read Excel file
        print(f"📖 Reading Excel file: {EXCEL_FILE}")
        df = pd.read_excel(EXCEL_FILE, header=0)

        # Rename columns (first row contains headers)
        df.columns = ['description', 'cost']

        # Remove any rows where description is 'Item' (header row) or empty
        df = df[df['description'] != 'Item']
        df = df[df['description'].notna()]
        df = df[df['description'].str.strip() != '']

        # Clean cost values - ensure they're numeric
        df['cost'] = pd.to_numeric(df['cost'], errors='coerce').fillna(0.0)

        print(f"✅ Found {len(df)} valid items in Excel file")
        print(f"\n📋 Sample data:")
        print(df.head(10))

        # Connect to database
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()

        # Check current state
        cursor.execute('SELECT COUNT(*) FROM inventory')
        current_count = cursor.fetchone()[0]
        print(f"\n📊 Current database has {current_count} items")

        if current_count > 0:
            # Ask for confirmation
            response = input(f"\n⚠️  This will DELETE all {current_count} items and import {len(df)} new items. Continue? (yes/no): ")
            if response.lower() not in ['yes', 'y']:
                print("❌ Import cancelled")
                conn.close()
                return

        # Clear all inventory items
        print("\n🗑️  Clearing all inventory items...")
        cursor.execute('DELETE FROM inventory')
        cleared = cursor.rowcount
        print(f"✅ Cleared {cleared} items")

        # Import items from Excel
        print(f"\n📥 Importing {len(df)} items from Excel...")

        imported_count = 0
        skipped_count = 0

        for idx, row in df.iterrows():
            description = str(row['description']).strip()
            cost = float(row['cost'])

            # Skip if description is empty
            if not description or description.lower() == 'nan':
                skipped_count += 1
                continue

            # Generate serial number from description
            # Replace spaces and special chars with underscore, truncate to 50 chars
            serial_number = description.lower()
            serial_number = ''.join(c if c.isalnum() else '_' for c in serial_number)
            serial_number = serial_number[:50]

            # Ensure serial number is unique
            counter = 1
            base_serial = serial_number
            while True:
                cursor.execute('SELECT id FROM inventory WHERE serial_number = ?', (serial_number,))
                if not cursor.fetchone():
                    break
                serial_number = f"{base_serial[:45]}_{counter}"
                counter += 1

            # Set default values
            quantity = 1  # Default to 1 item

            # Try to determine category from description or set to "General"
            category = "General"  # Default category

            # Insert item
            try:
                cursor.execute('''
                    INSERT INTO inventory (description, serial_number, category, quantity, cost)
                    VALUES (?, ?, ?, ?, ?)
                ''', (description, serial_number, category, quantity, cost))
                imported_count += 1

                if imported_count % 50 == 0:
                    print(f"   Imported {imported_count} items...")

            except sqlite3.IntegrityError as e:
                print(f"⚠️  Skipped duplicate: {description} - {e}")
                skipped_count += 1

        conn.commit()

        # Verify import
        cursor.execute('SELECT COUNT(*) FROM inventory')
        final_count = cursor.fetchone()[0]

        cursor.execute('SELECT SUM(quantity * cost) FROM inventory')
        total_value = cursor.fetchone()[0] or 0

        cursor.execute('SELECT category, COUNT(*) as count, SUM(quantity * cost) as value FROM inventory GROUP BY category ORDER BY category')
        category_stats = cursor.fetchall()

        print(f"\n✅ Import complete!")
        print(f"📊 Successfully imported: {imported_count} items")
        print(f"⚠️  Skipped: {skipped_count} items")
        print(f"📈 Total items in database: {final_count}")
        print(f"💰 Total inventory value: ${total_value:,.2f}")

        if category_stats:
            print(f"\n📋 Breakdown by category:")
            for cat, count, value in category_stats:
                print(f"   {cat}: {count} items, ${value:,.2f}")

        conn.close()
        print(f"\n✅ Database updated successfully!")

        return True

    except FileNotFoundError:
        print(f"❌ Error: Excel file not found at {EXCEL_FILE}")
        return False
    except Exception as e:
        print(f"❌ Error during import: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    clear_and_import()
