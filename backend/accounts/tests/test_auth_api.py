import pytest
from django.contrib.auth import get_user_model

from conftest import UserFactory

pytestmark = pytest.mark.django_db
User = get_user_model()

STRONG_PASSWORD = "sup3r-s3cret-pw"


class TestRegister:
    def test_creates_an_account_and_returns_tokens(self, api):
        response = api.post(
            "/api/auth/register/",
            {"email": "new@example.com", "password": STRONG_PASSWORD},
            format="json",
        )

        assert response.status_code == 201
        assert response.data["user"]["email"] == "new@example.com"
        assert "access" in response.data and "refresh" in response.data
        assert User.objects.filter(email="new@example.com").exists()

    def test_password_is_hashed(self, api):
        api.post(
            "/api/auth/register/",
            {"email": "new@example.com", "password": STRONG_PASSWORD},
            format="json",
        )
        assert User.objects.get(email="new@example.com").password != STRONG_PASSWORD

    def test_weak_password_is_rejected(self, api):
        response = api.post(
            "/api/auth/register/",
            {"email": "new@example.com", "password": "123"},
            format="json",
        )
        assert response.status_code == 400
        assert not User.objects.filter(email="new@example.com").exists()

    def test_duplicate_email_is_rejected(self, api, user):
        response = api.post(
            "/api/auth/register/",
            {"email": user.email, "password": STRONG_PASSWORD},
            format="json",
        )
        assert response.status_code == 400

    def test_email_collision_is_case_insensitive(self, api):
        UserFactory(email="taken@example.com")
        response = api.post(
            "/api/auth/register/",
            {"email": "TAKEN@example.com", "password": STRONG_PASSWORD},
            format="json",
        )
        assert response.status_code == 400


class TestLogin:
    def test_correct_credentials_return_tokens(self, api, user):
        response = api.post(
            "/api/auth/login/",
            {"email": user.email, "password": STRONG_PASSWORD},
            format="json",
        )
        assert response.status_code == 200
        assert "access" in response.data

    def test_login_is_case_insensitive_on_email(self, api, user):
        response = api.post(
            "/api/auth/login/",
            {"email": user.email.upper(), "password": STRONG_PASSWORD},
            format="json",
        )
        assert response.status_code == 200

    def test_wrong_password_is_rejected(self, api, user):
        response = api.post(
            "/api/auth/login/",
            {"email": user.email, "password": "not-the-password"},
            format="json",
        )
        assert response.status_code == 400

    def test_unknown_email_gives_the_same_error_as_a_wrong_password(self, api, user):
        """Don't let the error message reveal whether an account exists."""
        unknown = api.post(
            "/api/auth/login/",
            {"email": "nobody@example.com", "password": STRONG_PASSWORD},
            format="json",
        )
        wrong = api.post(
            "/api/auth/login/",
            {"email": user.email, "password": "not-the-password"},
            format="json",
        )
        assert unknown.status_code == wrong.status_code == 400
        assert str(unknown.data) == str(wrong.data)


class TestTokenLifecycle:
    def _tokens(self, api, user):
        return api.post(
            "/api/auth/login/",
            {"email": user.email, "password": STRONG_PASSWORD},
            format="json",
        ).data

    def test_refresh_issues_a_new_access_token(self, api, user):
        refresh = self._tokens(api, user)["refresh"]

        response = api.post("/api/auth/refresh/", {"refresh": refresh}, format="json")

        assert response.status_code == 200
        assert "access" in response.data

    def test_rotated_refresh_token_cannot_be_reused(self, api, user):
        refresh = self._tokens(api, user)["refresh"]
        api.post("/api/auth/refresh/", {"refresh": refresh}, format="json")

        replayed = api.post("/api/auth/refresh/", {"refresh": refresh}, format="json")

        assert replayed.status_code == 401

    def test_garbage_refresh_token_is_rejected(self, api):
        response = api.post("/api/auth/refresh/", {"refresh": "nonsense"}, format="json")
        assert response.status_code == 401

    def test_logout_blacklists_the_refresh_token(self, api, user):
        tokens = self._tokens(api, user)
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        assert (
            api.post("/api/auth/logout/", {"refresh": tokens["refresh"]}, format="json").status_code
            == 204
        )

        api.credentials()
        replayed = api.post("/api/auth/refresh/", {"refresh": tokens["refresh"]}, format="json")
        assert replayed.status_code == 401

    def test_access_token_authenticates_me(self, api, user):
        tokens = self._tokens(api, user)
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

        response = api.get("/api/auth/me/")

        assert response.status_code == 200
        assert response.data["email"] == user.email

    def test_me_requires_authentication(self, api):
        assert api.get("/api/auth/me/").status_code == 401
