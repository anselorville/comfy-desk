"""
Prompt Memory — persistent example library for the Prompt Expert.

This is the expert's long-term "brain": every good text-to-image prompt the
user teaches it is stored as a structured example (positive/negative prompt,
scenario tags, structured slots, params, source). When rewriting a user's
vague request, the most relevant examples are retrieved and injected into the
system prompt, so the expert writes prompts in proven styles instead of
inventing structure.

Storage: sqlite at gateway/prompt_memory.db (gitignored DB file; seed corpus
ships in gateway/skills/prompt_memory_seed.json and is loaded on first run).

Schema (examples table):
    id            TEXT PRIMARY KEY   — slug
    title_zh      TEXT               — short human label
    category      TEXT               — guofeng / portrait / cosplay / zine / scene / ...
    tags          TEXT (JSON list)   — retrieval keys (style, subject, lighting, ...)
    positive      TEXT               — full positive prompt (verbatim, never truncated in retrieval)
    negative      TEXT               — negative prompt
    slots         TEXT (JSON obj)    — structured decomposition (subject/pose/light/...)
    params        TEXT (JSON obj)    — width/height/steps/cfg that produced good results
    why_good      TEXT               — one-paragraph "what to learn from this"
    source        TEXT               — where it came from (user-taught, doc guide, ...)
    use_count     INTEGER            — retrieval hits (feedback signal)
    created_at    TEXT
"""
from __future__ import annotations

import json
import logging
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent / "prompt_memory.db"
SEED_PATH = Path(__file__).parent.parent / "skills" / "prompt_memory_seed.json"

_TAG_RE = re.compile(r"[\w\u4e00-\u9fff:—/-]+")
_STOP = {
    "the", "a", "an", "of", "with", "and", "or", "in", "on", "at", "to",
    "for", "by", "is", "are", "的", "了", "吗", "呢", "我", "你", "他",
    "想要", "帮我", "生成", "一张", "图片", "出图", "提示词", "风格",
}

_conn: sqlite3.Connection | None = None


def _connect() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        first = not DB_PATH.exists()
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute(
            """CREATE TABLE IF NOT EXISTS examples (
                id TEXT PRIMARY KEY,
                title_zh TEXT NOT NULL,
                category TEXT DEFAULT '',
                tags TEXT DEFAULT '[]',
                positive TEXT NOT NULL,
                negative TEXT DEFAULT '',
                slots TEXT DEFAULT '{}',
                params TEXT DEFAULT '{}',
                why_good TEXT DEFAULT '',
                source TEXT DEFAULT '',
                use_count INTEGER DEFAULT 0,
                created_at TEXT DEFAULT ''
            )"""
        )
        _conn.commit()
        if first:
            _load_seed()
    return _conn


def _load_seed() -> None:
    """Load the shipped seed corpus on first run (idempotent per id)."""
    if not SEED_PATH.exists():
        return
    try:
        seed = json.loads(SEED_PATH.read_text())
    except Exception as e:
        logger.warning("prompt memory seed unreadable: %s", e)
        return
    added = 0
    for ex in seed:
        try:
            add_example(dedupe=False, **ex)
            added += 1
        except Exception as e:
            logger.warning("seed example skipped: %s (%s)", ex.get("id"), e)
    if added:
        logger.info("prompt memory: seeded %d examples", added)


# ── CRUD ──────────────────────────────────────────────────────────────────────

def add_example(
    *,
    id: str,
    title_zh: str,
    positive: str,
    negative: str = "",
    category: str = "",
    tags: list[str] | None = None,
    slots: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    why_good: str = "",
    source: str = "",
    dedupe: bool = True,
) -> dict[str, Any]:
    """Insert one example. With dedupe, a near-identical positive prompt bumps instead."""
    id = re.sub(r"[^a-z0-9_-]", "-", (id or "").lower()).strip("-")[:64]
    if not id or not (positive or "").strip():
        raise ValueError("id and positive prompt are required")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    conn = _connect()
    if dedupe:
        row = conn.execute("SELECT id FROM examples WHERE positive = ?", (positive.strip(),)).fetchone()
        if row:
            conn.execute("UPDATE examples SET use_count = use_count + 1 WHERE id = ?", (row["id"],))
            conn.commit()
            return {"id": row["id"], "deduped": True}
    conn.execute(
        """INSERT OR REPLACE INTO examples
           (id, title_zh, category, tags, positive, negative, slots, params,
            why_good, source, use_count, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,0,?)""",
        (
            id,
            (title_zh or id).strip(),
            (category or "").strip(),
            json.dumps([str(t) for t in (tags or [])], ensure_ascii=False),
            positive.strip(),
            (negative or "").strip(),
            json.dumps(slots or {}, ensure_ascii=False),
            json.dumps(params or {}, ensure_ascii=False),
            (why_good or "").strip(),
            (source or "user-taught").strip(),
            now,
        ),
    )
    conn.commit()
    return {"id": id, "deduped": False}


