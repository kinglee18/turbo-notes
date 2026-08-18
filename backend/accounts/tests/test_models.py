import pytest
from django.contrib.auth import get_user_model

pytestmark = pytest.mark.django_db
User = get_user_model()


class TestUserManager:
    def test_email_is_lowercased_entirely(self):
        """Django's default only normalizes the domain, which would let
        Bob@example.com and bob@example.com both exist."""
        user = User.objects.create_user(email="Bob@Example.COM", password="pw-123-abc")
        assert user.email == "bob@example.com"

    def test_email_is_required(self):
        with pytest.raises(ValueError):
            User.objects.create_user(email="", password="pw-123-abc")

    def test_create_user_is_not_staff_or_superuser(self):
        user = User.objects.create_user(email="a@example.com", password="pw-123-abc")
        assert not user.is_staff
        assert not user.is_superuser
        assert user.is_active

    def test_create_superuser_sets_both_flags(self):
        admin = User.objects.create_superuser(email="a@example.com", password="pw-123-abc")
        assert admin.is_staff
        assert admin.is_superuser

    def test_superuser_cannot_opt_out_of_staff(self):
        with pytest.raises(ValueError):
            User.objects.create_superuser(
                email="a@example.com", password="pw-123-abc", is_staff=False
            )
