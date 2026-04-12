// Inventory Management System - Frontend JavaScript

let currentEditId = null;
let allItems = [];
let currentImagePath = null;

// Check authentication on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthentication();
    loadItems();
    handleNavigation();
    setupEventListeners();
});

async function checkAuthentication() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();

        if (!data.authenticated) {
            // Redirect to login if not authenticated
            window.location.href = '/login';
            return false;
        }

        // Update UI with current user
        const currentUserElement = document.getElementById('currentUser');
        if (currentUserElement) {
            currentUserElement.textContent = data.username;
        }

        // Check if user is admin and show/hide Users link
        try {
            const userPermsResponse = await fetch('/api/user/permissions');
            const userData = await userPermsResponse.json();

            if (userData.is_admin) {
                const usersLink = document.getElementById('usersLink');
                if (usersLink) {
                    usersLink.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error checking user permissions:', error);
        }

        return true;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
        return false;
    }
}

async function logout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    try {
        const response = await fetch('/api/logout', {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            window.location.href = '/login';
        } else {
            showAlert('Error logging out', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showAlert('Error communicating with server', 'error');
    }
}

// Handle navigation
function handleNavigation() {
    // Check current URL path
    const path = window.location.pathname;

    // Always show home page by default
    showPage('home');
}

function showPage(pageName) {
    console.log('Showing page:', pageName);

    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected page
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
    } else {
        console.error('Page not found:', pageName + 'Page');
    }

    // Set active nav link
    const activeLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Load page-specific data
    if (pageName === 'categories') {
        loadCategoriesPage();
    } else if (pageName === 'users') {
        loadUsersPage();
    }
}

function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    navMenu.classList.toggle('active');
}

function setupEventListeners() {
    // Form submission
    document.getElementById('itemForm').addEventListener('submit', handleFormSubmit);

    // Cancel button
    document.getElementById('cancelBtn').addEventListener('click', resetForm);

    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Close modals when clicking outside
    document.getElementById('categoryMenu').addEventListener('click', (e) => {
        if (e.target.id === 'categoryMenu') {
            hideCategoryMenu();
        }
    });

    document.getElementById('addCategoryModal').addEventListener('click', (e) => {
        if (e.target.id === 'addCategoryModal') {
            hideAddCategoryModal();
        }
    });

    document.getElementById('changePasswordModal').addEventListener('click', (e) => {
        if (e.target.id === 'changePasswordModal') {
            hideChangePasswordModal();
        }
    });

    document.getElementById('addUserModal').addEventListener('click', (e) => {
        if (e.target.id === 'addUserModal') {
            hideAddUserModal();
        }
    });

    document.getElementById('editUserModal').addEventListener('click', (e) => {
        if (e.target.id === 'editUserModal') {
            hideEditUserModal();
        }
    });
}

async function loadItems() {
    try {
        console.log('Loading items...');

        // Load items
        const itemsResponse = await fetch('/api/items');
        allItems = await itemsResponse.json();
        console.log('Items loaded:', allItems.length);

        // Load categories separately
        const categoriesResponse = await fetch('/api/categories');
        const categories = await categoriesResponse.json();
        console.log('Categories loaded:', categories);

        populateCategoryDropdowns(categories);
        // Don't display items on initial load - wait for category selection
        displayEmptyState();
        updateSummary();
    } catch (error) {
        console.error('Error loading items:', error);
        showAlert('Error loading items', 'error');
    }
}

function populateCategoryDropdowns(categories) {
    // Populate filter dropdown
    const filterSelect = document.getElementById('categoryFilter');
    if (filterSelect) {
        const currentValue = filterSelect.value;
        filterSelect.innerHTML = '<option value="all">📋 Select a category...</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filterSelect.appendChild(option);
        });
        // Reset to "select a category" unless there's a valid selection
        if (categories.includes(currentValue)) {
            filterSelect.value = currentValue;
        } else {
            filterSelect.value = 'all';
        }
    }

    // Populate form category dropdown
    const formSelect = document.getElementById('categorySelect');
    if (formSelect && formSelect.tagName === 'SELECT') {
        const currentFormValue = document.getElementById('category').value;
        formSelect.innerHTML = '<option value="">-- Select or Type New Category --</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            formSelect.appendChild(option);
        });
        // Set value if category was already selected
        if (currentFormValue && categories.includes(currentFormValue)) {
            formSelect.value = currentFormValue;
        }
    }
}

