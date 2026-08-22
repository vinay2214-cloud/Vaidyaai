"""Regression test: server errors must reach the browser readable.

FastAPI installs a handler registered for bare `Exception` on Starlette's
ServerErrorMiddleware, which wraps the entire user middleware stack — above
CORSMiddleware. A 500 produced there ships without Access-Control-Allow-Origin,
the browser blocks it, and the frontend sees an opaque network failure with no
status code.

That is how a Speech-to-Text permission error and a missing database column both
reached the UI as "AxiosError: Network Error" with nothing to diagnose. Pin the
fix so a future middleware reordering cannot silently reintroduce it.
"""
import warnings

warnings.filterwarnings("ignore")

from fastapi.testclient import TestClient

import main

ORIGIN = "https://vaidyaai-frontend-353775352272.asia-south1.run.app"


@main.app.get("/__test_unhandled_error", include_in_schema=False)
async def _explode():
    raise RuntimeError("simulated unhandled failure")


def test_unhandled_500_carries_cors_headers():
    client = TestClient(main.app, raise_server_exceptions=False)
    res = client.get("/__test_unhandled_error", headers={"Origin": ORIGIN})

    assert res.status_code == 500
    # Without this header the browser discards the response and the client
    # cannot tell a server error from a dropped connection.
    assert res.headers.get("access-control-allow-origin") == ORIGIN
    assert res.json()["detail"]


def test_exception_guard_sits_inside_the_cors_layer():
    """Ordering is the mechanism; assert it directly."""
    names = [m.cls.__name__ for m in main.app.user_middleware]
    # Outermost first: tracing, CORS, then the guard.
    assert names.index("CORSMiddleware") < len(names) - 1, (
        "The exception guard must be registered before CORSMiddleware so it ends "
        f"up INSIDE it. Current stack (outermost first): {names}"
    )


def test_handled_http_errors_also_carry_cors_headers():
    client = TestClient(main.app, raise_server_exceptions=False)
    res = client.get("/api/v1/patients", headers={"Origin": ORIGIN})
    assert res.status_code in (401, 403, 422)
    assert res.headers.get("access-control-allow-origin") == ORIGIN
