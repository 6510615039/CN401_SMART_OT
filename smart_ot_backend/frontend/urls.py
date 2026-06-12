from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('forgot-password/', views.forgot_password_view, name='forgot_password'),
    path('profile/', views.profile_view, name='profile'),

    # OT
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

    # Other roles
    path('head/', views.head_dashboard, name='head_dashboard'),
    path('rep/', views.rep_dashboard, name='rep_dashboard'),
    path('checker/', views.checker_dashboard, name='checker_dashboard'),
    path('exec/', views.exec_dashboard, name='exec_dashboard'),
]
