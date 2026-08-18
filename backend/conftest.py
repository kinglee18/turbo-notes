import factory
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from notes.models import Category, Note

User = get_user_model()


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    email = factory.Sequence(lambda n: f"user{n}@example.com")

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "sup3r-s3cret-pw")
        return model_class.objects.create_user(*args, password=password, **kwargs)


class NoteFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Note

    user = factory.SubFactory(UserFactory)
    category = factory.LazyFunction(lambda: Category.objects.get(slug="random-thoughts"))
    title = factory.Sequence(lambda n: f"Note {n}")
    body = "Some cozy thoughts."


@pytest.fixture(autouse=True)
def _reset_throttles():
    """DRF stores throttle history in the cache, which outlives a test.

    Without this, the auth rate limit leaks across tests and whichever ones
    happen to run later fail with 429.
    """
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    return UserFactory()


@pytest.fixture
def other_user(db):
    return UserFactory()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def auth_api(api, user):
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def categories(db):
    """The four rows the data migration seeds, keyed by slug."""
    return {c.slug: c for c in Category.objects.all()}
