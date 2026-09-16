import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_replay_session_persistence_roundtrip():
    # 1. Create a replay session with cursor index 50 and strategy
    create_payload = {
        "user_id": "user-101",
        "symbol": "BTCUSDT",
        "asset_class": "crypto",
        "timeframe": "1d",
        "current_bar_index": 50,
        "active_strategy": {
            "entry": 84200,
            "stopLoss": 83200,
            "takeProfit": 86500,
            "side": "LONG",
            "size": 1.0,
            "status": "ACTIVE"
        },
        "is_demo_data": False
    }
    
    response = client.post("/api/v1/replay/sessions", json=create_payload)
    assert response.status_code == 201
    session_data = response.json()
    session_id = session_data["id"]
    
    print("\n--- RAW REPLAY CREATE RESPONSE ---")
    print(session_data)
    
    # Assert fields
    assert session_data["symbol"] == "BTCUSDT"
    assert session_data["current_bar_index"] == 50
    assert session_data["active_strategy"]["side"] == "LONG"
    
    # 2. Fetch session back via GET /api/v1/replay/sessions/{id}
    fetch_resp = client.get(f"/api/v1/replay/sessions/{session_id}")
    assert fetch_resp.status_code == 200
    fetched_data = fetch_resp.json()
    
    print("\n--- RAW REPLAY FETCH RESPONSE ---")
    print(fetched_data)
    
    assert fetched_data["id"] == session_id
    assert fetched_data["current_bar_index"] == 50
    assert fetched_data["active_strategy"]["takeProfit"] == 86500
    
    # 3. Update cursor position via PATCH
    patch_resp = client.patch(f"/api/v1/replay/sessions/{session_id}", json={"current_bar_index": 75})
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    
    assert updated_data["current_bar_index"] == 75
