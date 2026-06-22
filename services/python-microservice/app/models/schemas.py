from pydantic import BaseModel
from typing import Optional


class ProcesarMensajeRequest(BaseModel):
    texto: str
    chat_id: Optional[str] = None


class EntidadExtraida(BaseModel):
    nombre: str
    dni: Optional[str] = None
    tipo: str = "PERSONA"


class RelacionExtraida(BaseModel):
    persona1_dni: Optional[str] = None
    persona1_nombre: str
    persona2_dni: Optional[str] = None
    persona2_nombre: str
    tipo_relacion: str


class EtiquetaExtraida(BaseModel):
    nombre: str


class ProcesarMensajeResponse(BaseModel):
    entidades: list[EntidadExtraida]
    relaciones: list[RelacionExtraida]
    etiquetas: list[EtiquetaExtraida]


class SubirFotoResponse(BaseModel):
    url: str
    public_id: str


class HealthResponse(BaseModel):
    status: str
