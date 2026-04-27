"""
NCDM serve · /api/mastery/vector
================================
不加载 torch / 不重训，只读 parquet 做 sigmoid（已在 train 时算过）。
延迟目标：<5ms（in-memory cache）+ <50ms（冷读 parquet）

部署：uvicorn src.serve:app --host 0.0.0.0 --port 8000
"""
import os
import json
import time
import logging
from pathlib import Path
from typing import Optional

import duckdb
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(message)s")
log = logging.getLogger("ncdm-serve")

OUT_DIR = Path(os.environ.get("OUT_DIR", "/data/parquet"))
PARQUET = OUT_DIR / "student_mastery_latest.parquet"
META = OUT_DIR / "kc_meta_latest.json"
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

app = FastAPI(title="Yuandian NCDM Mastery API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# in-memory cache（避免每次都打 disk）
_state = {"loaded_at": 0.0, "kc_meta": None, "table": None, "stats": None}


def reload_if_stale():
    """parquet 文件 mtime 变更自动重新载入"""
    if not PARQUET.exists():
        return
    mtime = PARQUET.stat().st_mtime
    if mtime > _state["loaded_at"]:
        log.info(f"Reloading parquet (mtime={mtime})")
        _state["table"] = pd.read_parquet(PARQUET)
        _state["loaded_at"] = mtime
        if META.exists():
            _state["kc_meta"] = json.loads(META.read_text(encoding="utf-8"))


@app.on_event("startup")
async def boot():
    reload_if_stale()
    log.info(f"Boot done. PARQUET={PARQUET} loaded={_state['loaded_at']>0}")


@app.get("/healthz")
def health():
    return {
        "status": "ok",
        "parquet_exists": PARQUET.exists(),
        "loaded_at": _state["loaded_at"],
        "n_students_cached": len(_state["table"]) if _state["table"] is not None else 0,
        "trained_at": (_state["kc_meta"] or {}).get("trained_at"),
    }


@app.get("/api/mastery/vector")
def get_mastery(
    student_id: str = Query(..., description="数据库学生 id（uuid 或字符串）"),
    top_k_weakest: Optional[int] = Query(None, ge=1, le=50, description="只返回最弱的 top-K KC"),
):
    reload_if_stale()
    table = _state["table"]
    if table is None:
        raise HTTPException(503, "model not trained yet, parquet missing")

    row = table[table["student_id"] == student_id]
    if row.empty:
        raise HTTPException(404, f"student_id {student_id} 不在最新 NCDM 训练集中（可能新注册或 attempts < 5）")

    kc_cols = [c for c in table.columns if c != "student_id"]
    vec = row.iloc[0][kc_cols].to_dict()
    kc_meta = (_state["kc_meta"] or {}).get("kc_meta", {})

    items = []
    for kp_id, mastery in vec.items():
        meta = kc_meta.get(kp_id, {})
        items.append({
            "knowledge_point_id": kp_id,
            "name": meta.get("name"),
            "subject": meta.get("subject"),
            "mastery": round(float(mastery), 3),
        })
    items.sort(key=lambda x: x["mastery"])

    response = {
        "student_id": student_id,
        "trained_at": (_state["kc_meta"] or {}).get("trained_at"),
        "n_kcs": len(items),
        "all_kcs": items,
    }
    if top_k_weakest:
        response["weakest"] = items[:top_k_weakest]
    return response


@app.get("/api/mastery/recommend")
def recommend(
    student_id: str = Query(...),
    n: int = Query(5, ge=1, le=20),
):
    """ZPD-aware 推题：找 mastery 落在 0.4-0.7 区间的 KC，最有学习价值"""
    reload_if_stale()
    table = _state["table"]
    if table is None:
        raise HTTPException(503, "model not trained yet")

    row = table[table["student_id"] == student_id]
    if row.empty:
        raise HTTPException(404, f"student {student_id} 未在训练集")

    kc_cols = [c for c in table.columns if c != "student_id"]
    kc_meta = (_state["kc_meta"] or {}).get("kc_meta", {})
    items = []
    for kp_id in kc_cols:
        m = float(row.iloc[0][kp_id])
        if 0.4 <= m <= 0.7:  # ZPD 区间
            meta = kc_meta.get(kp_id, {})
            items.append({
                "knowledge_point_id": kp_id,
                "name": meta.get("name"),
                "subject": meta.get("subject"),
                "mastery": round(m, 3),
                "priority": round(abs(0.55 - m), 3),  # 越接近 0.55 越是真正的"踮脚够得着"
            })
    items.sort(key=lambda x: x["priority"])
    return {"student_id": student_id, "recommendations": items[:n]}
