"""
Inventory Management System
A simple web-based inventory system with SQLite database
"""

from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, session, redirect, url_for
from sqlite3 import Connection
import sqlite3
import os
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from PIL import Image
import pillow_heif
import pandas as pd
from datetime import datetime
import io
from functools import wraps
import barcode
from barcode.writer import ImageWriter

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24).hex())

# Use data directory for persistent storage
DATA_DIR = os.environ.get('DATA_DIR', '/app/data')
DATABASE = os.path.join(DATA_DIR, 'inventory.db')
UPLOAD_FOLDER = os.path.join(DATA_DIR, 'uploads')
BARCODE_FOLDER = os.path.join(DATA_DIR, 'barcodes')

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['BARCODE_FOLDER'] = BARCODE_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Ensure data directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(BARCODE_FOLDER, exist_ok=True)

def get_db() -> Connection:
    """Get database connection"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_extension(filename):
    """Get file extension from filename"""
    return filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

def convert_heic_to_jpeg(heic_path, output_path):
    """Convert HEIC/HEIF image to JPEG format"""
    try:
        # Register HEIF opener with pillow
        pillow_heif.register_heif_opener()

        # Open and convert HEIC image
        img = Image.open(heic_path)

        # Convert to RGB (HEIC might be in other color spaces)
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # Save as JPEG
        img.save(output_path, 'JPEG', quality=95)

        # Delete original HEIC file
        os.remove(heic_path)

        return True
    except Exception as e:
        print(f"Error converting HEIC: {e}")
        return False

def generate_barcode(code):
    """Generate barcode image and save it"""
    try:
        # Using Code128 which supports alphanumeric characters
        barcode_class = barcode.get_barcode_class('code128')
        bc = barcode_class(code, writer=ImageWriter())
        filename = bc.save(os.path.join(app.config['BARCODE_FOLDER'], f'barcode_{code}'))
        return filename + '.png'
    except Exception as e:
        print(f"Error generating barcode: {e}")
        return None

def init_db():
    """Initialize database with inventory, users, and permissions tables"""
    conn = get_db()

    # Create inventory table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            serial_number TEXT UNIQUE NOT NULL,
            category TEXT,
            image_path TEXT,
            quantity INTEGER NOT NULL DEFAULT 0,
            cost REAL NOT NULL DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Add columns if table exists and doesn't have them
    cursor = conn.execute("PRAGMA table_info(inventory)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'category' not in columns:
        conn.execute('ALTER TABLE inventory ADD COLUMN category TEXT')
    if 'image_path' not in columns:
        conn.execute('ALTER TABLE inventory ADD COLUMN image_path TEXT')
    if 'barcode' not in columns:
        conn.execute('ALTER TABLE inventory ADD COLUMN barcode TEXT')

    # Create users table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Add is_admin column if it doesn't exist
    cursor = conn.execute("PRAGMA table_info(users)")
    user_columns = [col[1] for col in cursor.fetchall()]
    if 'is_admin' not in user_columns:
        conn.execute('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0')

    # Create user permissions table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS user_permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            UNIQUE(user_id, category)
        )
    ''')

    # Create default admin user if no users exist
    user_count = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
    if user_count == 0:
        default_password = os.environ.get('ADMIN_PASSWORD', 'changeme')
        admin_password = generate_password_hash(default_password)
        conn.execute('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)', ('admin', admin_password, 1))
        print("Default admin user created. Set ADMIN_PASSWORD env var to customize.")
    else:
        # Make sure admin user has admin privileges
        conn.execute('UPDATE users SET is_admin = 1 WHERE username = ?', ('admin',))

    conn.commit()
    conn.close()

def login_required(f):
    """Decorator to require login for protected routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    """Render main page or redirect to login if not authenticated"""
    if 'user_id' not in session:
        return render_template('login.html')
    return render_template('index.html')

