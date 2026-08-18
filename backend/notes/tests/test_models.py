import pytest

from conftest import NoteFactory
from notes.models import Category, Note

pytestmark = pytest.mark.django_db


class TestCategorySeed:
    def test_the_four_design_categories_exist(self):
        assert set(Category.objects.values_list("slug", flat=True)) == {
            "random-thoughts",
            "school",
            "personal",
            "drama",
        }

    def test_categories_come_back_in_design_order(self):
        assert list(Category.objects.values_list("slug", flat=True)) == [
            "random-thoughts",
            "school",
            "personal",
            "drama",
        ]


class TestSoftDelete:
    def test_default_manager_hides_deleted_notes(self, user):
        note = NoteFactory(user=user)
        note.soft_delete()

        assert not Note.objects.filter(pk=note.pk).exists()
        assert Note.all_objects.filter(pk=note.pk).exists()

    def test_restore_makes_a_note_visible_again(self, user):
        note = NoteFactory(user=user)
        note.soft_delete()
        note.restore()

        assert Note.objects.filter(pk=note.pk).exists()

    def test_deleting_a_user_removes_their_notes(self, user):
        NoteFactory(user=user)
        user.delete()
        assert Note.all_objects.count() == 0


class TestNoteDefaults:
    def test_title_and_body_default_to_empty(self, user, categories):
        note = Note.objects.create(user=user, category=categories["school"])
        assert note.title == ""
        assert note.body == ""

    def test_id_is_a_uuid_not_a_sequence(self, user):
        note = NoteFactory(user=user)
        assert "-" in str(note.id) and len(str(note.id)) == 36