function handleCategoryChange() {
    const select = document.getElementById('categorySelect');
    const input = document.getElementById('category');

    if (select.value) {
        input.value = select.value;
    }
}

function handleCategoryInput() {
    const select = document.getElementById('categorySelect');
    const input = document.getElementById('category');

    // Clear dropdown if user types something different
    if (input.value && input.value !== select.value) {
        select.value = '';
    }
}

function populateCategoryDropdown() {
    // Get unique categories
    const categories = [...new Set(allItems.map(item => item.category || 'Uncategorized'))];

    // Sort categories alphabetically
    categories.sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    // Populate dropdown
    const select = document.getElementById('categorySelect');
    select.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
}

function filterByCategory() {
    const selectedCategory = document.getElementById('categoryFilter').value;

    if (selectedCategory === 'all') {
        displayEmptyState();
    } else {
        const filtered = allItems.filter(item =>
            (item.category || 'Uncategorized') === selectedCategory
        );
        displayItems(filtered);
    }

    // Clear search when filtering by category
    document.getElementById('searchInput').value = '';
}

function showCategoryMenu() {
    const modal = document.getElementById('categoryMenu');
    const categoryList = document.getElementById('categoryList');

    // Get unique categories with counts
    const categoryCounts = {};
    allItems.forEach(item => {
        const category = item.category || 'Uncategorized';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Sort categories
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    // Get category emoji
    const getCategoryEmoji = (category) => {
        if (category === 'Uncategorized') return '📦';
        if (category.toLowerCase() === 'art') return '🎨';
        if (category.toLowerCase() === 'knifes' || category.toLowerCase() === 'knives') return '🔪';
        if (category.toLowerCase() === 'olight') return '🔦';
        if (category.toLowerCase() === 'switch games') return '🎮';
        if (category.toLowerCase().includes('electronic')) return '📱';
        if (category.toLowerCase().includes('office')) return '📎';
        if (category.toLowerCase().includes('furniture')) return '🪑';
        if (category.toLowerCase().includes('tool')) return '🔧';
        return '📦';
    };

    // Build category list
    categoryList.innerHTML = sortedCategories.map(category => `
        <button class="category-button" onclick="selectCategory('${category}')">
            ${getCategoryEmoji(category)} ${escapeHtml(category)}
            <span class="count">${categoryCounts[category]} items</span>
        </button>
    `).join('');

    modal.style.display = 'flex';
}

function hideCategoryMenu() {
    document.getElementById('categoryMenu').style.display = 'none';
}

function selectCategory(category) {
    document.getElementById('categoryFilter').value = category;
    filterByCategory();
    hideCategoryMenu();
}

function exportToExcel() {
    const selectedCategory = document.getElementById('categoryFilter').value;

    if (!selectedCategory || selectedCategory === 'all') {
        if (!confirm('This will export ALL items to Excel. Continue?')) {
            return;
        }
    }

    // Build export URL
    const url = `/api/export?category=${selectedCategory}`;

    // Show loading message
    showAlert('Generating Excel file...', 'success');

    // Download the file
    window.location.href = url;
}

function showAddCategoryModal() {
    document.getElementById('addCategoryModal').style.display = 'flex';
    document.getElementById('newCategoryName').value = '';
    document.getElementById('newCategoryName').focus();
}

function hideAddCategoryModal() {
    document.getElementById('addCategoryModal').style.display = 'none';
    document.getElementById('addCategoryForm').reset();
}

async function handleAddCategory(event) {
    event.preventDefault();

    const categoryName = document.getElementById('newCategoryName').value.trim();

    if (!categoryName) {
        showAlert('Please enter a category name', 'error');
        return;
    }

    // Check if category already exists
    const existingCategories = [...new Set(allItems.map(item => item.category || 'Uncategorized'))];
    if (existingCategories.map(cat => cat.toLowerCase()).includes(categoryName.toLowerCase())) {
        showAlert(`Category "${categoryName}" already exists!`, 'error');
        return;
    }

    try {
        // Create a placeholder item with the new category (0 quantity so it doesn't affect totals)
        const placeholderData = {
            description: `🔧 ${categoryName} - Category Setup Item`,
            serial_number: `CATEGORY-${categoryName.toUpperCase().replace(/\s+/g, '-')}-${Date.now()}`,
            category: categoryName,
            quantity: 0,
            cost: 0
        };

        const response = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(placeholderData)
        });

        const result = await response.json();

        if (result.success) {
            showAlert(`✅ Category "${categoryName}" added successfully!`, 'success');
            hideAddCategoryModal();

            // Reload items to update category dropdowns
            await loadItems();

            // Go to categories page to see the new category
            showPage('categories');
        } else {
            showAlert(result.error || 'Error adding category', 'error');
        }
    } catch (error) {
        console.error('Add category error:', error);
        showAlert(`Error: ${error.message}`, 'error');
    }
}

