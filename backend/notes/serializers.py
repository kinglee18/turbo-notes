from rest_framework import serializers

from .models import Category, Note


class CategorySerializer(serializers.ModelSerializer):
    note_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Category
        fields = ["slug", "name", "note_count"]


class NoteSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(slug_field="slug", queryset=Category.objects.all())

    class Meta:
        model = Note
        fields = ["id", "category", "title", "body", "created_at", "updated_at"]
        # `user` is deliberately absent: ownership comes from request.user in
        # perform_create and can never be set by the client.
        read_only_fields = ["id", "created_at", "updated_at"]
