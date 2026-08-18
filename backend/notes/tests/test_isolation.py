"""One user must never be able to reach another user's notes.

These assert 404 rather than 403 throughout: a 403 would confirm the note
exists, which is itself a leak.
"""

import pytest

from conftest import NoteFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def foreign_note(other_user):
    return NoteFactory(user=other_user)


def test_list_excludes_other_users_notes(auth_api, foreign_note):
    response = auth_api.get("/api/notes/")
    assert response.status_code == 200
    assert response.data["results"] == []


@pytest.mark.parametrize(
    "method,payload",
    [("get", None), ("patch", {"title": "hijacked"}), ("delete", None)],
)
def test_other_users_note_is_not_found(auth_api, foreign_note, method, payload):
    url = f"/api/notes/{foreign_note.id}/"
    response = getattr(auth_api, method)(url, payload, format="json")
    assert response.status_code == 404


def test_patch_does_not_modify_the_other_users_note(auth_api, foreign_note):
    auth_api.patch(f"/api/notes/{foreign_note.id}/", {"title": "hijacked"}, format="json")
    foreign_note.refresh_from_db()
    assert foreign_note.title != "hijacked"


def test_client_cannot_assign_ownership_on_create(auth_api, user, other_user):
    response = auth_api.post(
        "/api/notes/",
        {"category": "school", "title": "Mine", "user": other_user.id},
        format="json",
    )
    assert response.status_code == 201
    from notes.models import Note

    assert Note.objects.get(id=response.data["id"]).user == user


def test_restore_of_a_foreign_note_is_not_found(auth_api, foreign_note):
    foreign_note.soft_delete()
    response = auth_api.post(f"/api/notes/{foreign_note.id}/restore/")
    assert response.status_code == 404


def test_anonymous_access_is_rejected(api):
    assert api.get("/api/notes/").status_code == 401
    assert api.get("/api/categories/").status_code == 401
