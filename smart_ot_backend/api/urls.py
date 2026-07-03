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
    path('auth/login/',      views.login_view),
    path('auth/refresh/',    views.refresh_token_view),
    path('auth/me/',         views.me_view),
    path('auth/me/update/',  views.me_update_view),
    path('auth/logout/',     views.logout_view),

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
    # Bulk approve (checker) — notification รวมต่อแผนก
    path('ot-requests/bulk-approve/',       views.bulk_approve_view),
    # Budget status real-time
    path('budget-status/',                  views.budget_status_view),
    # DeptHead notify deptrep "ready to forward"
    path('notify-rep-ready/',               views.notify_rep_ready_view),
    # OT Deadline
    path('ot-deadline/',                    views.deadline_list_view),
    path('ot-deadline/set/',                views.deadline_upsert_view),
    path('ot-deadline/<int:pk>/delete/',    views.deadline_delete_view),

    # Notifications
    path('notifications/',                      views.notification_list_view),
    path('notifications/mark-read/',            views.notification_mark_read_view),
    path('notifications/mark-all-read/',        views.notification_mark_all_read_view),
    # No-OT Declaration
    path('no-ot-declaration/',                  views.no_ot_declaration_view),
    # Checker
    path('checker/budget/',                     views.checker_budget_view),
    path('checker/no-ot-departments/',          views.no_ot_departments_view),
    # Head Report
    path('head/report/',                        views.head_report_view),
    path('head/report/pdf/',                    views.head_report_pdf_view),

    # Router
    path('', include(router.urls)),
]
