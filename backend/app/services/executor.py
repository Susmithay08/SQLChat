"""Execute SQL against real databases."""
import time
import re


async def run_real_query(connection_string: str, sql: str) -> dict:
    """Run SQL on a real database. Returns same shape as demo_db.run_demo_query."""
    try:
        if connection_string.startswith("postgresql") or connection_string.startswith("postgres"):
            return await _run_pg(connection_string, sql)
        elif connection_string.startswith("sqlite"):
            return _run_sqlite(connection_string, sql)
        else:
            return {"columns": [], "rows": [], "row_count": 0, "execution_ms": 0,
                    "error": "Unsupported DB type for live queries."}
    except Exception as e:
        return {"columns": [], "rows": [], "row_count": 0, "execution_ms": 0, "error": str(e)}


async def _run_pg(conn_str: str, sql: str) -> dict:
    try:
        import asyncpg
        cs = conn_str.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")
        start = time.time()
        conn = await asyncpg.connect(cs, timeout=10)
        try:
            rows = await conn.fetch(sql)
            elapsed = int((time.time() - start) * 1000)
            if not rows:
                return {"columns": [], "rows": [], "row_count": 0, "execution_ms": elapsed, "error": None}
            columns = list(rows[0].keys())
            data = [[str(v) if v is not None else None for v in r.values()] for r in rows[:500]]
            return {"columns": columns, "rows": data, "row_count": len(data), "execution_ms": elapsed, "error": None}
        finally:
            await conn.close()
    except ImportError:
        return {"columns":[], "rows":[], "row_count":0, "execution_ms":0, "error":"asyncpg not installed"}
    except Exception as e:
        return {"columns":[], "rows":[], "row_count":0, "execution_ms":0, "error":str(e)}


def _run_sqlite(conn_str: str, sql: str) -> dict:
    import sqlite3
    path = re.sub(r"sqlite(\+\w+)?:///", "", conn_str)
    start = time.time()
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        cur = conn.execute(sql)
        rows = cur.fetchmany(500)
        columns = [d[0] for d in cur.description] if cur.description else []
        elapsed = int((time.time() - start) * 1000)
        conn.close()
        return {"columns": columns, "rows": [list(r) for r in rows], "row_count": len(rows), "execution_ms": elapsed, "error": None}
    except Exception as e:
        return {"columns":[], "rows":[], "row_count":0, "execution_ms":0, "error":str(e)}
