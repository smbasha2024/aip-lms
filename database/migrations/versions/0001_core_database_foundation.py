"""core_database_foundation

Revision ID: 0001
Revises: None
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "department",
        sa.Column("department_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name=op.f("ck_department_status")),
        sa.CheckConstraint("code = upper(code)", name=op.f("ck_department_code_uppercase")),
        sa.PrimaryKeyConstraint("department_id", name=op.f("pk_department")),
        sa.UniqueConstraint("code", name="uq_department_code"),
    )
    op.create_table(
        "employee",
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("employee_code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("department_id", sa.Uuid(), nullable=False),
        sa.Column("manager_id", sa.Uuid(), nullable=True),
        sa.Column("joining_date", sa.Date(), nullable=False),
        sa.Column("designation", sa.String(length=150), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "employee_code = upper(employee_code) AND position('@' in employee_code) = 0",
            name=op.f("ck_employee_code_normalized"),
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED')",
            name=op.f("ck_employee_status"),
        ),
        sa.CheckConstraint("email = lower(email)", name=op.f("ck_employee_email_lowercase")),
        sa.CheckConstraint(
            "manager_id IS NULL OR manager_id <> employee_id",
            name=op.f("ck_employee_manager_not_self"),
        ),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["department.department_id"],
            name="fk_employee_department_id_department",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["manager_id"],
            ["employee.employee_id"],
            name="fk_employee_manager_id_employee",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("employee_id", name=op.f("pk_employee")),
        sa.UniqueConstraint("email", name="uq_employee_email"),
        sa.UniqueConstraint("employee_code", name="uq_employee_employee_code"),
    )
    op.create_index("ix_employee_department_id", "employee", ["department_id"], unique=False)
    op.create_index("ix_employee_manager_id", "employee", ["manager_id"], unique=False)
    op.create_index("ix_employee_status", "employee", ["status"], unique=False)
    op.create_table(
        "app_user",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "role IN ('EMPLOYEE', 'MANAGER', 'ADMINISTRATOR')", name=op.f("ck_app_user_role")
        ),
        sa.CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'LOCKED')", name=op.f("ck_app_user_status")
        ),
        sa.CheckConstraint(
            "username = lower(username)", name=op.f("ck_app_user_username_lowercase")
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employee.employee_id"],
            name="fk_app_user_employee_id_employee",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("user_id", name=op.f("pk_app_user")),
        sa.UniqueConstraint("employee_id", name="uq_app_user_employee_id"),
        sa.UniqueConstraint("username", name="uq_app_user_username"),
    )
    op.create_index("ix_app_user_role_status", "app_user", ["role", "status"], unique=False)
    op.create_table(
        "auth_session",
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "token_hash ~ '^[0-9a-f]{64}$'", name=op.f("ck_auth_session_token_hash_hex")
        ),
        sa.CheckConstraint("expires_at > created_at", name=op.f("ck_auth_session_expiry")),
        sa.CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at",
            name=op.f("ck_auth_session_revocation"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app_user.user_id"],
            name="fk_auth_session_user_id_app_user",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("session_id", name=op.f("pk_auth_session")),
        sa.UniqueConstraint("token_hash", name="uq_auth_session_token_hash"),
    )
    op.create_index("ix_auth_session_expires_at", "auth_session", ["expires_at"], unique=False)
    op.create_index("ix_auth_session_user_id", "auth_session", ["user_id"], unique=False)
    op.create_table(
        "leave_type",
        sa.Column("leave_type_id", sa.Uuid(), nullable=False),
        sa.Column("code", sa.String(length=30), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_paid", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "allow_employee_application",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("allow_half_day", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "requires_approval", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name=op.f("ck_leave_type_status")),
        sa.CheckConstraint("allow_half_day = false", name=op.f("ck_leave_type_whole_days_only")),
        sa.CheckConstraint("code = upper(code)", name=op.f("ck_leave_type_code_uppercase")),
        sa.CheckConstraint(
            "requires_approval = true", name=op.f("ck_leave_type_manual_approval_only")
        ),
        sa.PrimaryKeyConstraint("leave_type_id", name=op.f("pk_leave_type")),
        sa.UniqueConstraint("code", name="uq_leave_type_code"),
    )
    op.create_table(
        "leave_balance",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("leave_type_id", sa.Uuid(), nullable=False),
        sa.Column("leave_year", sa.Integer(), nullable=False),
        sa.Column(
            "allocated",
            sa.Numeric(precision=10, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "carried_forward",
            sa.Numeric(precision=10, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "used", sa.Numeric(precision=10, scale=2), server_default=sa.text("0"), nullable=False
        ),
        sa.Column(
            "pending",
            sa.Numeric(precision=10, scale=2),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "allocated + carried_forward >= used + pending",
            name=op.f("ck_leave_balance_reservation_within_entitlement"),
        ),
        sa.CheckConstraint(
            "allocated >= 0 AND carried_forward >= 0 AND used >= 0 AND pending >= 0",
            name=op.f("ck_leave_balance_nonnegative_counters"),
        ),
        sa.CheckConstraint(
            "leave_year BETWEEN 1900 AND 9999", name=op.f("ck_leave_balance_year_range")
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employee.employee_id"],
            name="fk_leave_balance_employee_id_employee",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["leave_type_id"],
            ["leave_type.leave_type_id"],
            name="fk_leave_balance_leave_type_id_leave_type",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leave_balance")),
        sa.UniqueConstraint(
            "employee_id", "leave_type_id", "leave_year", name="uq_leave_balance_employee_type_year"
        ),
    )
    op.create_table(
        "leave_appln",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("leave_type_id", sa.Uuid(), nullable=False),
        sa.Column("leave_year", sa.Integer(), nullable=False),
        sa.Column("from_date", sa.Date(), nullable=False),
        sa.Column("to_date", sa.Date(), nullable=False),
        sa.Column("number_of_days", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
        sa.Column("manager_id", sa.Uuid(), nullable=False),
        sa.Column("approved_by", sa.Uuid(), nullable=True),
        sa.Column("rejected_by", sa.Uuid(), nullable=True),
        sa.Column("cancelled_by", sa.Uuid(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_comment", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("cancellation_reason", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            (
                "(status = 'PENDING' AND approved_by IS NULL AND approved_at IS NULL AND "
                "approval_comment IS NULL AND rejected_by IS NULL AND rejected_at IS NULL "
                "AND rejection_reason IS NULL AND cancelled_by IS NULL AND cancelled_at IS "
                "NULL AND cancellation_reason IS NULL) OR (status = 'APPROVED' AND "
                "approved_by IS NOT NULL AND approved_at IS NOT NULL AND rejected_by IS "
                "NULL AND rejected_at IS NULL AND rejection_reason IS NULL AND cancelled_by "
                "IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL AND "
                "approved_by <> employee_id) OR (status = 'REJECTED' AND rejected_by IS NOT "
                "NULL AND rejected_at IS NOT NULL AND rejection_reason IS NOT NULL AND "
                "approved_by IS NULL AND approved_at IS NULL AND approval_comment IS NULL "
                "AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason "
                "IS NULL AND rejected_by <> employee_id AND rejection_reason ~ '[^[:space:]]') "
                "OR (status = 'CANCELLED' AND cancelled_by IS NOT NULL AND cancelled_at IS "
                "NOT NULL AND approved_by IS NULL AND approved_at IS NULL AND "
                "approval_comment IS NULL AND rejected_by IS NULL AND rejected_at IS NULL "
                "AND rejection_reason IS NULL AND cancelled_by = employee_id)"
            ),
            name=op.f("ck_leave_appln_status_metadata"),
        ),
        sa.CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')",
            name=op.f("ck_leave_appln_status"),
        ),
        sa.CheckConstraint(
            "EXTRACT(YEAR FROM from_date) = leave_year AND EXTRACT(YEAR FROM to_date) = leave_year",
            name=op.f("ck_leave_appln_same_leave_year"),
        ),
        sa.CheckConstraint("from_date <= to_date", name=op.f("ck_leave_appln_ordered_dates")),
        sa.CheckConstraint(
            "manager_id <> employee_id", name=op.f("ck_leave_appln_manager_not_self")
        ),
        sa.CheckConstraint(
            "number_of_days > 0 AND number_of_days <= 366 "
            "AND number_of_days = trunc(number_of_days)",
            name=op.f("ck_leave_appln_whole_positive_days"),
        ),
        sa.ForeignKeyConstraint(
            ["approved_by"],
            ["employee.employee_id"],
            name="fk_leave_appln_approved_by_employee",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["cancelled_by"],
            ["employee.employee_id"],
            name="fk_leave_appln_cancelled_by_employee",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employee.employee_id"],
            name="fk_leave_appln_employee_id_employee",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["leave_type_id"],
            ["leave_type.leave_type_id"],
            name="fk_leave_appln_leave_type_id_leave_type",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["manager_id"],
            ["employee.employee_id"],
            name="fk_leave_appln_manager_id_employee",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["rejected_by"],
            ["employee.employee_id"],
            name="fk_leave_appln_rejected_by_employee",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leave_appln")),
    )
    op.create_index(
        "ix_leave_appln_employee_created_at",
        "leave_appln",
        ["employee_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_leave_appln_employee_dates",
        "leave_appln",
        ["employee_id", "from_date", "to_date"],
        unique=False,
    )
    op.create_index("ix_leave_appln_leave_type_id", "leave_appln", ["leave_type_id"], unique=False)
    op.create_index("ix_leave_appln_leave_year", "leave_appln", ["leave_year"], unique=False)
    op.create_index(
        "ix_leave_appln_manager_status", "leave_appln", ["manager_id", "status"], unique=False
    )
    op.create_index("ix_leave_appln_status", "leave_appln", ["status"], unique=False)
    op.create_table(
        "holiday",
        sa.Column("holiday_id", sa.Uuid(), nullable=False),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("is_optional", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="ACTIVE", nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name=op.f("ck_holiday_status")),
        sa.CheckConstraint(
            "year = EXTRACT(YEAR FROM holiday_date)", name=op.f("ck_holiday_date_year")
        ),
        sa.PrimaryKeyConstraint("holiday_id", name=op.f("pk_holiday")),
        sa.UniqueConstraint("holiday_date", name="uq_holiday_holiday_date"),
    )
    op.create_index("ix_holiday_year", "holiday", ["year"], unique=False)
    op.create_table(
        "notification",
        sa.Column("notification_id", sa.Uuid(), nullable=False),
        sa.Column("employee_id", sa.Uuid(), nullable=False),
        sa.Column("notification_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_id", sa.Uuid(), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            (
                "notification_type IN ('LEAVE_SUBMITTED', 'LEAVE_APPROVED', "
                "'LEAVE_REJECTED', 'LEAVE_CANCELLED', 'SYSTEM')"
            ),
            name=op.f("ck_notification_notification_type"),
        ),
        sa.CheckConstraint(
            "(is_read AND read_at IS NOT NULL) OR (NOT is_read AND read_at IS NULL)",
            name=op.f("ck_notification_read_metadata"),
        ),
        sa.ForeignKeyConstraint(
            ["employee_id"],
            ["employee.employee_id"],
            name="fk_notification_employee_id_employee",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("notification_id", name=op.f("pk_notification")),
    )
    op.create_index(
        "ix_notification_employee_created_at",
        "notification",
        ["employee_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_notification_employee_is_read", "notification", ["employee_id", "is_read"], unique=False
    )
    op.create_table(
        "audit_log",
        sa.Column("audit_id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("performed_by", sa.Uuid(), nullable=True),
        sa.Column(
            "old_values", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column(
            "new_values", postgresql.JSONB(none_as_null=True, astext_type=sa.Text()), nullable=True
        ),
        sa.Column("ip_address", sa.String(length=50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["performed_by"],
            ["employee.employee_id"],
            name="fk_audit_log_performed_by_employee",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("audit_id", name=op.f("pk_audit_log")),
    )
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"], unique=False)
    op.create_index("ix_audit_log_entity", "audit_log", ["entity_type", "entity_id"], unique=False)
    op.create_index("ix_audit_log_performed_by", "audit_log", ["performed_by"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_audit_log_performed_by", table_name="audit_log")
    op.drop_index("ix_audit_log_entity", table_name="audit_log")
    op.drop_index("ix_audit_log_created_at", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_index("ix_notification_employee_is_read", table_name="notification")
    op.drop_index("ix_notification_employee_created_at", table_name="notification")
    op.drop_table("notification")
    op.drop_index("ix_holiday_year", table_name="holiday")
    op.drop_table("holiday")
    op.drop_index("ix_leave_appln_status", table_name="leave_appln")
    op.drop_index("ix_leave_appln_manager_status", table_name="leave_appln")
    op.drop_index("ix_leave_appln_leave_year", table_name="leave_appln")
    op.drop_index("ix_leave_appln_leave_type_id", table_name="leave_appln")
    op.drop_index("ix_leave_appln_employee_dates", table_name="leave_appln")
    op.drop_index("ix_leave_appln_employee_created_at", table_name="leave_appln")
    op.drop_table("leave_appln")
    op.drop_table("leave_balance")
    op.drop_table("leave_type")
    op.drop_index("ix_auth_session_user_id", table_name="auth_session")
    op.drop_index("ix_auth_session_expires_at", table_name="auth_session")
    op.drop_table("auth_session")
    op.drop_index("ix_app_user_role_status", table_name="app_user")
    op.drop_table("app_user")
    op.drop_index("ix_employee_status", table_name="employee")
    op.drop_index("ix_employee_manager_id", table_name="employee")
    op.drop_index("ix_employee_department_id", table_name="employee")
    op.drop_table("employee")
    op.drop_table("department")
