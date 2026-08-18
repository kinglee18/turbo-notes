import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Category(models.Model):
    """Reference data, not tenant data: the same four rows for every user.

    Colors deliberately live in the frontend design tokens keyed by ``slug``,
    not here. Each category needs several derived shades (card fill, border,
    dot), and a ``color_hex`` column would be a second source of truth that
    drifts from the CSS.
    """

    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=50)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class NoteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(deleted_at__isnull=True)


class NoteManager(models.Manager.from_queryset(NoteQuerySet)):
    """Default manager: soft-deleted notes are invisible."""

    def get_queryset(self):
        return super().get_queryset().alive()


class Note(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes"
    )
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="notes")
    # Both blank-allowed: a freshly created note is legitimately empty.
    title = models.CharField(max_length=255, blank=True, default="")
    body = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = NoteManager()
    all_objects = models.Manager()  # noqa: DJ012 — second manager, not a field

    class Meta:
        # The -id tiebreak keeps pagination stable when timestamps collide.
        ordering = ["-updated_at", "-id"]
        indexes = [
            models.Index(
                fields=["user", "-updated_at"],
                name="note_user_recent_idx",
                condition=Q(deleted_at__isnull=True),
            ),
            models.Index(
                fields=["user", "category", "-updated_at"],
                name="note_user_cat_idx",
                condition=Q(deleted_at__isnull=True),
            ),
        ]

    def __str__(self):
        return self.title or "(untitled)"

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self):
        self.deleted_at = None
        self.save(update_fields=["deleted_at", "updated_at"])
