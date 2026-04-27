"""
NCDM nightly trainer · Yuandian AI Coach
=========================================
1. 从 Supabase Postgres 拉 attempts 表（学生答题日志）
2. 从 questions / knowledge_points 表构建 Q-matrix
3. 训 NCDM 50 epochs（CPU 约 3-8 分钟取决于规模）
4. 持久化 student_emb.parquet 给 serve.py 在线 sigmoid

环境变量：
  DATABASE_URL  Postgres 连接串（Supabase 给的 connection pooler URL）
  EPOCHS        默认 50（PoC 阶段）
  OUT_DIR       输出目录，默认 /data/parquet
"""
import os
import sys
import time
import json
import logging
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, TensorDataset
from EduCDM import NCDM
import psycopg

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("ncdm-train")

DATABASE_URL = os.environ.get("DATABASE_URL")
EPOCHS = int(os.environ.get("EPOCHS", "50"))
OUT_DIR = Path(os.environ.get("OUT_DIR", "/data/parquet"))
OUT_DIR.mkdir(parents=True, exist_ok=True)

MIN_LOGS = 1000  # 少于这个数不训，避免崩
MIN_ATTEMPTS_PER_STUDENT = 5  # 学生少于 5 题不进训练集


def fetch_logs():
    """拉 attempts + questions + knowledge_points 三表"""
    if not DATABASE_URL:
        log.error("DATABASE_URL not set, abort")
        sys.exit(1)
    log.info("Connecting to Supabase...")
    with psycopg.connect(DATABASE_URL) as conn:
        # attempts: 学生答题
        log.info("Fetching attempts...")
        attempts = pd.read_sql(
            """
            SELECT a.student_id, a.question_id, a.is_correct, a.submitted_at
            FROM attempts a
            INNER JOIN students s ON s.id = a.student_id
            WHERE a.is_correct IS NOT NULL
              AND a.submitted_at > NOW() - INTERVAL '180 days'
            """,
            conn,
        )
        log.info(f"  attempts rows: {len(attempts)}")

        # questions → knowledge_point_ids
        log.info("Fetching questions × knowledge_points...")
        q2kp = pd.read_sql(
            """
            SELECT q.id AS question_id, unnest(q.knowledge_point_ids) AS kp_id
            FROM questions q
            WHERE q.knowledge_point_ids IS NOT NULL
              AND array_length(q.knowledge_point_ids, 1) > 0
            """,
            conn,
        )
        log.info(f"  q-kp links: {len(q2kp)}")

        kps = pd.read_sql(
            "SELECT id, name, subject, grade FROM knowledge_points ORDER BY id",
            conn,
        )
        log.info(f"  knowledge_points: {len(kps)}")

    return attempts, q2kp, kps


def build_dataset(attempts, q2kp, kps):
    # 学生过滤：少于 MIN_ATTEMPTS_PER_STUDENT 的不进
    counts = attempts.groupby("student_id").size()
    valid_students = counts[counts >= MIN_ATTEMPTS_PER_STUDENT].index
    attempts = attempts[attempts["student_id"].isin(valid_students)].copy()
    log.info(f"After filter: {len(attempts)} attempts from {len(valid_students)} students")

    if len(attempts) < MIN_LOGS:
        log.warning(f"Only {len(attempts)} logs, less than MIN_LOGS={MIN_LOGS}, skip training")
        return None

    # 重新编号（NCDM 要求连续 0-indexed）
    student_map = {sid: i for i, sid in enumerate(sorted(attempts["student_id"].unique()))}
    question_map = {qid: i for i, qid in enumerate(sorted(attempts["question_id"].unique()))}
    kp_map = {kpid: i for i, kpid in enumerate(sorted(kps["id"].unique()))}

    n_students = len(student_map)
    n_questions = len(question_map)
    n_kc = len(kp_map)
    log.info(f"Dim: students={n_students} questions={n_questions} kcs={n_kc}")

    # Q-matrix
    Q = np.zeros((n_questions, n_kc), dtype=np.float32)
    q2kp_filtered = q2kp[q2kp["question_id"].isin(question_map) & q2kp["kp_id"].isin(kp_map)]
    for _, row in q2kp_filtered.iterrows():
        Q[question_map[row["question_id"]], kp_map[row["kp_id"]]] = 1.0
    log.info(f"Q-matrix sparsity: {Q.sum() / (n_questions * n_kc):.3%}")

    # 训练集 tensors
    user_ids = attempts["student_id"].map(student_map).values
    item_ids = attempts["question_id"].map(question_map).values
    scores = attempts["is_correct"].astype(int).values

    user_t = torch.tensor(user_ids, dtype=torch.long)
    item_t = torch.tensor(item_ids, dtype=torch.long)
    y_t = torch.tensor(scores, dtype=torch.float32)
    kemb_t = torch.tensor(np.stack([Q[i] for i in item_ids]), dtype=torch.float32)

    return {
        "ds": TensorDataset(user_t, item_t, kemb_t, y_t),
        "n_students": n_students,
        "n_questions": n_questions,
        "n_kc": n_kc,
        "student_map": student_map,
        "kp_map": kp_map,
        "kps": kps,
    }


