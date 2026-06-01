import math

from ..schemas.models import CalculationConfig


def arm_projection(config: CalculationConfig) -> tuple[float, float]:
    """Return horizontal projection and vertical rise of the arm in meters."""
    angle = math.radians(config.tilt)
    length = max(float(config.arm_length), 0.0)
    return length * math.cos(angle), length * math.sin(angle)


def luminaire_mounting_height(config: CalculationConfig) -> float:
    _, rise = arm_projection(config)
    return max(0.1, float(config.height) + rise)


def effective_overhang(config: CalculationConfig) -> float:
    horizontal, _ = arm_projection(config)
    return horizontal - config.pole_offset