@app.route('/login')
def login_page():
    """Render login page"""
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login():
    """Handle user login"""
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'success': False, 'error': 'Username and password required'}), 400

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()

    if user and check_password_hash(user['password_hash'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        return jsonify({'success': True, 'username': user['username']})
    else:
        return jsonify({'success': False, 'error': 'Invalid username or password'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    """Handle user logout"""
    session.clear()
    return jsonify({'success': True})

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    """Check if user is authenticated"""
    if 'user_id' in session:
        return jsonify({'authenticated': True, 'username': session.get('username')})
    return jsonify({'authenticated': False})

@app.route('/api/change-password', methods=['POST'])
@login_required
def change_password():
    """Change user password"""
    data = request.json
    current_password = data.get('current_password')
    new_password = data.get('new_password')

    if not current_password or not new_password:
        return jsonify({'success': False, 'error': 'Current and new password required'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'error': 'New password must be at least 6 characters'}), 400

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if not user or not check_password_hash(user['password_hash'], current_password):
        conn.close()
        return jsonify({'success': False, 'error': 'Current password is incorrect'}), 400

    # Update password
    new_password_hash = generate_password_hash(new_password)
    conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (new_password_hash, session['user_id']))
    conn.commit()
    conn.close()

    return jsonify({'success': True})

@app.route('/api/users', methods=['GET'])
@login_required
def get_users():
    """Get all users (admin only)"""
    conn = get_db()
    current_user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if not current_user or not current_user['is_admin']:
        conn.close()
        return jsonify({'success': False, 'error': 'Admin access required'}), 403

    users = conn.execute('SELECT id, username, is_admin, created_at FROM users ORDER BY username').fetchall()
    conn.close()

    # Get permissions for each user
    result = []
    for user in users:
        user_dict = dict(user)
        # Get user permissions
        conn = get_db()
        permissions = conn.execute('SELECT category FROM user_permissions WHERE user_id = ?', (user['id'],)).fetchall()
        user_dict['permissions'] = [p['category'] for p in permissions]
        conn.close()
        result.append(user_dict)

    return jsonify(result)

@app.route('/api/users', methods=['POST'])
@login_required
def create_user():
    """Create new user (admin only)"""
    conn = get_db()
    current_user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if not current_user or not current_user['is_admin']:
        conn.close()
        return jsonify({'success': False, 'error': 'Admin access required'}), 403

    data = request.json
    username = data.get('username')
    password = data.get('password')
    is_admin = data.get('is_admin', False)
    permissions = data.get('permissions', [])

    if not username or not password:
        conn.close()
        return jsonify({'success': False, 'error': 'Username and password required'}), 400

    if len(password) < 6:
        conn.close()
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters'}), 400

    try:
        password_hash = generate_password_hash(password)
        cursor = conn.execute('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
                                (username, password_hash, 1 if is_admin else 0))
        user_id = cursor.lastrowid

        # Add permissions
        for category in permissions:
            conn.execute('INSERT INTO user_permissions (user_id, category) VALUES (?, ?)', (user_id, category))

        conn.commit()
        conn.close()
        return jsonify({'success': True, 'user_id': user_id})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'success': False, 'error': 'Username already exists'}), 400

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@login_required
def delete_user(user_id):
    """Delete user (admin only)"""
    conn = get_db()
    current_user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if not current_user or not current_user['is_admin']:
        conn.close()
        return jsonify({'success': False, 'error': 'Admin access required'}), 403

    # Prevent deleting yourself
    if user_id == session['user_id']:
        conn.close()
        return jsonify({'success': False, 'error': 'Cannot delete your own account'}), 400

    conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/users/<int:user_id>/permissions', methods=['PUT'])
@login_required
def update_user_permissions(user_id):
    """Update user permissions (admin only)"""
    conn = get_db()
    current_user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if not current_user or not current_user['is_admin']:
        conn.close()
        return jsonify({'success': False, 'error': 'Admin access required'}), 403

    data = request.json
    permissions = data.get('permissions', [])

    # Delete existing permissions
    conn.execute('DELETE FROM user_permissions WHERE user_id = ?', (user_id,))

    # Add new permissions
    for category in permissions:
        conn.execute('INSERT INTO user_permissions (user_id, category) VALUES (?, ?)', (user_id, category))

    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/user/permissions', methods=['GET'])
@login_required
def get_current_user_permissions():
    """Get current user's permissions"""
    conn = get_db()
    user = conn.execute('SELECT id, username, is_admin FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if not user:
        conn.close()
        return jsonify({'success': False, 'error': 'User not found'}), 404

    user_dict = dict(user)
    user_dict['permissions'] = []

    if not user['is_admin']:
        permissions = conn.execute('SELECT category FROM user_permissions WHERE user_id = ?', (session['user_id'],)).fetchall()
        user_dict['permissions'] = [p['category'] for p in permissions]

    conn.close()
    return jsonify(user_dict)

@app.route('/api/categories', methods=['GET'])
@login_required
def get_all_categories():
    """Get all available categories"""
    conn = get_db()
    categories = conn.execute('SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL ORDER BY category').fetchall()
    conn.close()
    return jsonify([cat['category'] for cat in categories])

@app.route('/api/items', methods=['GET'])
@login_required
def get_items():
    """Get all inventory items (filtered by user permissions)"""
    conn = get_db()

    # Check if user is admin
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if user and user['is_admin']:
        # Admin sees all items
        items = conn.execute('SELECT * FROM inventory ORDER BY description').fetchall()
    else:
        # Regular user only sees items in their permitted categories
        permitted_categories = conn.execute(
            'SELECT category FROM user_permissions WHERE user_id = ?', (session['user_id'],)
        ).fetchall()

        if not permitted_categories:
            # No permissions assigned - show nothing
            items = []
        else:
            category_list = [cat['category'] for cat in permitted_categories]
            placeholders = ','.join(['?' for _ in category_list])
            query = f"SELECT * FROM inventory WHERE category IN ({placeholders}) ORDER BY description"
            items = conn.execute(query, category_list).fetchall()

    conn.close()
    return jsonify([dict(item) for item in items])

@app.route('/api/items', methods=['POST'])
@login_required
def add_item():
    """Add new inventory item"""
    # Handle both JSON and multipart form data
    if request.content_type and 'multipart/form-data' in request.content_type:
        description = request.form.get('description')
        serial_number = request.form.get('serial_number')
        category = request.form.get('category') or None
        quantity = int(request.form.get('quantity', 0))
        cost = float(request.form.get('cost', 0))
        barcode = request.form.get('barcode') or serial_number  # Default to serial number
        image = request.files.get('image')
    else:
        data = request.json
        description = data['description']
        serial_number = data['serial_number']
        category = data.get('category')
        quantity = data['quantity']
        cost = data['cost']
        barcode = data.get('barcode', serial_number)  # Default to serial number
        image = None

    # Generate barcode image
    barcode_path = None
    if barcode:
        barcode_path = generate_barcode(barcode)

    image_path = None
    if image and allowed_file(image.filename):
        ext = get_file_extension(image.filename)
        base_filename = secure_filename(f"{serial_number}")

        # Handle HEIC/HEIF files - convert to JPEG
        if ext in ['heic', 'heif']:
            heic_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{base_filename}.{ext}")
            jpeg_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{base_filename}.jpg")
            image.save(heic_path)

            if convert_heic_to_jpeg(heic_path, jpeg_path):
                image_path = f"{base_filename}.jpg"
            else:
                # Fallback: keep original if conversion fails
                image_path = f"{base_filename}.{ext}"
        else:
            filename = f"{base_filename}.{ext}"
            image.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            image_path = filename

    conn = get_db()
    try:
        conn.execute('''
            INSERT INTO inventory (description, serial_number, category, image_path, barcode, quantity, cost)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (description, serial_number, category, image_path, barcode_path, quantity, cost))
        conn.commit()
        conn.close()
        return jsonify({'success': True}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'success': False, 'error': 'Serial number already exists'}), 400
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/api/items/<int:item_id>', methods=['PUT'])
@login_required
def update_item(item_id):
    """Update inventory item"""
    conn = get_db()

    # Get current item to check for existing image
    current_item = conn.execute('SELECT * FROM inventory WHERE id = ?', (item_id,)).fetchone()

    # Handle both JSON and multipart form data
    if request.content_type and 'multipart/form-data' in request.content_type:
        description = request.form.get('description')
        serial_number = request.form.get('serial_number')
        category = request.form.get('category') or None
        quantity = int(request.form.get('quantity', 0))
        cost = float(request.form.get('cost', 0))
        barcode = request.form.get('barcode') or serial_number  # Default to serial number
        image = request.files.get('image')
        delete_image = request.form.get('delete_image') == 'true'
        regenerate_barcode = request.form.get('regenerate_barcode') == 'true'
    else:
        data = request.json
        description = data['description']
        serial_number = data['serial_number']
        category = data.get('category')
        quantity = data['quantity']
        cost = data['cost']
        barcode = data.get('barcode', serial_number)  # Default to serial number
        image = None
        delete_image = data.get('delete_image', False)
        regenerate_barcode = data.get('regenerate_barcode', False)

    # Handle barcode generation
    # Determine barcode to use: user-provided, existing, or default to serial_number
    barcode_to_use = barcode if barcode else (current_item['barcode'] if current_item['barcode'] else serial_number)

    # Generate or keep existing barcode
    barcode_path = current_item['barcode'] if current_item['barcode'] else None
    if regenerate_barcode or (not barcode_path):
        # Delete old barcode if exists
        if barcode_path and os.path.exists(os.path.join(app.config['BARCODE_FOLDER'], barcode_path)):
            os.remove(os.path.join(app.config['BARCODE_FOLDER'], barcode_path))
        barcode_path = generate_barcode(barcode_to_use)

    image_path = current_item['image_path']
    if delete_image:
        # Delete old image if exists
        if image_path and os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], image_path)):
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], image_path))
        image_path = None
    elif image and allowed_file(image.filename):
        # Delete old image if exists
        if image_path and os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], image_path)):
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], image_path))

        ext = get_file_extension(image.filename)
        base_filename = secure_filename(f"{serial_number}_{item_id}")

        # Handle HEIC/HEIF files - convert to JPEG
        if ext in ['heic', 'heif']:
            heic_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{base_filename}.{ext}")
            jpeg_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{base_filename}.jpg")
            image.save(heic_path)

            if convert_heic_to_jpeg(heic_path, jpeg_path):
                image_path = f"{base_filename}.jpg"
            else:
                # Fallback: keep original if conversion fails
                image_path = f"{base_filename}.{ext}"
        else:
            filename = f"{base_filename}.{ext}"
            image.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            image_path = filename

    conn.execute('''
        UPDATE inventory
        SET description = ?, serial_number = ?, category = ?, image_path = ?, barcode = ?, quantity = ?, cost = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (description, serial_number, category, image_path, barcode_path, quantity, cost, item_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/items/<int:item_id>', methods=['DELETE'])
@login_required
def delete_item(item_id):
    """Delete inventory item"""
    conn = get_db()

    # Get item to delete associated image and barcode
    item = conn.execute('SELECT image_path, barcode FROM inventory WHERE id = ?', (item_id,)).fetchone()
    if item:
        # Delete image if exists
        if item['image_path']:
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], item['image_path'])
            if os.path.exists(image_path):
                os.remove(image_path)
        # Delete barcode if exists
        if item['barcode']:
            barcode_path = os.path.join(app.config['BARCODE_FOLDER'], item['barcode'])
            if os.path.exists(barcode_path):
                os.remove(barcode_path)

    conn.execute('DELETE FROM inventory WHERE id = ?', (item_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/uploads/<filename>')
@login_required
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/barcodes/<filename>')
@login_required
def barcode_file(filename):
    """Serve barcode files"""
    return send_from_directory(app.config['BARCODE_FOLDER'], filename)

@app.route('/api/items/search', methods=['GET'])
@login_required
def search_items():
    """Search inventory items"""
    query = request.args.get('q', '')
    conn = get_db()
    items = conn.execute('''
        SELECT * FROM inventory
        WHERE description LIKE ? OR serial_number LIKE ? OR category LIKE ?
        ORDER BY description
    ''', (f'%{query}%', f'%{query}%', f'%{query}%')).fetchall()
    conn.close()
    return jsonify([dict(item) for item in items])

@app.route('/api/barcode-labels', methods=['POST'])
@login_required
def print_barcode_labels():
    """Generate printable barcode labels for items"""
    data = request.json
    item_ids = data.get('item_ids', [])

    if not item_ids:
        return jsonify({'success': False, 'error': 'No items selected'}), 400

    conn = get_db()
    placeholders = ','.join(['?' for _ in item_ids])
    items = conn.execute(f'SELECT * FROM inventory WHERE id IN ({placeholders})', item_ids).fetchall()
    conn.close()

    # Create a simple HTML page with printable labels
    labels_html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Barcode Labels</title>
        <style>
            @media print {
                body { margin: 0; }
                .label { page-break-after: always; }
            }
            .label {
                width: 2in;
                height: 1in;
                border: 1px solid #000;
                padding: 10px;
                text-align: center;
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .label-title {
                font-size: 10pt;
                font-weight: bold;
                margin-bottom: 5px;
                word-wrap: break-word;
            }
            .label-barcode {
                width: 100%;
                height: 40px;
            }
            .label-serial {
                font-size: 8pt;
                color: #666;
            }
        </style>
    </head>
    <body>
    '''

    for item in items:
        item_dict = dict(item)
        barcode_url = f"/barcodes/{item_dict['barcode']}" if item_dict.get('barcode') else ''
        labels_html += f'''
        <div class="label">
            <div class="label-title">{item_dict['description']}</div>
            {f'<img class="label-barcode" src="{barcode_url}" alt="Barcode">' if barcode_url else '<div style="height:40px;"></div>'}
            <div class="label-serial">{item_dict['serial_number']}</div>
        </div>
        '''

    labels_html += '''
    </body>
    </html>
    '''

    # Save to temporary file
    temp_file = os.path.join(app.config['BARCODE_FOLDER'], 'labels.html')
    with open(temp_file, 'w') as f:
        f.write(labels_html)

    return jsonify({'success': True, 'url': '/barcodes/labels.html'})

@app.route('/api/generate-all-barcodes', methods=['POST'])
@login_required
def generate_all_barcodes():
    """Generate barcodes for all items that don't have one"""
    data = request.json
    category_prefixes = data.get('category_prefixes', {})

    conn = get_db()

    # Get all items (or specific ones if requested)
    query = 'SELECT id, serial_number, category FROM inventory WHERE barcode IS NULL OR barcode = ""'
    if category_prefixes:
        # Filter by categories that have custom prefixes
        categories = list(category_prefixes.keys())
        placeholders = ','.join(['?' for _ in categories])
        query = f'SELECT id, serial_number, category FROM inventory WHERE category IN ({placeholders})'
        items = conn.execute(query, categories).fetchall()
    else:
        items = conn.execute(query).fetchall()

    generated_count = 0
    failed_count = 0

    for item in items:
        try:
            # Determine barcode prefix based on category
            category = item['category'] or ''
            if category_prefixes and category in category_prefixes:
                prefix = category_prefixes[category]
                barcode_code = f"{prefix}_{item['serial_number']}"
            else:
                barcode_code = item['serial_number']

            # Generate barcode
            barcode_path = generate_barcode(barcode_code)
            if barcode_path:
                # Update item with barcode path
                conn.execute('UPDATE inventory SET barcode = ? WHERE id = ?', (barcode_path, item['id']))
                generated_count += 1
            else:
                failed_count += 1
        except Exception as e:
            print(f"Error generating barcode for item {item['id']}: {e}")
            failed_count += 1

    conn.commit()
    conn.close()

    if generated_count > 0:
        return jsonify({
            'success': True,
            'message': f'Generated barcodes for {generated_count} items' + (f'. {failed_count} failed.' if failed_count > 0 else '.')
        })
    else:
        return jsonify({'success': False, 'error': 'All items already have barcodes or no items found'}), 400

@app.route('/api/export', methods=['GET'])
@login_required
def export_items():
    """Export items to Excel by category (respects user permissions)"""
    category = request.args.get('category', 'all')

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

    if user and user['is_admin']:
        if category == 'all':
            items = conn.execute('SELECT * FROM inventory ORDER BY category, description').fetchall()
        else:
            items = conn.execute('SELECT * FROM inventory WHERE category = ? ORDER BY description', (category,)).fetchall()
    else:
        permitted_categories = conn.execute(
            'SELECT category FROM user_permissions WHERE user_id = ?', (session['user_id'],)
        ).fetchall()

        if category == 'all':
            category_list = [cat['category'] for cat in permitted_categories]
            if not category_list:
                items = []
            else:
                placeholders = ','.join(['?' for _ in category_list])
                query = f"SELECT * FROM inventory WHERE category IN ({placeholders}) ORDER BY category, description"
                items = conn.execute(query, category_list).fetchall()
        else:
            has_permission = conn.execute(
                'SELECT * FROM user_permissions WHERE user_id = ? AND category = ?',
                (session['user_id'], category)
            ).fetchone()

            if has_permission:
                items = conn.execute('SELECT * FROM inventory WHERE category = ? ORDER BY description', (category,)).fetchall()
            else:
                items = []

    conn.close()

    # Convert to list of dictionaries for pandas
    data = []
    for item in items:
        data.append({
            'Description': item['description'],
            'Serial Number': item['serial_number'],
            'Category': item['category'] or 'Uncategorized',
            'Quantity': item['quantity'],
            'Cost per Unit': item['cost'],
            'Total Value': item['quantity'] * item['cost'],
            'Date Added': item['created_at']
        })

    # Create DataFrame
    df = pd.DataFrame(data)

    # Create Excel file in memory
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Inventory')

        # Get the workbook and worksheet for formatting
        workbook = writer.book
        worksheet = writer.sheets['Inventory']

        # Adjust column widths
        worksheet.column_dimensions['A'].width = 40  # Description
        worksheet.column_dimensions['B'].width = 20  # Serial Number
        worksheet.column_dimensions['C'].width = 20  # Category
        worksheet.column_dimensions['D'].width = 12  # Quantity
        worksheet.column_dimensions['E'].width = 12  # Cost
        worksheet.column_dimensions['F'].width = 12  # Total Value
        worksheet.column_dimensions['G'].width = 20  # Date Added

        # Add header row formatting
        from openpyxl.styles import Font, PatternFill, Alignment
        header_fill = PatternFill(start_color='667eea', end_color='667eea', fill_type='solid')
        header_font = Font(bold=True, color='FFFFFF')

        for cell in worksheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal='center')

    output.seek(0)

    # Generate filename
    category_name = category if category != 'all' else 'All_Categories'
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'Inventory_{category_name}_{timestamp}.xlsx'

    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )

# Initialize database on startup
with app.app_context():
    init_db()

if __name__ == '__main__':
    # Production settings - debug mode disabled
    debug_mode = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(debug=debug_mode, host='0.0.0.0', port=8000)

@app.route('/api/delete-all-barcodes', methods=['POST'])
@login_required
def delete_all_barcodes():
    """Delete all barcode files and clear barcode field from inventory"""
    conn = get_db()

    try:
        # Get all items with barcodes
        items = conn.execute('SELECT id, barcode FROM inventory WHERE barcode IS NOT NULL AND barcode != ""').fetchall()

        deleted_count = 0
        for item in items:
            try:
                barcode_path = os.path.join(app.config['BARCODE_FOLDER'], item['barcode'])
                if os.path.exists(barcode_path):
                    os.remove(barcode_path)
                    deleted_count += 1
            except Exception as e:
                print(f"Error deleting barcode for item {item['id']}: {e}")

        # Clear barcode field from inventory
        conn.execute('UPDATE inventory SET barcode = NULL')
        conn.commit()
        conn.close()

        return jsonify({
            'success': True,
            'message': f'Deleted {deleted_count} barcode files and cleared all items'
        })
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500