function displayEmptyState() {
    const listContainer = document.getElementById('inventoryList');
    listContainer.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="9" x2="15" y2="9"></line>
                <line x1="9" y1="13" x2="15" y2="13"></line>
                <line x1="9" y1="17" x2="11" y2="17"></line>
            </svg>
            <p>Please select a category to view items</p>
            <p style="font-size: 0.9rem; margin-top: 8px;">Use the category filter above to browse your inventory</p>
        </div>
    `;
}

function displayItems(items) {
    const listContainer = document.getElementById('inventoryList');

    if (items.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="9" x2="15" y2="9"></line>
                    <line x1="9" y1="13" x2="15" y2="13"></line>
                    <line x1="9" y1="17" x2="11" y2="17"></line>
                </svg>
                <p>No inventory items found</p>
                <p style="font-size: 0.9rem; margin-top: 8px;">Add your first item using the form above</p>
            </div>
        `;
        return;
    }

    // Group items by category
    const grouped = items.reduce((acc, item) => {
        const category = item.category || 'Uncategorized';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {});

    // Sort categories alphabetically (put Uncategorized last)
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    // Build HTML with category sections
    let html = '';
    sortedCategories.forEach(category => {
        const categoryItems = grouped[category];
        const categoryEmoji = category === 'Uncategorized' ? '📦' :
                             category.toLowerCase().includes('electronic') ? '📱' :
                             category.toLowerCase().includes('office') ? '📎' :
                             category.toLowerCase().includes('furniture') ? '🪑' :
                             category.toLowerCase().includes('tool') ? '🔧' : '📦';

        html += `
            <div class="category-section">
                <div class="category-header">
                    <h3>${categoryEmoji} ${escapeHtml(category)}</h3>
                    <span class="category-count">${categoryItems.length} item${categoryItems.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="category-items">
        `;

        categoryItems.forEach(item => {
            html += `
                <div class="inventory-item">
                    <input type="checkbox" class="item-checkbox" value="${item.id}">
                    ${item.image_path ? `
                        <div class="item-thumbnail">
                            <img src="/uploads/${escapeHtml(item.image_path)}" alt="${escapeHtml(item.description)}" onclick="openImagePreview('/uploads/${escapeHtml(item.image_path)}')">
                        </div>
                    ` : ''}
                    <div class="item-info">
                        <div class="item-field">
                            <span class="item-label">Description</span>
                            <span class="item-value highlight">${escapeHtml(item.description)}</span>
                        </div>
                        <div class="item-field">
                            <span class="item-label">Serial Number</span>
                            <span class="item-value">${escapeHtml(item.serial_number)}</span>
                        </div>
                        ${item.barcode ? `
                        <div class="item-field">
                            <span class="item-label">Barcode</span>
                            <img src="/barcodes/${escapeHtml(item.barcode)}" alt="Barcode" style="height: 40px;">
                        </div>
                        ` : ''}
                        <div class="item-field">
                            <span class="item-label">Quantity</span>
                            <span class="item-value">${item.quantity}</span>
                        </div>
                        <div class="item-field">
                            <span class="item-label">Cost/Unit</span>
                            <span class="item-value">$${parseFloat(item.cost).toFixed(2)}</span>
                        </div>
                        <div class="item-field">
                            <span class="item-label">Total Value</span>
                            <span class="item-value highlight">$${(parseFloat(item.quantity || 0) * parseFloat(item.cost || 0)).toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn btn-edit" onclick="editItem(${item.id})">Edit</button>
                        <button class="btn btn-danger" onclick="deleteItem(${item.id})">Delete</button>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    // Preserve current category filter
    const currentCategory = document.getElementById('categoryFilter').value;

    const imageFile = document.getElementById('image').files[0];
    const hasNewImage = !!imageFile;
    const hasExistingImage = !!currentImagePath;
    const removeImage = document.getElementById('removeImageBtn').style.display !== 'none' &&
                        document.getElementById('removeImageBtn').dataset.markedForDeletion === 'true';

    // Use FormData if uploading image, updating item with existing image, or removing image
    const useFormData = hasNewImage || (hasExistingImage && currentEditId) || removeImage;

    let response;
    try {
        if (useFormData) {
            // Use FormData for file upload or image management
            const formData = new FormData();
            formData.append('description', document.getElementById('description').value.trim());
            formData.append('serial_number', document.getElementById('serialNumber').value.trim());
            formData.append('category', getCategoryValue() || '');
            formData.append('quantity', parseInt(document.getElementById('quantity').value));
            formData.append('cost', parseFloat(document.getElementById('cost').value));
            formData.append('barcode', document.getElementById('barcode').value.trim() || '');

            if (hasNewImage) {
                formData.append('image', imageFile);
            }

            if (currentEditId && removeImage) {
                formData.append('delete_image', 'true');
            }

            if (currentEditId) {
                response = await fetch(`/api/items/${currentEditId}`, {
                    method: 'PUT',
                    body: formData
                });
            } else {
                response = await fetch('/api/items', {
                    method: 'POST',
                    body: formData
                });
            }
        } else {
            // Use JSON for items without images
            const itemData = {
                description: document.getElementById('description').value.trim(),
                serial_number: document.getElementById('serialNumber').value.trim(),
                category: getCategoryValue(),
                quantity: parseInt(document.getElementById('quantity').value),
                cost: parseFloat(document.getElementById('cost').value),
                barcode: document.getElementById('barcode').value.trim() || null
            };

            if (currentEditId) {
                response = await fetch(`/api/items/${currentEditId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });
            } else {
                response = await fetch('/api/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(itemData)
                });
            }
        }

        const result = await response.json();

        if (result.success) {
            showAlert(currentEditId ? 'Item updated successfully!' : 'Item added successfully!', 'success');
            resetForm();

            // Reload items and restore category filter
            await loadItems();

            // Restore the category filter if we were editing
            if (currentEditId && currentCategory && currentCategory !== 'all') {
                document.getElementById('categoryFilter').value = currentCategory;
                filterByCategory();
            }
        } else {
            showAlert(result.error || 'Error saving item', 'error');
        }
    } catch (error) {
        console.error('Submission error:', error);
        showAlert('Error communicating with server', 'error');
    }
}

