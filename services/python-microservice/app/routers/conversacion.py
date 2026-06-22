import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.parser_leder import parse_conversacion
from app.services.nlp_service import nlp_service

logger = logging.getLogger(__name__)
router = APIRouter()


class ProcesarConversacionRequest(BaseModel):
    texto: str
    usar_nlp: bool = True


@router.post("/procesar_conversacion")
async def procesar_conversacion(request: ProcesarConversacionRequest):
    """
    Process a raw conversation dump (from LEDER DATA bot or similar).
    Uses structured parser + optional NLP fallback.
    """
    if not request.texto or not request.texto.strip():
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío")

    try:
        # 1. Try structured parser first
        leder_result = parse_conversacion(request.texto)

        # 2. Optionally also run NLP for any relationship patterns in natural language
        nlp_result = None
        if request.usar_nlp:
            nlp_result = nlp_service.process_message(request.texto)

        # Merge: prefer structured parser results, supplement with NLP
        all_entities = list(leder_result['entidades'])
        all_relationships = list(leder_result['relaciones'])
        all_labels = list(leder_result['etiquetas'])
        seen_dnis = set(e['dni'] for e in all_entities if e.get('dni'))

        if nlp_result:
            # Add NLP entities not already found by structured parser
            for ent in nlp_result.get('entidades', []):
                if ent.get('dni') and ent['dni'] not in seen_dnis:
                    all_entities.append(ent)
                    seen_dnis.add(ent['dni'])
            
            # Add NLP relationships
            all_relationships.extend(nlp_result.get('relaciones', []))
            
            # Add NLP labels
            nlp_labels = set(l['nombre'] for l in all_labels)
            for lbl in nlp_result.get('etiquetas', []):
                if lbl['nombre'] not in nlp_labels:
                    all_labels.append(lbl)
                    nlp_labels.add(lbl['nombre'])

        return {
            'entidades': all_entities,
            'relaciones': all_relationships,
            'etiquetas': all_labels,
            'empresas': leder_result.get('empresas', []),
            'vehiculos': leder_result.get('vehiculos', []),
        }
    except Exception as e:
        logger.error(f"Error processing conversation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error procesando conversación: {str(e)}")
