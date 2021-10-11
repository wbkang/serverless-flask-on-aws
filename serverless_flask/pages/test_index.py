import json
from flask.testing import FlaskClient


def test_index(test_client: FlaskClient):
    rv = test_client.get("/")
    assert "Hi! I am running on unittest.example.com" in rv.data.decode("utf-8")


def test_example_json_api(test_client: FlaskClient):
    rv = test_client.get("/example_json_api")
    assert rv.headers["Content-Type"] == "application/json"
    data = json.loads(rv.data)
    assert "body" in data
    assert data["body"] == "ok"
