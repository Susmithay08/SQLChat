"""
Groq-powered natural language → SQL service.
Handles both demo schema and real database schemas.
"""
import httpx
import json
import re
from app.core.config import settings
from app.services.demo_db import SCHEMA_DESCRIPTION


SYSTEM_PROMPT_TEMPLATE = """You are an expert SQL assistant. Convert natural language questions into SQL queries.

Database schema:
{schema}

Rules:
1. Return ONLY valid SQL — no markdown, no backticks, no explanation in the SQL itself
2. Use standard SQL that works with {dialect}
3. Always add LIMIT 500 unless the user explicitly asks for all rows or an aggregate
4. For date arithmetic use appropriate functions for {dialect}
5. Be case-insensitive with string comparisons where possible
6. After the SQL, on a new line write "EXPLANATION:" followed by a 1-2 sentence plain English explanation of what the query does

Format your response EXACTLY like this:
SELECT ...;
EXPLANATION: This query does X by Y.
"""

DEMO_DIALECT = "SQLite"


def _extract_sql_and_explanation(text: str) -> tuple[str, str]:
    """Parse the model response into (sql, explanation)."""
    text = text.strip()

    # Split on EXPLANATION:
    if "EXPLANATION:" in text:
        parts = text.split("EXPLANATION:", 1)
        sql_part = parts[0].strip().rstrip(";") + ";"
        explanation = parts[1].strip()
    else:
        sql_part = text.strip().rstrip(";") + ";"
        explanation = ""

    # Strip any accidental markdown
    sql_part = re.sub(r"```sql\s*", "", sql_part)
    sql_part = re.sub(r"```\s*", "", sql_part)
    sql_part = sql_part.strip()

    return sql_part, explanation


async def generate_sql(
    question: str,
    schema: str = None,
    dialect: str = "SQLite",
    history: list[dict] = None,
    groq_api_key: str = None,
) -> dict:
    """
    Returns: { sql, explanation, error }
    """
    api_key = groq_api_key or settings.GROQ_API_KEY
    if not api_key:
        return {"sql": None, "explanation": None, "error": "No Groq API key configured. Add GROQ_API_KEY to .env or provide it in settings."}

    schema_to_use = schema or SCHEMA_DESCRIPTION
    system = SYSTEM_PROMPT_TEMPLATE.format(schema=schema_to_use, dialect=dialect)

    # Build message history (last 6 turns for context)
    messages = [{"role": "system", "content": system}]
    if history:
        for turn in history[-6:]:
            messages.append({"role": "user", "content": turn["question"]})
            if turn.get("sql"):
                messages.append({"role": "assistant", "content": f"{turn['sql']}\nEXPLANATION: {turn.get('explanation', '')}"})

    messages.append({"role": "user", "content": question})

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.GROQ_MODEL,
                    "messages": messages,
                    "temperature": 0.1,
                    "max_tokens": 1024,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            sql, explanation = _extract_sql_and_explanation(content)
            return {"sql": sql, "explanation": explanation, "error": None}

    except httpx.HTTPStatusError as e:
        body = e.response.text
        return {"sql": None, "explanation": None, "error": f"Groq API error {e.response.status_code}: {body[:200]}"}
    except Exception as e:
        return {"sql": None, "explanation": None, "error": str(e)}


async def get_real_db_schema(connection_string: str) -> tuple[str, str, str | None]:
    """
    Connect to a real database and extract its schema.
    Returns (schema_text, dialect, error)
    """
    try:
        if connection_string.startswith("postgresql") or connection_string.startswith("postgres"):
            return await _pg_schema(connection_string)
        elif connection_string.startswith("mysql"):
            return await _mysql_schema(connection_string)
        elif connection_string.startswith("sqlite"):
            return _sqlite_schema(connection_string)
        else:
            return "", "", "Unsupported database type. Use postgresql://, mysql://, or sqlite://"
    except Exception as e:
        return "", "", str(e)


async def _pg_schema(conn_str: str) -> tuple[str, str, str | None]:
    try:
        import asyncpg
        # normalize asyncpg format
        cs = conn_str.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://")
        conn = await asyncpg.connect(cs, timeout=10)
        rows = await conn.fetch("""
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ORDER BY table_name, ordinal_position
        """)
        await conn.close()

        tables: dict[str, list] = {}
        for r in rows:
            tables.setdefault(r["table_name"], []).append(f"  {r['column_name']} {r['data_type']}")

        schema_text = "\n".join(
            f"{t}(\n" + ",\n".join(cols) + "\n)"
            for t, cols in tables.items()
        )
        return schema_text, "PostgreSQL", None
    except ImportError:
        return "", "", "asyncpg not installed. Run: pip install asyncpg"
    except Exception as e:
        return "", "", str(e)


async def _mysql_schema(conn_str: str) -> tuple[str, str, str | None]:
    return "", "", "MySQL support coming soon. Use PostgreSQL or SQLite for now."


def _sqlite_schema(conn_str: str) -> tuple[str, str, str | None]:
    import sqlite3, re
    path = re.sub(r"sqlite(\+\w+)?:///", "", conn_str)
    try:
        conn = sqlite3.connect(path)
        cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        schema_parts = []
        for t in tables:
            cur2 = conn.execute(f"PRAGMA table_info({t})")
            cols = [f"  {r[1]} {r[2]}" for r in cur2.fetchall()]
            schema_parts.append(f"{t}(\n" + ",\n".join(cols) + "\n)")
        conn.close()
        return "\n\n".join(schema_parts), "SQLite", None
    except Exception as e:
        return "", "", str(e)
