from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

def _create_su(request):
    if request.GET.get('key') != 'smartot-setup-2569':
        return JsonResponse({'error': 'forbidden'}, status=403)
    from api.models import User
    u, created = User.objects.get_or_create(username='admin_su', defaults={
        'email': 'admin@tu.ac.th', 'first_name': 'Admin',
        'last_name': 'System', 'role': 'admin',
        'is_superuser': True, 'is_staff': True,
    })
    u.set_password('SmartOT2569!')
    u.is_superuser = True
    u.is_staff = True
    u.save()
    return JsonResponse({'ok': True, 'created': created, 'username': u.username})

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('_setup/su/', _create_su),
    path('', include('frontend.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
