"""add invoices.patient_id

Revision ID: 0002_add_invoice_patient_id
Revises: 0001_initial_schema
Create Date: 2026-08-21

Closes a model/schema drift that took the whole Billing page down in production.

``models/billing.py`` declares ``Invoice.patient_id``, but the baseline schema
never created the column, and no follow-up migration added it. Every query
SQLAlchemy emitted for the Invoice model therefore selected a column Postgres
did not have:

    asyncpg.exceptions.UndefinedColumnError:
        column invoices.patient_id does not exist

which surfaced as a 500 on ``GET /api/v1/billing/today`` — and, because that
500 escaped above the CORS layer, reached the browser as an opaque
"AxiosError: Network Error" with no status to diagnose.

The column is nullable with an index, matching the model exactly. Existing rows
keep NULL; nothing needs backfilling, since invoices were already keyed to
patients through ``consultation_firestore_id``.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_add_invoice_patient_id"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "invoices",
        sa.Column("patient_id", sa.String(length=128), nullable=True),
    )
    op.create_index("ix_invoices_patient_id", "invoices", ["patient_id"])


def downgrade() -> None:
    op.drop_index("ix_invoices_patient_id", table_name="invoices")
    op.drop_column("invoices", "patient_id")
