from django.db import migrations

CATEGORIES = [
    ("random-thoughts", "Random Thoughts", 0),
    ("school", "School", 1),
    ("personal", "Personal", 2),
    ("drama", "Drama", 3),
]


def seed_categories(apps, schema_editor):
    Category = apps.get_model("notes", "Category")
    for slug, name, sort_order in CATEGORIES:
        Category.objects.update_or_create(
            slug=slug, defaults={"name": name, "sort_order": sort_order}
        )


def unseed_categories(apps, schema_editor):
    Category = apps.get_model("notes", "Category")
    Category.objects.filter(slug__in=[slug for slug, _, _ in CATEGORIES]).delete()


class Migration(migrations.Migration):
    dependencies = [("notes", "0001_initial")]

    operations = [migrations.RunPython(seed_categories, unseed_categories)]
