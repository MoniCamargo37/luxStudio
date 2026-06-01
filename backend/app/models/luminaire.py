from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String, Float, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class Manufacturer(Base):
    __tablename__ = "manufacturers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    luminaires: Mapped[list["Luminaire"]] = relationship(
        "Luminaire", back_populates="manufacturer", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Manufacturer {self.name}>"


class Luminaire(Base):
    __tablename__ = "luminaires"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    manufacturer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("manufacturers.id"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    optic_family: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    power: Mapped[float] = mapped_column(Float, nullable=False)
    cct: Mapped[int] = mapped_column(Integer, nullable=False)
    cri: Mapped[int] = mapped_column(Integer, nullable=False, default=70)
    flux: Mapped[float] = mapped_column(Float, nullable=False)
    efficiency: Mapped[float] = mapped_column(Float, nullable=False)
    LORL: Mapped[float] = mapped_column(Float, nullable=False)
    isym: Mapped[int] = mapped_column(Integer, nullable=False)
    ldt_path: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    manufacturer: Mapped["Manufacturer"] = relationship(
        "Manufacturer", back_populates="luminaires"
    )

    def __repr__(self) -> str:
        return f"<Luminaire {self.name} ({self.manufacturer.name} {self.type})>"
