
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class KnowledgeEntry(Base):
    __tablename__ = "entries"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    notes: Mapped[str] = mapped_column(Text)