function editItem(id) {
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    // Switch to the add/edit page first
    showPage('add');

    currentEditId = id;
    currentImagePath = item.image_path;
    document.getElementById('itemId').value = id;
    document.getElementById('description').value = item.description;
    document.getElementById('serialNumber').value = item.serial_number;
    document.getElementById('barcode').value = item.barcode || '';

    // Set category value in both dropdown and text input
    const categoryValue = item.category || '';
    document.getElementById('category').value = categoryValue;
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.value = categoryValue;
    }

    document.getElementById('quantity').value = item.quantity;
    document.getElementById('cost').value = item.cost;

    // Handle image preview
    const preview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    const removeBtn = document.getElementById('removeImageBtn');

    if (item.image_path) {
        previewImg.src = `/uploads/${item.image_path}`;
        preview.style.display = 'block';
        removeBtn.style.display = 'inline-block';
    } else {
        preview.style.display = 'none';
        removeBtn.style.display = 'none';
    }

    document.getElementById('formTitle').textContent = 'Edit Item';
    document.getElementById('submitBtn').textContent = 'Update Item';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    // Scroll to form
    document.querySelector('.container').scrollIntoView({ behavior: 'smooth' });
}

async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) {
        return;
    }

    // Preserve current category filter
    const currentCategory = document.getElementById('categoryFilter').value;

    try {
        const response = await fetch(`/api/items/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showAlert('Item deleted successfully!', 'success');
            await loadItems();

            // Restore the category filter
            document.getElementById('categoryFilter').value = currentCategory;
            filterByCategory();
        } else {
            showAlert('Error deleting item', 'error');
        }
    } catch (error) {
        showAlert('Error communicating with server', 'error');
    }
}

function resetForm() {
    currentEditId = null;
    currentImagePath = null;
    document.getElementById('itemForm').reset();
    document.getElementById('itemId').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('removeImageBtn').style.display = 'none';
    document.getElementById('previewImg').src = '';
    delete document.getElementById('removeImageBtn').dataset.markedForDeletion;

    // Reset category dropdown
    const categorySelect = document.getElementById('categorySelect');
    if (categorySelect) {
        categorySelect.value = '';
    }

    document.getElementById('formTitle').textContent = 'Add New Item';
    document.getElementById('submitBtn').textContent = 'Add Item';
    document.getElementById('cancelBtn').style.display = 'none';
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('removeImageBtn').style.display = 'inline-block';
        }
        reader.readAsDataURL(file);
    }
}

function removeImage() {
    document.getElementById('image').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('previewImg').src = '';
    document.getElementById('removeImageBtn').style.display = 'none';

    if (currentEditId && currentImagePath) {
        // Mark for deletion on form submit
        document.getElementById('removeImageBtn').dataset.markedForDeletion = 'true';
    } else {
        delete document.getElementById('removeImageBtn').dataset.markedForDeletion;
    }
}

function openImagePreview(src) {
    window.open(src, '_blank');
}

async function handleSearch(e) {
    const query = e.target.value.trim();
    const selectedCategory = document.getElementById('categoryFilter').value;

    // If no category selected, show empty state
    if (selectedCategory === 'all') {
        if (!query) {
            displayEmptyState();
        } else {
            // Still show empty state if searching without a category
            displayEmptyState();
        }
        return;
    }

    if (!query) {
        // Restore current category filter when search is cleared
        filterByCategory();
        return;
    }

    try {
        const response = await fetch(`/api/items/search?q=${encodeURIComponent(query)}`);
        const allSearchResults = await response.json();
        // Filter search results by selected category
        const filteredResults = allSearchResults.filter(item =>
            (item.category || 'Uncategorized') === selectedCategory
        );
        displayItems(filteredResults);
    } catch (error) {
        console.error('Search error:', error);
    }
}

function updateSummary() {
    const totalItems = allItems.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    const totalValue = allItems.reduce((sum, item) => {
        const qty = parseInt(item.quantity) || 0;
        const cost = parseFloat(item.cost) || 0;
        return sum + (qty * cost);
    }, 0);

    document.getElementById('totalItems').textContent = `${allItems.length} items (${totalItems} units)`;
    document.getElementById('totalValue').textContent = `Total Value: $${totalValue.toFixed(2)}`;
}

function showAlert(message, type) {
    // Remove existing alerts
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    const form = document.querySelector('.card');
    form.insertBefore(alert, form.firstChild);

    setTimeout(() => {
        alert.remove();
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function loadCategoriesPage() {
    // Get unique categories with counts
    const categoryData = {};
    allItems.forEach(item => {
        const category = item.category || 'Uncategorized';
        if (!categoryData[category]) {
            categoryData[category] = {
                count: 0,
                totalQuantity: 0,
                totalValue: 0,
                itemIds: []
            };
        }
        const qty = parseInt(item.quantity) || 0;
        const cost = parseFloat(item.cost) || 0;

        categoryData[category].count += 1;
        categoryData[category].totalQuantity += qty;
        categoryData[category].totalValue += (qty * cost);
        if (qty > 0) {  // Only track items with quantity > 0
            categoryData[category].itemIds.push(item.id);
        }
    });

    // Sort categories
    const sortedCategories = Object.keys(categoryData).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    // Get category emoji
    const getCategoryEmoji = (category) => {
        if (category === 'Uncategorized') return '📦';
        if (category.toLowerCase() === 'art') return '🎨';
        if (category.toLowerCase() === 'knifes' || category.toLowerCase() === 'knives') return '🔪';
        if (category.toLowerCase() === 'olight') return '🔦';
        if (category.toLowerCase() === 'switch games') return '🎮';
        if (category.toLowerCase().includes('electronic')) return '📱';
        if (category.toLowerCase().includes('office')) return '📎';
        if (category.toLowerCase().includes('furniture')) return '🪑';
        if (category.toLowerCase().includes('tool')) return '🔧';
        return '📦';
    };

    // Build categories page
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = sortedCategories.map(category => {
        const data = categoryData[category];
        const canDelete = data.count === 0 || (data.count === 1 && data.totalQuantity === 0);

        return `
            <div class="category-card">
                <div class="category-card-header" onclick="viewCategory('${category}')" style="cursor: pointer;">
                    <div class="category-icon">${getCategoryEmoji(category)}</div>
                    <div class="category-info">
                        <h3>${escapeHtml(category)}</h3>
                        <p>${data.count} item${data.count !== 1 ? 's' : ''} (${data.totalQuantity} units)</p>
                    </div>
                    <div class="category-stats">
                        <div class="stat">
                            <span class="stat-value">${data.totalQuantity}</span>
                            <span class="stat-label">Units</span>
                        </div>
                        <div class="stat">
                            <span class="stat-value">$${data.totalValue.toFixed(2)}</span>
                            <span class="stat-label">Value</span>
                        </div>
                    </div>
                </div>
                <div class="category-actions">
                    <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewCategory('${category}')">👁 View Items</button>
                    ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteCategory('${category}')">🗑 Delete Category</button>` : `<button class="btn btn-secondary btn-sm" disabled title="Category has items with quantity">🗑 Delete (empty first)</button>`}
                </div>
            </div>
        `;
    }).join('');
}

function viewCategory(category) {
    showPage('home');
    setTimeout(() => {
        document.getElementById('categoryFilter').value = category;
        filterByCategory();
    }, 100);
}

async function deleteCategory(category) {
    if (!confirm(`Are you sure you want to delete the "${category}" category?\n\nThis will delete all items in this category.`)) {
        return;
    }

    try {
        // Get all items in this category
        const categoryItems = allItems.filter(item => (item.category || 'Uncategorized') === category);

        // Delete each item
        const deletePromises = categoryItems.map(item =>
            fetch(`/api/items/${item.id}`, { method: 'DELETE' })
        );

        await Promise.all(deletePromises);

        showAlert(`✅ Category "${category}" deleted successfully!`, 'success');

        // Reload items and refresh categories page
        await loadItems();
        loadCategoriesPage();

    } catch (error) {
        console.error('Delete category error:', error);
        showAlert('Error deleting category', 'error');
    }
}

function resetFormAndGoHome() {
    resetForm();
    showPage('home');
}

function getCategoryValue() {
    const select = document.getElementById('categorySelect');
    const input = document.getElementById('category');

    // Use dropdown value if selected, otherwise use text input
    if (select && select.value) {
        return select.value.trim() || null;
    }
    if (input && input.value.trim()) {
        return input.value.trim() || null;
    }
    return null;
}

// User Management Functions
async function loadUsersPage() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();

        const container = document.getElementById('usersContainer');

        if (users.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <p style="text-align: center; padding: 40px;">No users found. Add your first user!</p>
                </div>
            `;
            return;
        }

        let html = '';
        users.forEach(user => {
            const isAdmin = user.is_admin;
            const permissions = user.permissions || [];
            const permissionsText = permissions.length > 0 ? permissions.join(', ') : 'All Categories (Admin)';

            html += `
                <div class="card user-card">
                    <div class="user-info">
                        <h3>${user.username} ${isAdmin ? '👑' : ''}</h3>
                        <p><strong>Role:</strong> ${isAdmin ? 'Administrator' : 'User'}</p>
                        <p><strong>Permissions:</strong> ${permissionsText}</p>
                        <p><strong>Created:</strong> ${new Date(user.created_at).toLocaleDateString()}</p>
                    </div>
                    <div class="user-actions">
                        ${!isAdmin ? `
                            <button class="btn btn-secondary btn-sm" onclick="editUserPermissions(${user.id}, '${user.username}')">✏️ Edit Permissions</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id}, '${user.username}')">🗑 Delete</button>
                        ` : '<p style="color: #666; font-style: italic;">Admin account - cannot be modified</p>'}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading users:', error);
        if (error.message.includes('403')) {
            document.getElementById('usersContainer').innerHTML = '<div class="card"><p style="text-align: center; padding: 40px;">❌ Access denied. Admin privileges required.</p></div>';
        }
    }
}

function showAddUserModal() {
    document.getElementById('addUserModal').style.display = 'flex';
    document.getElementById('newUsername').value = '';
    document.getElementById('newUserPassword').value = '';
    // Uncheck all checkboxes
    document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('newUsername').focus();
}

function hideAddUserModal() {
    document.getElementById('addUserModal').style.display = 'none';
    document.getElementById('addUserForm').reset();
}

async function handleAddUser(event) {
    event.preventDefault();

    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;

    console.log('Creating user:', username);

    // Get selected categories
    const selectedCategories = [];
    document.querySelectorAll('#categoryCheckboxes input[type="checkbox"]:checked').forEach(cb => {
        selectedCategories.push(cb.value);
    });

    console.log('Selected categories:', selectedCategories);

    if (selectedCategories.length === 0) {
        showAlert('❌ Please select at least one category permission', 'error');
        return;
    }

    // Show loading state
    const submitBtn = document.getElementById('addUserBtn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '🔄 Creating user...';

    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                password: password,
                is_admin: false,
                permissions: selectedCategories
            })
        });

        const result = await response.json();
        console.log('Server response:', result);

        if (result.success) {
            showAlert(`✅ User "${username}" created successfully!`, 'success');
            hideAddUserModal();
            loadUsersPage();
        } else {
            showAlert('❌ ' + (result.error || 'Error creating user'), 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    } catch (error) {
        console.error('Add user error:', error);
        showAlert('❌ Error communicating with server', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

function editUserPermissions(userId, username) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUsername').value = username;
    document.getElementById('editUserModal').style.display = 'flex';

    // Get current user permissions
    fetch('/api/users')
        .then(response => response.json())
        .then(users => {
            const user = users.find(u => u.id === userId);
            if (user && user.permissions) {
                // Set checkboxes based on current permissions
                document.querySelectorAll('#editCategoryCheckboxes input[type="checkbox"]').forEach(cb => {
                    cb.checked = user.permissions.includes(cb.value);
                });
            }
        });
}

function hideEditUserModal() {
    document.getElementById('editUserModal').style.display = 'none';
    document.getElementById('editUserForm').reset();
}

async function handleUpdateUserPermissions(event) {
    event.preventDefault();

    const userId = document.getElementById('editUserId').value;

    // Get selected categories
    const selectedCategories = [];
    document.querySelectorAll('#editCategoryCheckboxes input[type="checkbox"]:checked').forEach(cb => {
        selectedCategories.push(cb.value);
    });

    if (selectedCategories.length === 0) {
        showAlert('Please select at least one category permission', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}/permissions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions: selectedCategories })
        });

        const result = await response.json();

        if (result.success) {
            showAlert('✅ User permissions updated successfully!', 'success');
            hideEditUserModal();
            loadUsersPage();
        } else {
            showAlert(result.error || 'Error updating permissions', 'error');
        }
    } catch (error) {
        console.error('Update permissions error:', error);
        showAlert('Error communicating with server', 'error');
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showAlert(`✅ User "${username}" deleted successfully!`, 'success');
            loadUsersPage();
        } else {
            showAlert(result.error || 'Error deleting user', 'error');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showAlert('Error communicating with server', 'error');
    }
}

// Password change functions
function showChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'flex';
    document.getElementById('currentPassword').focus();
}

function hideChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
    document.getElementById('changePasswordForm').reset();
}

async function handleChangePassword(event) {
    event.preventDefault();

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        showAlert('❌ New passwords do not match!', 'error');
        return;
    }

    // Validate password length
    if (newPassword.length < 6) {
        showAlert('❌ New password must be at least 6 characters long!', 'error');
        return;
    }

    // Validate new password is different from current
    if (currentPassword === newPassword) {
        showAlert('❌ New password must be different from current password!', 'error');
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '🔄 Changing password...';

    try {
        const response = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        const result = await response.json();

        if (result.success) {
            // Clear the form
            document.getElementById('changePasswordForm').reset();

            // Hide modal
            hideChangePasswordModal();

            // Show success message with instructions
            showAlert('✅ Password changed successfully! Logging out...', 'success');

            // Wait a moment for the message to be read, then logout
            setTimeout(async () => {
                await logout();
            }, 2000);
        } else {
            showAlert('❌ ' + (result.error || 'Error changing password'), 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    } catch (error) {
        console.error('Password change error:', error);
        showAlert('❌ Error communicating with server', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    }
}

// ===== BARCODE SCANNING =====

let html5QrCode = null;
let barcodeTargetInput = null;

async function scanBarcode(inputId) {
    barcodeTargetInput = document.getElementById(inputId);

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("barcodeReader");
    }

    document.getElementById('barcodeScannerModal').style.display = 'block';

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            (decodedText) => {
                // Barcode decoded
                if (barcodeTargetInput) {
                    barcodeTargetInput.value = decodedText;
                }
                stopBarcodeScanner();
                showAlert('✅ Barcode scanned: ' + decodedText, 'success');
            },
            (errorMessage) => {
                // Ignore frame-by-frame scanning errors
            }
        );
    } catch (error) {
        console.error('Error starting barcode scanner:', error);
        showAlert('❌ Error starting camera. Please ensure camera permissions are granted.', 'error');
        hideBarcodeScanner();
    }
}

function stopBarcodeScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
        }).catch(error => {
            console.error('Error stopping scanner:', error);
        });
    }
}

function hideBarcodeScanner() {
    stopBarcodeScanner();
    document.getElementById('barcodeScannerModal').style.display = 'none';
}

// Print barcode labels for selected items
async function printBarcodeLabels() {
    const checkboxes = document.querySelectorAll('.item-checkbox:checked');

    if (checkboxes.length === 0) {
        showAlert('❌ Please select at least one item', 'error');
        return;
    }

    const itemIds = Array.from(checkboxes).map(cb => cb.value);

    try {
        const response = await fetch('/api/barcode-labels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_ids: itemIds }),
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            // Open the labels page in a new window for printing
            window.open(result.url, '_blank');
        } else {
            showAlert('❌ ' + (result.error || 'Error generating labels'), 'error');
        }
    } catch (error) {
        console.error('Label generation error:', error);
        showAlert('❌ Error communicating with server', 'error');
    }
}

// Generate barcodes for all items that don't have one
async function generateAllBarcodes() {
    if (!confirm('This will generate barcodes for all items that currently don\'t have one.\n\nThe barcode will be based on the serial number.\n\nContinue?')) {
        return;
    }

    try {
        const response = await fetch('/api/generate-all-barcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (result.success) {
            showAlert(`✅ ${result.message}`, 'success');
            // Reload items to show the new barcodes
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
        console.error('Bulk barcode generation error:', error);
        showAlert('❌ Error communicating with server', 'error');
    }
}

// Show barcode in item details
function showBarcodeImage(item) {
    if (item.barcode) {
        return `
            <div class="item-barcode">
                <img src="/barcodes/${item.barcode}" alt="Barcode" style="height: 60px;">
                <small>${item.serial_number}</small>
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
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
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
// Generate barcodes with custom category prefixes
async function generateBarcodesWithPrefixes() {
    const prefixes = prompt('Enter category prefixes (one per line, use COMMA to separate):\\n\\nExamples (enter exactly like this):\\nart,art\\nKnives,knives\\nOlight,olight\\nOL,ol\\nSwitch games,sw\\nSW,sw\\n\\n\\nFormat: category_name,prefix\\nExample: art,art', '');

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

    if (!confirm('Will generate barcodes for items in these categories:\\n\\n' + Object.keys(categoryPrefixes).join(', ') + '\\n\\nWith prefixes:\\n\\n' + Object.entries(categoryPrefixes).map(([cat, pref]) => '${cat} → ${pref}').join('\\n') + '\\n\\nContinue?')) {
        return;
    }

    try {
        const response = await fetch('/api/generate-all-barcodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category_prefixes: categoryPrefixes }),
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            showAlert('✅ ' + result.message, 'success');
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
