import pytest

from conftest import NoteFactory
from notes.models import Note

pytestmark = pytest.mark.django_db


class TestCategoryCounts:
    def test_counts_are_per_user(self, auth_api, user, other_user, categories):
        NoteFactory.create_batch(2, user=user, category=categories["school"])
        NoteFactory.create_batch(5, user=other_user, category=categories["school"])

        counts = {c["slug"]: c["note_count"] for c in auth_api.get("/api/categories/").data}
        assert counts["school"] == 2
        assert counts["personal"] == 0

    def test_soft_deleted_notes_are_excluded(self, auth_api, user, categories):
        notes = NoteFactory.create_batch(3, user=user, category=categories["drama"])
        notes[0].soft_delete()

        counts = {c["slug"]: c["note_count"] for c in auth_api.get("/api/categories/").data}
        assert counts["drama"] == 2

    def test_all_four_categories_are_always_returned(self, auth_api):
        assert len(auth_api.get("/api/categories/").data) == 4

    def test_categories_keep_design_order_despite_the_annotation(self, auth_api):
        """annotate() adds a GROUP BY that drops the model's Meta.ordering."""
        slugs = [c["slug"] for c in auth_api.get("/api/categories/").data]
        assert slugs == ["random-thoughts", "school", "personal", "drama"]

    def test_counts_cost_a_single_query(
        self, auth_api, user, categories, django_assert_num_queries
    ):
        NoteFactory.create_batch(6, user=user)
        # One annotated aggregate, no per-category follow-up.
        with django_assert_num_queries(1):
            auth_api.get("/api/categories/")


class TestFiltering:
    def test_filters_by_category_slug(self, auth_api, user, categories):
        NoteFactory(user=user, category=categories["school"], title="Homework")
        NoteFactory(user=user, category=categories["personal"], title="Diary")

        results = auth_api.get("/api/notes/?category=school").data["results"]
        assert [n["title"] for n in results] == ["Homework"]

    def test_unknown_slug_is_a_client_error(self, auth_api):
        assert auth_api.get("/api/notes/?category=nope").status_code == 400

    def test_search_matches_title_and_body(self, auth_api, user):
        NoteFactory(user=user, title="Grocery List", body="milk")
        NoteFactory(user=user, title="Vacation", body="buy grocery bags")
        NoteFactory(user=user, title="Unrelated", body="nothing")

        results = auth_api.get("/api/notes/?q=grocery").data["results"]
        assert {n["title"] for n in results} == {"Grocery List", "Vacation"}

    def test_search_is_case_insensitive(self, auth_api, user):
        NoteFactory(user=user, title="Grocery List")
        assert len(auth_api.get("/api/notes/?q=GROCERY").data["results"]) == 1

    def test_notes_are_ordered_most_recently_updated_first(self, auth_api, user):
        first = NoteFactory(user=user, title="First")
        NoteFactory(user=user, title="Second")
        first.title = "First, edited"
        first.save()

        results = auth_api.get("/api/notes/").data["results"]
        assert results[0]["title"] == "First, edited"


class TestAutosavePatchSemantics:
    def test_partial_update_leaves_other_fields_alone(self, auth_api, user):
        note = NoteFactory(user=user, title="Keep me", body="Original body")

        auth_api.patch(f"/api/notes/{note.id}/", {"body": "New body"}, format="json")

        note.refresh_from_db()
        assert note.title == "Keep me"
        assert note.body == "New body"

    def test_a_real_change_advances_updated_at(self, auth_api, user):
        note = NoteFactory(user=user, title="Before")
        original = note.updated_at

        auth_api.patch(f"/api/notes/{note.id}/", {"title": "After"}, format="json")

        note.refresh_from_db()
        assert note.updated_at > original

    def test_an_identical_payload_does_not_advance_updated_at(self, auth_api, user):
        """A no-op autosave must not make "Last Edited" lie."""
        note = NoteFactory(user=user, title="Same")
        original = note.updated_at

        response = auth_api.patch(f"/api/notes/{note.id}/", {"title": "Same"}, format="json")

        assert response.status_code == 200
        note.refresh_from_db()
        assert note.updated_at == original

    def test_category_can_be_changed_by_slug(self, auth_api, user, categories):
        note = NoteFactory(user=user, category=categories["school"])

        auth_api.patch(f"/api/notes/{note.id}/", {"category": "drama"}, format="json")

        note.refresh_from_db()
        assert note.category.slug == "drama"

    def test_unknown_category_slug_is_rejected(self, auth_api, user):
        note = NoteFactory(user=user)
        response = auth_api.patch(f"/api/notes/{note.id}/", {"category": "nope"}, format="json")
        assert response.status_code == 400


class TestCreateAndDelete:
    def test_a_new_note_may_be_empty(self, auth_api):
        """ "+ New Note" POSTs before the user has typed anything."""
        response = auth_api.post("/api/notes/", {"category": "personal"}, format="json")
        assert response.status_code == 201
        assert response.data["title"] == ""
        assert response.data["body"] == ""

    def test_delete_is_soft(self, auth_api, user):
        note = NoteFactory(user=user)

        assert auth_api.delete(f"/api/notes/{note.id}/").status_code == 204

        assert not Note.objects.filter(id=note.id).exists()
        assert Note.all_objects.filter(id=note.id).exists()

    def test_deleted_notes_disappear_from_the_list(self, auth_api, user):
        note = NoteFactory(user=user)
        auth_api.delete(f"/api/notes/{note.id}/")
        assert auth_api.get("/api/notes/").data["results"] == []

    def test_restore_brings_a_note_back(self, auth_api, user):
        note = NoteFactory(user=user, title="Undo me")
        auth_api.delete(f"/api/notes/{note.id}/")

        response = auth_api.post(f"/api/notes/{note.id}/restore/")

        assert response.status_code == 200
        assert Note.objects.filter(id=note.id).exists()
