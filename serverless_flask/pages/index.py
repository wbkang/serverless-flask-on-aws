from flask import Blueprint, render_template, current_app, make_response
import time

app = Blueprint("index", __name__, template_folder="../templates")


@app.route("/")
def index():
    return render_template("index.html", app=current_app, time=round(time.time()))


@app.route("/example_json_api")
def example_json_api():
    resp = make_response({"body": "ok", "time": round(time.time())})
    resp.headers["Content-Type"] = "application/json"
    return resp


@app.route("/example_json_api_no_cache")
def example_json_api_no_cache():
    resp = make_response({"body": "ok", "time": round(time.time())})
    resp.headers["Content-Type"] = "application/json"
    resp.headers["Cache-Control"] = "no-store, max-age=0"
    return resp
