from sqlalchemy import BigInteger, String, UniqueConstraint, Integer
from sqlalchemy.orm import Mapped, mapped_column
from openjiuwen_studio.models.db_fun_base import Base, DBFunBase
from ops.config import settings


class ReferenceDB(Base, DBFunBase):
    __tablename__ = "reference"
    __table_args__ = (
        UniqueConstraint("space_id", "referenced_type", "referenced_id", "referenced_version",
                        "referer_type", "referer_id", "referer_version", name="uix_reference"),
    )
    if settings.DB_TYPE.lower() == "sqlite":
        primary_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, name="id")
    else:
        primary_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True, name="id")

    space_id: Mapped[str] = mapped_column(String(100), nullable=False)
    referenced_type: Mapped[str] = mapped_column(String(20), nullable=False)
    referenced_id: Mapped[str] = mapped_column(String(100), nullable=False)
    referenced_version: Mapped[str] = mapped_column(String(100), nullable=False, default=DBFunBase.__version_none__)
    referer_type: Mapped[str] = mapped_column(String(20), nullable=False)
    referer_id: Mapped[str] = mapped_column(String(100), nullable=False)
    referer_version: Mapped[str] = mapped_column(String(100), nullable=False, default=DBFunBase.__version_none__)
    create_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    update_time: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    def __repr__(self) -> str:
        return f"<ReferenceDB(space_id='{self.space_id}', referenced={self.referenced_type}:{self.referenced_id}:{self.referenced_version}, referer={self.referer_type}:{self.referer_id}:{self.referer_version})>"