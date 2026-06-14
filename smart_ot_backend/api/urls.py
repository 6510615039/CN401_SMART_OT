from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('users',          views.UserViewSet,          basename='users')
router.register('departments',    views.DepartmentViewSet,    basename='departments')
router.register('ot-requests',    views.OTRequestViewSet,     basename='ot-requests')
router.register('holidays',       views.HolidayViewSet,       basename='holidays')
router.register('import-history', views.ImportHistoryViewSet, basename='import-history')
router.register('audit-log',      views.AuditLogViewSet,      basename='audit-log')

urlpatterns = [
    # Auth
    path('auth/login/',   views.login_view),
    path('auth/refresh/', views.refresh_token_view),
    path('auth/me/',      views.me_view),
    path('auth/logout/',  views.logout_view),

    # Settings & Import
    path('settings/',       views.settings_view),
    path('timelog/import/', views.import_timelog),
    path('admin/import-staff/', views.import_staff_roster),
    path('timelog/list/',   views.timelog_list_view),
    path('timelog/my/',     views.timelog_my_view),
    path('admin/summary/',          views.admin_summary_view),
    path('admin/fix-departments/',  views.fix_user_departments),
    path('admin/test-tu-api/',      views.test_tu_api),
    path('admin/test-tu-auth/',     views.test_tu_auth),
    path('staff/summary/',          views.staff_summary_view),
    path('admin/seed-holidays/',    views.seed_holidays_view),
    # Bulk forward (deptrep → checker) + email notification
    path('ot-requests/bulk-forward/',       views.bulk_forward_view),
    # OT Deadline
    path('ot-deadline/',                    views.deadline_list_view),
    path('ot-deadline/set/',                views.deadline_upsert_view),
    path('ot-deadline/<int:pk>/delete/',    views.deadline_delete_view),

    # Router
    path('', include(router.urls)),
]
