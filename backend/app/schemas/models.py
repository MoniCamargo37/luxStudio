from pydantic import BaseModel, Field
from typing import Optional


class CalculationConfig(BaseModel):
    road_width: float = Field(ge=0.5, le=30, description="Road width in meters")
    sidewalk_left: float = Field(ge=0, le=10, default=0)
    sidewalk_right: float = Field(ge=0, le=10, default=0)
    lanes: int = Field(ge=1, le=6, default=2)
    arrangement: str = Field(
        default="Lineal",
        pattern=r"^(Lineal|Bilateral|Central Doble|En Isleta)$",
    )
    height: float = Field(ge=4, le=20, default=9, description="Pole height in meters")
    spacing: float = Field(ge=5, le=60, default=30, description="Pole spacing in meters")
    arm_length: float = Field(ge=0, le=5, default=1.5, description="Arm length in meters")
    pole_offset: float = Field(ge=0, le=5, default=0, description="Distance from road edge to pole axis in meters")
    tilt: float = Field(ge=-30, le=30, default=5, description="Tilt angle in degrees")
    optic_family: str = Field(description="Optic family code, e.g. F151")
    power: float = Field(gt=0, description="Luminaire power in watts")
    ldt_id: Optional[str] = None
    manufacturer: Optional[str] = None
    model_family: Optional[str] = None
    lighting_class: str = Field(
        default="M3",
        pattern=r"^(M[1-6]|P[1-6])$",
        description="EN 13201 lighting class",
    )
    mf: float = Field(ge=0.5, le=1.0, default=0.85, description="Maintenance factor")
    pavement: str = Field(default="R3", pattern=r"^R[1-4]$")
    cct: int = Field(default=4000, ge=2700, le=6500)


class LDTInfo(BaseModel):
    id: str
    filename: str
    luminaire_name: str
    manufacturer: str = "Unknown"
    model_family: str = "UNKNOWN"
    cct: int = 4000
    optic_family: str
    power: float
    flux: float
    efficiency: float
    LORL: float
    isym: int


class LDTFamily(BaseModel):
    code: str
    description: str
    ldts: list[LDTInfo]


class CriterionResult(BaseModel):
    name: str
    value: float
    required: float
    passed: bool


class CalculationResult(BaseModel):
    config: CalculationConfig
    compliant: bool
    mode: str
    luminaire: LDTInfo
    criteria: list[CriterionResult]
    Eavg: Optional[float] = None
    Emin: Optional[float] = None
    Lavg: Optional[float] = None
    Uo: Optional[float] = None
    Ul: Optional[float] = None
    TI: Optional[float] = None
    SR: Optional[float] = None


class BatchCalculationItem(BaseModel):
    model_id: str
    row: int
    config: Optional[CalculationConfig] = None
    result: Optional[CalculationResult] = None
    error: Optional[str] = None


class BatchCalculationResponse(BaseModel):
    filename: str
    count: int
    items: list[BatchCalculationItem]


class OptimizationResponse(BaseModel):
    feasible: bool
    message: str
    objective: str
    fixed_parameters: list[str]
    checked: int
    config: Optional[CalculationConfig] = None
    result: Optional[CalculationResult] = None


class AdvancedOptimizationVariables(BaseModel):
    power: bool = True
    spacing: bool = False
    height: bool = False
    optic_family: bool = False


class AdvancedOptimizationRequest(BaseModel):
    config: CalculationConfig
    variables: AdvancedOptimizationVariables = Field(default_factory=AdvancedOptimizationVariables)
    objective: str = Field(
        default="technical_limits",
        pattern=r"^(technical_limits|min_power|max_spacing)$",
    )
    optic_families: Optional[list[str]] = None
