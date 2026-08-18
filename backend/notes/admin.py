from django.contrib import admin

from .models import Category, Note


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "slug", "sort_order"]


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ["__str__", "user", "category", "updated_at", "deleted_at"]
    list_filter = ["category", "deleted_at"]
    search_fields = ["title", "body"]
    raw_id_fields = ["user"]

    def get_queryset(self, request):
        return Note.all_objects.select_related("user", "category")
