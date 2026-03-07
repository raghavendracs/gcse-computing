import pytest
from fastapi.testclient import TestClient

def get_client():
    from main import app
    return TestClient(app)

def test_correct_output():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "print(int(input()) ** 2)",
        "testCases": [
            {"input": "5", "expectedOutput": "25"},
            {"input": "3", "expectedOutput": "9"},
        ],
        "timeoutMs": 5000,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["testResults"][0]["passed"] is True
    assert data["testResults"][1]["passed"] is True
    assert data["timedOut"] is False
    assert data["blocked"] is False

def test_wrong_output():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "print(int(input()) + 1)",
        "testCases": [{"input": "5", "expectedOutput": "25"}],
        "timeoutMs": 5000,
    })
    data = resp.json()
    assert data["testResults"][0]["passed"] is False
    assert data["testResults"][0]["actualOutput"] == "6"

def test_syntax_error():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "def broken(:\n    pass",
        "testCases": [{"input": "", "expectedOutput": ""}],
        "timeoutMs": 5000,
    })
    data = resp.json()
    assert data["testResults"][0]["passed"] is False
    assert data["stderr"] != ""

def test_blocked_import():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "import os\nprint(os.getcwd())",
        "testCases": [{"input": "", "expectedOutput": ""}],
        "timeoutMs": 5000,
    })
    data = resp.json()
    assert data["blocked"] is True
    assert data["blockReason"] is not None

def test_timeout():
    client = get_client()
    resp = client.post("/execute", json={
        "code": "while True: pass",
        "testCases": [{"input": "", "expectedOutput": ""}],
        "timeoutMs": 500,
    })
    data = resp.json()
    assert data["timedOut"] is True