def list_examples(limit: int = 200) -> list[dict[str, Any]]:
    rows = _connect().execute(
        "SELECT * FROM examples ORDER BY created_at DESC LIMIT ?", (int(limit),)
    ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_example(example_id: str) -> dict[str, Any] | None:
    row = _connect().execute("SELECT * FROM examples WHERE id = ?", (example_id,)).fetchone()
    return _row_to_dict(row) if row else None


def delete_example(example_id: str) -> bool:
    conn = _connect()
    cur = conn.execute("DELETE FROM examples WHERE id = ?", (example_id,))
    conn.commit()
    return cur.rowcount > 0


def count_examples() -> int:
    return _connect().execute("SELECT COUNT(*) FROM examples").fetchone()[0]


# ── Retrieval ─────────────────────────────────────────────────────────────────

def _tokenize(text: str) -> set[str]:
    """Cheap bilingual tokenizer: CJK bigrams + latin words + known phrases."""
    tokens: set[str] = set()
    for m in _TAG_RE.finditer(text.lower()):
        w = m.group(0)
        if re.fullmatch(r"[a-z0-9:—/-]+", w):
            if w not in _STOP and len(w) > 1:
                tokens.add(w)
        else:
            # CJK: add bigrams so 古风/仕女/光线 match inside longer phrases
            chars = [c for c in w if "\u4e00" <= c <= "\u9fff"]
            for i in range(len(chars) - 1):
                tokens.add(chars[i] + chars[i + 1])
    return tokens


def search_examples(query: str, top_k: int = 3) -> list[dict[str, Any]]:
    """Tag-overlap retrieval; falls back to most-recent examples when nothing matches."""
    conn = _connect()
    rows = conn.execute("SELECT * FROM examples").fetchall()
    if not rows:
        return []
    q_tokens = _tokenize(query or "")
    scored: list[tuple[float, sqlite3.Row]] = []
    for r in rows:
        hay = " ".join(
            [
                r["title_zh"], r["category"], r["tags"], r["slots"][:2000], r["why_good"],
            ]
        )
        tags = set(json.loads(r["tags"] or "[]"))
        tag_tokens: set[str] = set()
        for t in tags:
            tag_tokens |= _tokenize(t)
        overlap = q_tokens & (tag_tokens | _tokenize(hay))
        score = float(len(overlap))
        # bonus when a full tag appears verbatim in the query
        for t in tags:
            tl = t.lower()
            if len(tl) > 1 and tl in (query or "").lower():
                score += 2.0
        if score > 0:
            scored.append((score + r["use_count"] * 0.1, r))
    scored.sort(key=lambda x: -x[0])
    picked = [r for _, r in scored[:top_k]]
    if not picked:  # cold start / no overlap: give the newest examples
        picked = list(rows[:top_k])
    for r in picked:
        conn.execute("UPDATE examples SET use_count = use_count + 1 WHERE id = ?", (r["id"],))
    conn.commit()
    return [_row_to_dict(r) for r in picked]


def _row_to_dict(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    for k in ("tags", "slots", "params"):
        try:
            d[k] = json.loads(d.get(k) or ("[]" if k == "tags" else "{}"))
        except json.JSONDecodeError:
            pass
    return d


# ── Prompt injection ──────────────────────────────────────────────────────────

def render_memory_block(examples: list[dict[str, Any]]) -> str:
    """Format retrieved examples for injection into the expert's system prompt."""
    if not examples:
        return ""
    parts = ["学过的高质量示例库(按当前需求检索,模仿其结构与用词,不要照抄内容):"]
    for i, ex in enumerate(examples, 1):
        params = ex.get("params") or {}
        p_str = ""
        if params:
            p_str = f"参数: {json.dumps(params, ensure_ascii=False)}; "
        slots = ex.get("slots") or {}
        slot_str = ""
        if slots:
            slot_str = "结构槽位: " + "; ".join(f"{k}={str(v)[:120]}" for k, v in list(slots.items())[:10]) + "; "
        parts.append(
            f"[示例{i}] {ex['title_zh']} (category={ex.get('category','')}; tags={','.join(ex.get('tags', []))})\n"
            f"  为什么好: {ex.get('why_good','')[:300]}\n"
            f"  {slot_str}{p_str}正向:\n  {ex['positive'][:1800]}"
        )
        if ex.get("negative"):
            parts.append(f"  负向: {ex['negative'][:400]}")
    return "\n".join(parts)
