from __future__ import unicode_literals
from serverless_flask import create_app
from flask import Flask
from flask.testing import FlaskClient
import pytest

@pytest.fixture
def test_app() -> Flask:
    app = create_app({
        "DEBUG": False,
        "UNITTEST": True,
        "SEND_FILE_MAX_AGE_DEFAULT": 300,
        "PERMANENT_SESSION_LIFETIME": 86400})

    return app

@pytest.fixture
def test_client(test_app: Flask) -> FlaskClient:
    test_app.config["SERVER_NAME"] = "unittest.example.com"
    with test_app.test_client() as c:
        yield c

