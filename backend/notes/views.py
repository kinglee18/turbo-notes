from django.db.models import Count, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Category, Note
from .serializers import CategorySerializer, NoteSerializer


class CategoryListView(APIView):
    """The sidebar: four categories, each with this user's note count."""

    def get(self, request):
        categories = Category.objects.annotate(
            note_count=Count(
                "notes",
                filter=Q(notes__user=request.user, notes__deleted_at__isnull=True),
            )
        )
        return Response(CategorySerializer(categories, many=True).data)


@extend_schema(
    parameters=[
        OpenApiParameter("category", str, description="Filter by category slug."),
        OpenApiParameter("q", str, description="Search title and body."),
    ]
)
class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer

    def get_queryset(self):
        # Scoping lives here rather than in an object permission, so another
        # user's note is a 404 and its existence never leaks.
        qs = Note.objects.filter(user=self.request.user).select_related("category")

        slug = self.request.query_params.get("category")
        if slug:
            if not Category.objects.filter(slug=slug).exists():
                raise ValidationError({"category": f"Unknown category '{slug}'."})
            qs = qs.filter(category__slug=slug)

        search = self.request.query_params.get("q")
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(body__icontains=search))

        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        # Skip the write entirely when nothing actually changed, so `updated_at`
        # stays truthful and a no-op autosave never bumps "Last Edited".
        instance = serializer.instance
        unchanged = all(
            getattr(instance, field) == value for field, value in serializer.validated_data.items()
        )
        if unchanged:
            return
        serializer.save()

    def perform_destroy(self, instance):
        instance.soft_delete()

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """Undo a delete. Bypasses the default manager, which hides soft-deleted rows."""
        note = Note.all_objects.filter(user=request.user, pk=pk).first()
        if note is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        note.restore()
        return Response(NoteSerializer(note).data)
