"""
In-memory SQLite demo database with a realistic e-commerce schema.
Pre-loaded with enough data to answer interesting questions.
"""
import sqlite3
import random
from datetime import datetime, timedelta

_demo_conn: sqlite3.Connection | None = None


SCHEMA_DESCRIPTION = """
Tables in this database:

customers(id, name, email, city, country, joined_at, tier)
  - tier: 'bronze' | 'silver' | 'gold' | 'platinum'

products(id, name, category, price, stock, rating, created_at)
  - category: 'Electronics' | 'Clothing' | 'Books' | 'Home' | 'Sports' | 'Beauty'

orders(id, customer_id, status, total, created_at, shipped_at, delivered_at)
  - status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

order_items(id, order_id, product_id, quantity, unit_price)

reviews(id, customer_id, product_id, rating, title, body, created_at, helpful_votes)
  - rating: 1-5

coupons(id, code, discount_pct, min_order, uses, max_uses, expires_at)
"""

EXAMPLE_QUESTIONS = [
    "Show me the top 10 customers by total spending",
    "Which product categories have the highest average rating?",
    "What's the monthly revenue trend for the last 6 months?",
    "Find customers who placed more than 5 orders",
    "Which products are low on stock (less than 10 units)?",
    "What's the average order value by customer tier?",
    "Show cancelled orders in the last 30 days with customer names",
    "Which customers haven't ordered in 90 days?",
    "What are the top 5 most reviewed products?",
    "Show revenue by country",
]


def get_demo_connection() -> sqlite3.Connection:
    global _demo_conn
    if _demo_conn is not None:
        return _demo_conn

    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    _create_schema(conn)
    _seed_data(conn)
    _demo_conn = conn
    return conn


def _create_schema(conn):
    conn.executescript("""
    CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        name TEXT, email TEXT UNIQUE,
        city TEXT, country TEXT,
        joined_at TEXT,
        tier TEXT DEFAULT 'bronze'
    );
    CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        name TEXT, category TEXT,
        price REAL, stock INTEGER,
        rating REAL DEFAULT 0,
        created_at TEXT
    );
    CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        status TEXT, total REAL,
        created_at TEXT, shipped_at TEXT, delivered_at TEXT
    );
    CREATE TABLE order_items (
        id INTEGER PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER, unit_price REAL
    );
    CREATE TABLE reviews (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        product_id INTEGER REFERENCES products(id),
        rating INTEGER, title TEXT, body TEXT,
        created_at TEXT, helpful_votes INTEGER DEFAULT 0
    );
    CREATE TABLE coupons (
        id INTEGER PRIMARY KEY,
        code TEXT UNIQUE, discount_pct INTEGER,
        min_order REAL, uses INTEGER DEFAULT 0,
        max_uses INTEGER, expires_at TEXT
    );
    """)
    conn.commit()


