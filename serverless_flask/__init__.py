from flask import Flask, request
import os
import json
import logging

DEFAULT_CACHE_DURATION = 300


def ensure_secret_key_exists(app: Flask):
    import boto3
    import botocore
    import secrets

    # this is where the session secret goes
    key = "SECRET_KEY"
    s3 = boto3.resource("s3")
    bucket = app.config["S3_BUCKET"]
    obj = s3.Object(bucket, key)

    try:
        app.logger.debug(f"ensure_secret_key_exists: Checking for s3 bucket {bucket}")
        resp = obj.get()
        # the key already exists, so use that instead.
        app.config["SECRET_KEY"] = resp["Body"].read().decode("utf-8")
    except botocore.exceptions.ClientError as ex:
        if ex.response["Error"]["Code"] == "NoSuchKey":
            app.config["SECRET_KEY"] = secrets.token_hex()
            obj.put(Body=app.config["SECRET_KEY"].encode("utf-8"))
            app.logger.info("Created a new SECRET_KEY")
        else:
            raise


def create_app(config_overrides={}) -> Flask:
    app = Flask("serverless-flask")
    # Apply a JSON config override from env var if exists
    if os.environ.get("JSON_CONFIG_OVERRIDE"):
        app.config.update(json.loads(os.environ.get("JSON_CONFIG_OVERRIDE")))

    if os.environ.get("DEBUG", False):
        app.logger.setLevel(logging.DEBUG)

    app.config.update(config_overrides)

    import serverless_flask.pages.index

    app.register_blueprint(serverless_flask.pages.index.app)

    app.logger.debug("Config is: %r" % app.config)

    if not app.config.get("UNITTEST", False):
        ensure_secret_key_exists(app)

    cacheable_methods = set(["GET", "HEAD"])

    @app.after_request
    def after_request(response):
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["Content-Security-Policy"] = "frame-ancestors self"
        if request.method not in cacheable_methods:
            # don't cache if logged in or not cacheable
            response.headers["Cache-Control"] = "no-store"
        elif not response.headers.get("Cache-Control", False):
            # cache for 5 minutes by default, unless otherwise specified.
            response.headers["Cache-Control"] = "public, max-age=300"
        app.logger.info(
            "[from:%s|%s %s]+[%s]=>[%d|%dbytes]"
            % (
                request.remote_addr,
                request.method,
                request.url,
                request.data,
                response.status_code,
                response.content_length,
            )
        )
        return response

    return app
