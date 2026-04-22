#!/usr/bin/env python
"""API 链路测试脚本"""
import httpx
import json

BASE = "http://localhost:8000/api/v1"
client = httpx.Client(timeout=15)

def test_kb_and_system():
    print("=== 登录获取 Token ===")
    r = client.post(f"{BASE}/auth/login", json={
        "email": "api_test@example.com",
        "password": "TestPass123"
    })
    assert r.status_code == 200, f"登录失败: {r.status_code} {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"  Token 获取成功: {token[:30]}...\n")

    print("=== 测试 1: 获取分类 ===")
    r = client.get(f"{BASE}/kb/categories", headers=headers)
    print(f"  GET /kb/categories: {r.status_code}")
    cats = r.json()
    print(f"  分类数量: {len(cats)}")
    for c in cats:
        print(f"    - {c['name']} ({c['type']})")
    print()

    print("=== 测试 2: 获取知识库文档列表 ===")
    r = client.get(f"{BASE}/kb/documents", headers=headers)
    print(f"  GET /kb/documents: {r.status_code}")
    docs = r.json()
    if isinstance(docs, list):
        from collections import Counter
        statuses = Counter([d.get("status", "unknown") for d in docs])
        print(f"  文档总数: {len(docs)}, 状态分布: {dict(statuses)}")
        for d in docs[:5]:
            print(f"    [{d.get('status','?')}] {d.get('title','无标题')} (chunk_count={d.get('chunk_count','?')})")
    else:
        print(f"  响应: {str(docs)[:200]}")
    print()

    print("=== 测试 3: 获取系统配置 ===")
    r = client.get(f"{BASE}/system/config", headers=headers)
    print(f"  GET /system/config: {r.status_code}")
    cfg = r.json()
    print(f"  LLM模型: {cfg.get('llm_model', '未配置')}")
    print(f"  Embedding: {cfg.get('embedding_model', '未配置')}")
    print(f"  retrieval_top_k: {cfg.get('retrieval_top_k', '未配置')}")
    print()

    print("=== 测试 4: 系统统计 ===")
    r = client.get(f"{BASE}/system/stats", headers=headers)
    print(f"  GET /system/stats: {r.status_code}")
    stats = r.json()
    print(f"  响应: {json.dumps(stats, ensure_ascii=False, indent=2)}")
    print()

    print("=== 测试 5: 审查历史 ===")
    r = client.get(f"{BASE}/analysis/history", headers=headers)
    print(f"  GET /analysis/history: {r.status_code}")
    hist = r.json()
    print(f"  历史记录数: {len(hist) if isinstance(hist, list) else 'N/A'}")
    print()

    print("=== 测试 6: 搜索知识库（模拟）===")
    r = client.get(f"{BASE}/kb/search", params={"q": "专利", "top_k": 3}, headers=headers)
    print(f"  GET /kb/search?q=专利: {r.status_code}")
    search = r.json()
    print(f"  搜索结果: {json.dumps(search, ensure_ascii=False, indent=2)[:500]}")
    print()

    print("=== 测试 7: 上传并审查文件 ===")
    content = ("Patent Application\n\n"
               "Title: AI-based Patent Retrieval System\n\n"
               "Abstract: This invention discloses an AI-based patent retrieval system "
               "including data collection module, feature extraction module and similarity "
               "computation module. The system uses deep learning models to generate "
               "vector representations of patent documents for efficient similarity retrieval.\n\n"
               "Claims:\n"
               "1. An AI-based patent retrieval system characterized by comprising...\n").encode("utf-8")
    files = {"file": ("test_patent.txt", content, "text/plain")}
    data = {"review_type": "patent"}
    r = client.post(
        f"{BASE}/analysis/review/with-file",
        headers=headers,
        files=files,
        data=data
    )
    print(f"  POST /analysis/review/with-file: {r.status_code}")
    if r.status_code == 200:
        task = r.json()
        print(f"  任务ID: {task.get('id')}")
        print(f"  状态: {task.get('status')}")
        print(f"  审查类型: {task.get('review_type', 'N/A')}")
    else:
        print(f"  错误: {r.text[:300]}")

    print()
    print("=== 所有测试完成 ===")

if __name__ == "__main__":
    try:
        test_kb_and_system()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
