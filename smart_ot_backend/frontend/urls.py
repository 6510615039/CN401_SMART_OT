from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('forgot-password/', views.forgot_password_view, name='forgot_password'),
    path('profile/', views.profile_view, name='profile'),
    path('switch-role/<str:role>/', views.switch_role, name='switch_role'),

    # OT Detail + Approve/Reject
    path('ot/<int:pk>/', views.ot_detail, name='ot_detail'),
    path('ot/<int:pk>/approve/', views.ot_approve, name='ot_approve'),
    path('ot/<int:pk>/reject/', views.ot_reject, name='ot_reject'),

    # Admin
    path('admin-panel/', views.admin_dashboard, name='admin_dashboard'),
    path('admin-panel/import/', views.admin_import, name='admin_import'),
    path('admin-panel/users/', views.admin_users, name='admin_users'),
    path('admin-panel/depts/', views.admin_depts, name='admin_depts'),
    path('admin-panel/holidays/', views.admin_holidays, name='admin_holidays'),
    path('admin-panel/holidays/add/', views.admin_holiday_add, name='admin_holiday_add'),
    path('admin-panel/holidays/<int:pk>/edit/', views.admin_holiday_edit, name='admin_holiday_edit'),
    path('admin-panel/holidays/<int:pk>/delete/', views.admin_holiday_delete, name='admin_holiday_delete'),
    path('admin-panel/settings/', views.admin_settings, name='admin_settings'),
    path('admin-panel/history/', views.admin_history, name='admin_history'),
    path('admin-panel/audit/', views.admin_audit, name='admin_audit'),

    # Staff
    path('staff/', views.staff_dashboard, name='staff_dashboard'),
    path('staff/timelog/', views.staff_timelog, name='staff_timelog'),
    path('staff/submit/', views.staff_submit, name='staff_submit'),
    path('staff/status/', views.staff_status, name='staff_status'),

    # DeptHead
    path('head/', views.head_dashboard, name='head_dashboard'),
    path('head/pending/', views.head_pending, name='head_pending'),
    path('head/history/', views.head_history, name='head_history'),
    path('head/members/', views.head_members, name='head_members'),
    path('head/report/', views.head_report, name='head_report'),

    # DeptRep
    path('rep/', views.rep_dashboard, name='rep_dashboard'),
    path('rep/export/', views.rep_export, name='rep_export'),
    path('rep/export/preview/', views.rep_export_preview, name='rep_export_preview'),
    path('rep/export/download/', views.rep_export_download, name='rep_export_download'),
    path('rep/forward/', views.rep_forward, name='rep_forward'),
    path('rep/history/', views.rep_history, name='rep_history'),
    path('rep/members/', views.rep_members, name='rep_members'),

    # Checker
    path('checker/', views.checker_dashboard, name='checker_dashboard'),
    path('checker/budget/', views.checker_budget, name='checker_budget'),
    path('checker/set-budget/', views.checker_set_budget, name='checker_set_budget'),
    path('checker/history/', views.checker_history, name='checker_history'),
    path('checker/report/', views.checker_report, name='checker_report'),

    # Executive
    path('exec/', views.exec_dashboard, name='exec_dashboard'),
    path('exec/trend/', views.exec_trend, name='exec_trend'),

    # Notifications (AJAX)
    path('notifications/json/', views.notifications_json, name='notifications_json'),
    path('notifications/mark-read/', views.notifications_mark_read, name='notifications_mark_read'),
]
