from sqlalchemy import text
from sqlmodel import SQLModel, create_engine, Session

try:
    from config import config
    DATABASE_URL = config.DATABASE_URL
except ImportError:
    DATABASE_URL = "sqlite:///./app.db"

engine = create_engine(DATABASE_URL, echo=False)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    _add_totp_secret_column_if_missing()
    _add_property_columns_if_missing()
    _add_match_status_if_missing()
    _add_message_table_if_missing()

def _add_totp_secret_column_if_missing():
    """Add totp_secret to user table for existing databases."""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT 1 FROM pragma_table_info('user') WHERE name='totp_secret'")
        )
        if result.fetchone() is None:
            conn.execute(text("ALTER TABLE user ADD COLUMN totp_secret VARCHAR"))
            conn.commit()


def _add_property_columns_if_missing():
    """Add island, daily_rate, max_hunters to property table for existing databases."""
    with engine.connect() as conn:
        for col, sql_type in [("island", "VARCHAR"), ("daily_rate", "FLOAT"), ("max_hunters", "INTEGER"), ("size_acres", "FLOAT")]:
            result = conn.execute(
                text("SELECT 1 FROM pragma_table_info('property') WHERE name=:name"),
                {"name": col}
            )
            if result.fetchone() is None:
                conn.execute(text(f"ALTER TABLE property ADD COLUMN {col} {sql_type}"))
                conn.commit()


def _add_match_status_if_missing():
    """Add status to match table for existing databases."""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT 1 FROM pragma_table_info('match') WHERE name='status'")
        )
        if result.fetchone() is None:
            conn.execute(text("ALTER TABLE match ADD COLUMN status VARCHAR DEFAULT 'confirmed'"))
            conn.commit()


def _add_message_table_if_missing():
    """Create message table for existing databases."""
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='message'")
        )
        if result.fetchone() is None:
            conn.execute(text("""
                CREATE TABLE message (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    access_request_id INTEGER NOT NULL,
                    sender_user_id INTEGER NOT NULL,
                    body VARCHAR(2000) NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(access_request_id) REFERENCES accessrequest(id)
                )
            """))
            conn.execute(text("CREATE INDEX ix_message_access_request_id ON message(access_request_id)"))
            conn.execute(text("CREATE INDEX ix_message_sender_user_id ON message(sender_user_id)"))
            conn.commit()


def get_session():
    with Session(engine) as session:
        yield session