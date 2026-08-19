"""The seeded demo account is a reviewer's first impression of the app.

If this command breaks, `make demo-data` silently produces an empty grid
instead of the design, so it is worth pinning.
"""

from io import StringIO

import pytest
from django.contrib.auth import authenticate, get_user_model
from django.core.management import call_command

from conftest import NoteFactory
from notes.management.commands.demo_data import DEMO_EMAIL, DEMO_PASSWORD, NOTES
from notes.models import Note

pytestmark = pytest.mark.django_db
User = get_user_model()


def seed() -> str:
    out = StringIO()
    call_command("demo_data", stdout=out)
    return out.getvalue()


def demo_user():
    return User.objects.get(email=DEMO_EMAIL)


class TestSeeding:
    def test_creates_the_demo_account(self):
        seed()
        assert User.objects.filter(email=DEMO_EMAIL).exists()

    def test_seeds_a_full_grid_rather_than_an_empty_state(self):
        seed()
        assert demo_user().notes.count() == len(NOTES) == 12

    def test_the_documented_password_actually_works(self):
        """The README hands this password to reviewers; it has to log in."""
        seed()
        assert authenticate(username=DEMO_EMAIL, password=DEMO_PASSWORD) is not None

    def test_every_category_is_represented(self):
        seed()
        slugs = set(demo_user().notes.values_list("category__slug", flat=True))
        assert slugs == {"random-thoughts", "school", "personal", "drama"}

    def test_notes_carry_content_worth_looking_at(self):
        seed()
        assert all(note.title and note.body for note in demo_user().notes.all())

    def test_some_notes_use_bullets_so_the_cards_show_lists(self):
        seed()
        bodies = demo_user().notes.values_list("body", flat=True)
        assert any(body.startswith("- ") for body in bodies)

    def test_it_reports_what_it_did(self):
        assert "demo@turbo.notes" in seed()


class TestDatesAreSpread:
    """auto_now would stamp every note "now", which the command works around.

    Without that workaround the grid shows twelve identical "today" labels
    instead of the range in the design, so it gets its own tests.
    """

    def test_notes_do_not_all_share_one_timestamp(self):
        seed()
        assert len(set(demo_user().notes.values_list("updated_at", flat=True))) > 1

    def test_the_oldest_note_is_weeks_back(self):
        seed()
        notes = demo_user().notes.order_by("updated_at")
        span = notes.last().updated_at - notes.first().updated_at
        assert span.days >= 14

    def test_the_newest_note_is_today(self):
        """The grid's first card should read "today", not a date."""
        from django.utils import timezone

        seed()
        newest = demo_user().notes.order_by("-updated_at").first()
        assert newest.updated_at.date() == timezone.now().date()


class TestRerunning:
    def test_running_twice_does_not_duplicate_the_notes(self):
        seed()
        seed()
        assert demo_user().notes.count() == len(NOTES)

    def test_running_twice_does_not_duplicate_the_account(self):
        seed()
        seed()
        assert User.objects.filter(email=DEMO_EMAIL).count() == 1

    def test_it_clears_notes_left_over_from_a_previous_run(self):
        seed()
        stale = NoteFactory(user=demo_user(), title="Left over from last time")

        seed()

        assert not Note.all_objects.filter(pk=stale.pk).exists()

    def test_it_clears_soft_deleted_notes_too(self):
        """A soft delete would otherwise accumulate invisibly across runs."""
        seed()
        deleted = NoteFactory(user=demo_user())
        deleted.soft_delete()

        seed()

        assert not Note.all_objects.filter(pk=deleted.pk).exists()

    def test_it_leaves_other_users_notes_alone(self, user):
        mine = NoteFactory(user=user, title="Not the demo account's")

        seed()

        assert Note.objects.filter(pk=mine.pk).exists()

    def test_it_resets_the_password_on_an_existing_account(self):
        seed()
        stale = demo_user()
        stale.set_password("something-else-entirely")
        stale.save()

        seed()

        assert authenticate(username=DEMO_EMAIL, password=DEMO_PASSWORD) is not None