def train_and_save(meta):
    loader = DataLoader(meta["ds"], batch_size=256, shuffle=True)
    model = NCDM(
        knowledge_n=meta["n_kc"],
        exer_n=meta["n_questions"],
        student_n=meta["n_students"],
    )
    log.info(f"Training NCDM for {EPOCHS} epochs (CPU)...")
    t0 = time.time()
    model.train(loader, epoch=EPOCHS, device="cpu", lr=0.01, silence=False)
    log.info(f"Train done in {time.time() - t0:.1f}s")

    auc, acc = model.eval(loader, device="cpu")
    log.info(f"In-sample AUC={auc:.3f} ACC={acc:.3f}")

    # 抽 student_emb（每个学生的 KC 维 embedding）
    model.ncdm_net.eval()
    with torch.no_grad():
        all_ids = torch.arange(meta["n_students"], dtype=torch.long)
        emb = model.ncdm_net.student_emb(all_ids).cpu().numpy()  # [n_students, n_kc]

    # 反向 map：内部 idx → DB 的真 student_id / kp_id
    inv_student = {v: k for k, v in meta["student_map"].items()}
    inv_kp = {v: k for k, v in meta["kp_map"].items()}

    # 落 parquet（每行一个学生，列 = KC ids，值 = sigmoid 后的掌握度）
    sig = 1.0 / (1.0 + np.exp(-emb))
    df = pd.DataFrame(sig, columns=[str(inv_kp[i]) for i in range(meta["n_kc"])])
    df.insert(0, "student_id", [str(inv_student[i]) for i in range(meta["n_students"])])

    out_path = OUT_DIR / "student_mastery_latest.parquet"
    df.to_parquet(out_path, index=False, compression="snappy")
    log.info(f"Wrote {out_path} · shape={df.shape}")

    # KC 元信息（id→name 给前端展示）
    kp_meta = {
        str(inv_kp[i]): {
            "name": meta["kps"].set_index("id").loc[inv_kp[i], "name"]
                    if inv_kp[i] in meta["kps"]["id"].values else "未知",
            "subject": meta["kps"].set_index("id").loc[inv_kp[i], "subject"]
                    if inv_kp[i] in meta["kps"]["id"].values else None,
        }
        for i in range(meta["n_kc"])
    }
    meta_path = OUT_DIR / "kc_meta_latest.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "kc_meta": kp_meta,
            "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "n_students": meta["n_students"],
            "n_questions": meta["n_questions"],
            "n_kc": meta["n_kc"],
            "auc": float(auc),
            "acc": float(acc),
            "epochs": EPOCHS,
        }, f, ensure_ascii=False, indent=2)
    log.info(f"Wrote {meta_path}")


def main():
    log.info("=== NCDM nightly training start ===")
    attempts, q2kp, kps = fetch_logs()
    meta = build_dataset(attempts, q2kp, kps)
    if meta is None:
        log.warning("No training run.")
        return
    train_and_save(meta)
    log.info("=== Done ===")


if __name__ == "__main__":
    main()
