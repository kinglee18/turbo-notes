"""Seed a demo account so a reviewer sees a full grid instead of an empty state."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from notes.models import Category, Note

User = get_user_model()

DEMO_EMAIL = "demo@turbo.notes"
DEMO_PASSWORD = "cozy-notes-2024"

# (category slug, title, body, days ago)
NOTES = [
    ("random-thoughts", "Grocery List", "- Milk\n- Eggs\n- Bread\n- Bananas\n- Spinach", 0),
    (
        "school",
        "Meeting with Team",
        "Discuss project timeline and milestones. Review budget and resource "
        "allocation. Address any blockers and plan next steps.",
        1,
    ),
    (
        "random-thoughts",
        "Vacation Ideas",
        "- Visit Bali for beaches and culture\n- Explore the historic sites in Rome\n"
        "- Go hiking in the Swiss Alps\n- Relax in the hot springs of Iceland",
        3,
    ),
    (
        "personal",
        "Books to Read",
        "Lately, I've been on a quest to discover new books to read. I've come across "
        'several recommendations that have piqued my interest. "The Alchemist" by '
        "Paulo Coelho is at the top of my list, given its reputation as a "
        'life-changing read. I\'ve also heard great things about "Educated" by Tara '
        'Westover and "Becoming" by Michelle Obama.',
        5,
    ),
    (
        "random-thoughts",
        "A Deep and Contemplative Personal Reflection on the Multifaceted and "
        "Ever-Evolving Journey of Life",
        "Life has been a whirlwind of events and emotions lately. I've been juggling "
        "work, personal projects, and relationships, often feeling like there aren't "
        "enough hours in the day. It's in these moments that I remind myself of the "
        "importance of self-care and mindfulness. Work has been particularly "
        "demanding with multiple projects running simultaneously. The satisfaction "
        "of completing tasks and achieving milestones is immense, but it also comes "
        "with its fair share of stress.",
        6,
    ),
    (
        "school",
        "Project X Updates",
        "Finalized design mockups and received approval from stakeholders. Began "
        "development on the front-end. Backend integration is scheduled for next "
        "week. Team is on track to meet the deadline.",
        7,
    ),
    ("drama", "That Thing At Brunch", "I am still thinking about it. Unbelievable.", 8),
    (
        "personal",
        "Morning Routine",
        "- Wake at 6:30\n- Stretch for ten minutes\n- Coffee, no phone\n- Write one page",
        10,
    ),
    (
        "school",
        "Reading List for Term 2",
        "- Chapter 4 through 9\n- The lab handout\n- Two case studies",
        12,
    ),
    (
        "random-thoughts",
        "Song Ideas",
        "Something in a minor key, slow, with brushes on the snare.",
        14,
    ),
    ("drama", "Group Chat Saga", "Renamed the group chat three times today. Nobody noticed.", 16),
    ("personal", "Gratitude", "The light in the kitchen at 4pm. Cold water. A good pen.", 20),
]


class Command(BaseCommand):
    help = "Create (or refresh) the demo account and its notes."

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(email=DEMO_EMAIL)
        user.set_password(DEMO_PASSWORD)
        user.save()

        Note.all_objects.filter(user=user).delete()

        categories = {c.slug: c for c in Category.objects.all()}
        now = timezone.now()
        for slug, title, body, days_ago in NOTES:
            note = Note.objects.create(user=user, category=categories[slug], title=title, body=body)
            # auto_now would stamp all of these "now"; the grid is much more
            # convincing with dates spread across a few weeks.
            Note.objects.filter(pk=note.pk).update(
                created_at=now - timedelta(days=days_ago),
                updated_at=now - timedelta(days=days_ago),
            )

        verb = "Created" if created else "Refreshed"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {DEMO_EMAIL} (password: {DEMO_PASSWORD}) with {len(NOTES)} notes."
            )
        )