def _seed_data(conn):
    random.seed(42)

    cities = [("New York","US"),("London","UK"),("Paris","FR"),("Berlin","DE"),
              ("Tokyo","JP"),("Sydney","AU"),("Toronto","CA"),("Mumbai","IN"),
              ("Seoul","KR"),("Amsterdam","NL"),("Chicago","US"),("Barcelona","ES")]
    tiers = ["bronze","bronze","bronze","silver","silver","gold","platinum"]
    first = ["Alice","Bob","Carol","David","Emma","Frank","Grace","Henry",
             "Iris","Jack","Kate","Liam","Mia","Noah","Olivia","Paul",
             "Quinn","Rachel","Sam","Tara","Uma","Victor","Wendy","Xavier"]
    last  = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller",
             "Davis","Wilson","Taylor","Anderson","Thomas","Jackson","White"]

    customers = []
    for i in range(1, 201):
        fn, ln = random.choice(first), random.choice(last)
        city, country = random.choice(cities)
        joined = (datetime.now() - timedelta(days=random.randint(30, 1000))).strftime("%Y-%m-%d")
        tier = random.choice(tiers)
        customers.append((i, f"{fn} {ln}", f"{fn.lower()}.{ln.lower()}{i}@email.com", city, country, joined, tier))
    conn.executemany("INSERT INTO customers VALUES (?,?,?,?,?,?,?)", customers)

    categories = ["Electronics","Clothing","Books","Home","Sports","Beauty"]
    product_names = {
        "Electronics": ["Wireless Headphones","Smart Watch","Laptop Stand","USB Hub","Mechanical Keyboard","Webcam 4K","LED Monitor","Phone Case","Earbuds Pro","Power Bank"],
        "Clothing":    ["Running Shoes","Yoga Pants","Cotton T-Shirt","Winter Jacket","Casual Sneakers","Denim Jeans","Hoodie","Sports Socks","Sun Hat","Rain Coat"],
        "Books":       ["Python Cookbook","Design Patterns","Clean Code","The Pragmatic Programmer","Deep Learning","System Design","Art of War","Atomic Habits","Dune","1984"],
        "Home":        ["Coffee Maker","Air Purifier","Desk Lamp","Plant Pot","Throw Pillow","Bamboo Cutting Board","Candle Set","Picture Frame","Storage Box","Door Mat"],
        "Sports":      ["Yoga Mat","Resistance Bands","Jump Rope","Foam Roller","Water Bottle","Gym Gloves","Protein Shaker","Pull-up Bar","Ankle Weights","Fitness Tracker"],
        "Beauty":      ["Face Serum","Lip Balm","Sunscreen SPF50","Hair Oil","Eye Cream","Moisturizer","Toner","Sheet Mask","Nail Polish","Body Lotion"],
    }

    products = []
    pid = 1
    for cat, names in product_names.items():
        for name in names:
            price = round(random.uniform(5, 500), 2)
            stock = random.randint(0, 200)
            rating = round(random.uniform(2.5, 5.0), 1)
            created = (datetime.now() - timedelta(days=random.randint(10, 500))).strftime("%Y-%m-%d")
            products.append((pid, name, cat, price, stock, rating, created))
            pid += 1
    conn.executemany("INSERT INTO products VALUES (?,?,?,?,?,?,?)", products)

    statuses = ["delivered","delivered","delivered","shipped","processing","pending","cancelled","refunded"]
    orders, order_items = [], []
    oid, iid = 1, 1
    for cid in range(1, 201):
        num_orders = random.randint(0, 12)
        for _ in range(num_orders):
            created = datetime.now() - timedelta(days=random.randint(1, 365))
            status = random.choice(statuses)
            shipped = (created + timedelta(days=2)).strftime("%Y-%m-%d") if status in ("shipped","delivered") else None
            delivered = (created + timedelta(days=5)).strftime("%Y-%m-%d") if status == "delivered" else None

            items_in_order = random.randint(1, 5)
            total = 0
            order_item_rows = []
            for _ in range(items_in_order):
                prod = random.randint(1, 60)
                qty = random.randint(1, 4)
                price = products[prod-1][3]
                total += price * qty
                order_item_rows.append((iid, oid, prod, qty, price))
                iid += 1

            orders.append((oid, cid, status, round(total, 2), created.strftime("%Y-%m-%d"), shipped, delivered))
            order_items.extend(order_item_rows)
            oid += 1

    conn.executemany("INSERT INTO orders VALUES (?,?,?,?,?,?,?)", orders)
    conn.executemany("INSERT INTO order_items VALUES (?,?,?,?,?)", order_items)

    reviews = []
    rid = 1
    review_titles = ["Great product!","Exceeded expectations","Decent for the price","Not what I expected",
                     "Highly recommend","Love it!","Just okay","Amazing quality","Fast delivery","Would buy again"]
    for _ in range(500):
        cid = random.randint(1, 200)
        prod = random.randint(1, 60)
        rating = random.randint(1, 5)
        title = random.choice(review_titles)
        created = (datetime.now() - timedelta(days=random.randint(1, 300))).strftime("%Y-%m-%d")
        helpful = random.randint(0, 50)
        reviews.append((rid, cid, prod, rating, title, f"Review body for {title.lower()}.", created, helpful))
        rid += 1
    conn.executemany("INSERT INTO reviews VALUES (?,?,?,?,?,?,?,?)", reviews)

    conn.executemany("INSERT INTO coupons VALUES (?,?,?,?,?,?,?)", [
        (1,"SAVE10",10,50,45,100,(datetime.now()+timedelta(days=30)).strftime("%Y-%m-%d")),
        (2,"WELCOME20",20,0,12,50,(datetime.now()+timedelta(days=60)).strftime("%Y-%m-%d")),
        (3,"FLASH50",50,200,3,10,(datetime.now()+timedelta(days=2)).strftime("%Y-%m-%d")),
    ])
    conn.commit()


def run_demo_query(sql: str) -> dict:
    import time
    conn = get_demo_connection()
    start = time.time()
    try:
        cursor = conn.execute(sql)
        rows = cursor.fetchmany(500)  # cap at 500 rows
        columns = [d[0] for d in cursor.description] if cursor.description else []
        elapsed = int((time.time() - start) * 1000)
        return {
            "columns": columns,
            "rows": [list(r) for r in rows],
            "row_count": len(rows),
            "execution_ms": elapsed,
            "error": None,
        }
    except Exception as e:
        return {"columns": [], "rows": [], "row_count": 0, "execution_ms": 0, "error": str(e)}
