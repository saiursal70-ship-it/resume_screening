"""001_initial_schema

Revision ID: 001
Revises: 
Create Date: 2026-10-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("role IN ('hr', 'viewer')", name='check_user_role'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email', name='uq_users_email'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # 2. jobs table
    op.create_table(
        'jobs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='draft', nullable=False),
        sa.Column('requirements_confirmed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('draft', 'open')", name='check_job_status'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    # 3. requirements table
    op.create_table(
        'requirements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=20), server_default='nice_to_have', nullable=False),
        sa.Column('weight', sa.Float(), server_default='1.0', nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.CheckConstraint("category IN ('must_have', 'nice_to_have')", name='check_requirement_category'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_requirements_job_id'), 'requirements', ['job_id'], unique=False)

    # 4. candidates table
    op.create_table(
        'candidates',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=500), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('file_hash', sa.String(length=64), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('resume_text', sa.Text(), nullable=True),
        sa.Column('redacted_text', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='queued', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('score', sa.Float(), nullable=True),
        sa.Column('stage', sa.String(length=20), server_default='new', nullable=False),
        sa.Column('profile_data', sa.JSON(), nullable=True),
        sa.Column('screening_result', sa.JSON(), nullable=True),
        sa.Column('model_id', sa.String(length=100), nullable=True),
        sa.Column('prompt_version', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("status IN ('queued', 'processing', 'done', 'failed')", name='check_candidate_status'),
        sa.CheckConstraint("stage IN ('new', 'shortlisted', 'rejected', 'on_hold')", name='check_candidate_stage'),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'file_hash', name='uq_candidates_job_file_hash'),
    )
    op.create_index(op.f('ix_candidates_job_id'), 'candidates', ['job_id'], unique=False)

    # 5. stage_history table
    op.create_table(
        'stage_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('candidate_id', sa.Integer(), nullable=False),
        sa.Column('from_stage', sa.String(length=20), nullable=True),
        sa.Column('to_stage', sa.String(length=20), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('changed_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_stage_history_candidate_id'), 'stage_history', ['candidate_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_stage_history_candidate_id'), table_name='stage_history')
    op.drop_table('stage_history')
    op.drop_index(op.f('ix_candidates_job_id'), table_name='candidates')
    op.drop_table('candidates')
    op.drop_index(op.f('ix_requirements_job_id'), table_name='requirements')
    op.drop_table('requirements')
    op.drop_table('jobs')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
