            </div>
        `;
    }
    return '';
}

// Delete all barcodes
async function deleteAllBarcodes() {
    if (!confirm('This will DELETE ALL barcode files and clear the barcode field from all items.\\n\\nThis cannot be undone!\\n\\nContinue?')) {
        return;
    }

    try {
        const response = await fetch('/api/delete-all-barcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            showAlert(`✅ ${result.message}`, 'success');
            // Reload items to reflect changes
            await loadItems();
            // Restore current category filter
            const currentCategory = document.getElementById('categoryFilter').value;
            if (currentCategory !== 'all') {
                filterByCategory();
            }
        } else {
            showAlert('❌ ' + (result.error || 'Error deleting barcodes'), 'error');
        }
    } catch (error) {
        console.error('Delete barcodes error:', error);
        showAlert('❌ Error communicating with server', 'error');
    }
}

// Generate barcodes with custom category prefixes
async function generateBarcodesWithPrefixes() {
    const prefixes = prompt('Enter category prefixes (one per line):\\n\\nExamples:\\nart → art\\nKnives → knives\\nOlight → olight\\nOL → ol\\nSwitch games → sw\\nSW → sw\\n\\n\\nFormat: category_name,prefix\\n(e.g., "art,art")', '');

    if (!prefixes) {
        return;
    }

    // Parse prefixes (format: category,prefix per line)
    const categoryPrefixes = {};
    const lines = prefixes.trim().split('\\n');

    for (const line of lines) {
        const [category, prefix] = line.split(',').map(s => s.trim());
        if (category && prefix) {
            categoryPrefixes[category] = prefix;
        }
    }

    if (Object.keys(categoryPrefixes).length === 0) {
        showAlert('❌ No valid prefixes found. Use format: category,prefix (e.g., "art,art")', 'error');
        return;
    }

    if (!confirm(`Will generate barcodes for items in these categories:\\n\\n${Object.keys(categoryPrefixes).join(', ')}\\n\\nWith prefixes:\\n\\n${Object.entries(categoryPrefixes).map(([cat, pref]) => `${cat} → ${pref}`).join('\\n')}\\n\\nContinue?`)) {
        return;
    }

    try {
        const response = await fetch('/api/generate-all-barcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_prefixes: categoryPrefixes })
        });

        const result = await response.json();

        if (result.success) {
            showAlert(`✅ ${result.message}`, 'success');
            // Reload items to show new barcodes
            await loadItems();
            // Restore current category filter
            const currentCategory = document.getElementById('categoryFilter').value;
            if (currentCategory !== 'all') {
                filterByCategory();
            }
        } else {
            showAlert('❌ ' + (result.error || 'Error generating barcodes'), 'error');
        }
    } catch (error) {
        console.error('Barcode generation with prefixes error:', error);
        showAlert('❌ Error communicating with server', 'error');
    }
}
