from typing import Optional
from datetime import datetime, timezone

from sqlalchemy import Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.db_schemas.Base import Base

class LineStation(Base):
    __tablename__ = "line_stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    line_id: Mapped[int] = mapped_column(
        ForeignKey("lines.id"),
        nullable=False
    )

    station_id: Mapped[int] = mapped_column(
        ForeignKey("stations.id"),
        nullable=False
    )

    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    created_by: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    line = relationship(
        "Line",
        back_populates="line_stations"
    )

    station = relationship(
        "Station",
        lazy="selectin"
    )
