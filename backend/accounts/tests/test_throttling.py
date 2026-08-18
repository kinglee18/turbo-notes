import pytest

pytestmark = pytest.mark.django_db


def test_login_is_rate_limited(api, user):
    """Brute-forcing a password should hit a wall. Configured at 10/min."""
    payload = {"email": user.email, "password": "wrong-password"}
    statuses = [api.post("/api/auth/login/", payload, format="json").status_code for _ in range(12)]

    assert 429 in statuses
    assert statuses.count(400) == 10
