import re
import logging
import spacy
from app.config import settings

logger = logging.getLogger(__name__)

DNI_PATTERN = re.compile(r'\b(\d{8})([A-Za-z])\b')

_RELACION_PATTERNS = [
    re.compile(
        r'(?P<persona1>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\s+'
        r'es\s+(?P<relacion>hermano|hermana|padre|madre|hijo|hija|cónyuge|esposo|esposa|'
        r'conviviente|primo|prima|tío|tía|sobrino|sobrina|abuelo|abuela|nieto|nieta)\s+'
        r'de\s+'
        r'(?P<persona2>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)',
        re.UNICODE
    ),
    re.compile(
        r'(?P<persona1>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?),\s*'
        r'(?P<relacion>hermano|hermana|hijo|hija|esposo|esposa|cónyuge|primo|prima|sobrino|sobrina)\s+'
        r'de\s+'
        r'(?P<persona2>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)',
        re.UNICODE
    ),
    re.compile(
        r'(?P<persona1>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\s+'
        r'y\s+'
        r'(?P<persona2>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\s+'
        r'son\s+(?P<relacion>hermanos|hermanas|primos|primas|cónyuges|esposos)',
        re.UNICODE
    ),
    re.compile(
        r'(?P<persona1>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?),\s*'
        r'(?P<relacion>padre|madre|abuelo|abuela|tío|tía)\s+'
        r'de\s+'
        r'(?P<persona2>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)',
        re.UNICODE
    ),
]

_LABEL_PATTERNS = [
    re.compile(
        r'(?P<nombre>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?),\s*'
        r'(?P<etiqueta>aportante(?:\s+de\s+campaña)?)',
        re.UNICODE),
    re.compile(
        r'(?P<etiqueta>aportante|investigado|testigo|financista|denunciado|sentenciado|'
        r'prófugo|vinculado)(?:\s[a-z]+)?\s+'
        r'(?P<nombre>[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)',
        re.UNICODE),
]

RELACION_MAP = {
    'hermano': 'HERMANO_DE', 'hermana': 'HERMANO_DE',
    'hermanos': 'HERMANO_DE', 'hermanas': 'HERMANO_DE',
    'padre': 'PADRE_DE', 'madre': 'MADRE_DE',
    'hijo': 'HIJO_DE', 'hija': 'HIJO_DE',
    'cónyuge': 'CONYUGE_DE', 'esposo': 'CONYUGE_DE', 'esposa': 'CONYUGE_DE',
    'esposos': 'CONYUGE_DE', 'cónyuges': 'CONYUGE_DE',
    'conviviente': 'CONYUGE_DE',
    'primo': 'HERMANO_DE', 'prima': 'HERMANO_DE',
    'primos': 'HERMANO_DE', 'primas': 'HERMANO_DE',
    'tío': 'PADRE_DE', 'tía': 'MADRE_DE',
    'sobrino': 'HIJO_DE', 'sobrina': 'HIJO_DE',
    'abuelo': 'PADRE_DE', 'abuela': 'MADRE_DE',
    'nieto': 'HIJO_DE', 'nieta': 'HIJO_DE',
}

RELACION_INVERSA = {
    'PADRE_DE': 'HIJO_DE',
    'MADRE_DE': 'HIJO_DE',
    'HIJO_DE': 'PADRE_DE',
    'HERMANO_DE': 'HERMANO_DE',
    'CONYUGE_DE': 'CONYUGE_DE',
}

KNOWN_LABELS = {'aportante', 'investigado', 'testigo', 'financista',
                'denunciado', 'sentenciado', 'prófugo', 'vinculado',
                'colaborador', 'donante', 'contribuyente'}


class NLPService:
    _nlp = None

    @classmethod
    def get_nlp(cls):
        if cls._nlp is None:
            logger.info("Loading spaCy model es_core_news_lg...")
            cls._nlp = spacy.load("es_core_news_lg")
            logger.info("spaCy model loaded successfully")
        return cls._nlp

    def extract_dnis(self, texto: str) -> list[dict]:
        results = []
        for match in DNI_PATTERN.finditer(texto):
            dni = match.group(1) + match.group(2).upper()
            start = max(0, match.start() - 50)
            end = min(len(texto), match.end() + 50)
            context = texto[start:end]
            results.append({"dni": dni, "context": context})
        return results

    def extract_entities(self, texto: str) -> list[dict]:
        nlp = self.get_nlp()
        doc = nlp(texto)
        entities = []
        seen = set()
        for ent in doc.ents:
            if ent.label_ == "PER":
                name = ent.text.strip()
                if name not in seen and len(name) > 2:
                    seen.add(name)
                    entities.append({"nombre": name, "tipo": "PERSONA"})
        return entities

    def extract_relationships(self, texto: str) -> list[dict]:
        relaciones = []
        seen = set()

        for pattern in _RELACION_PATTERNS:
            for match in pattern.finditer(texto):
                p1 = match.group('persona1').strip()
                p2 = match.group('persona2').strip()
                rel_text = match.group('relacion').strip().lower()

                tipo = RELACION_MAP.get(rel_text)
                if not tipo:
                    continue

                key = tuple(sorted([p1, p2])) + (tipo,)
                if key in seen:
                    continue
                seen.add(key)

                context_start = max(0, match.start() - 100)
                context_end = min(len(texto), match.end() + 100)
                context = texto[context_start:context_end]

                dnis_in_context = self.extract_dnis(context)
                dni_p1 = None
                dni_p2 = None
                for d in dnis_in_context:
                    d_pos = context.find(d['dni'])
                    p1_pos = context.find(p1)
                    p2_pos = context.find(p2)
                    if p1_pos >= 0 and abs(d_pos - p1_pos) < abs(d_pos - p2_pos if p2_pos >= 0 else 999):
                        dni_p1 = d['dni']
                    elif p2_pos >= 0:
                        dni_p2 = d['dni']

                relaciones.append({
                    "persona1_nombre": p1,
                    "persona1_dni": dni_p1,
                    "persona2_nombre": p2,
                    "persona2_dni": dni_p2,
                    "tipo_relacion": tipo,
                })

        return relaciones

    def add_inverse_relationships(self, relaciones: list[dict]) -> list[dict]:
        result = list(relaciones)
        for r in relaciones:
            inverso = RELACION_INVERSA.get(r['tipo_relacion'])
            if inverso and r['tipo_relacion'] != inverso:
                result.append({
                    "persona1_nombre": r['persona2_nombre'],
                    "persona1_dni": r['persona2_dni'],
                    "persona2_nombre": r['persona1_nombre'],
                    "persona2_dni": r['persona1_dni'],
                    "tipo_relacion": inverso,
                })
        return result

    def extract_labels(self, texto: str) -> list[dict]:
        etiquetas = []
        seen_labels = set()

        for pattern in _LABEL_PATTERNS:
            for match in pattern.finditer(texto):
                try:
                    label = match.group('etiqueta').strip().lower()
                    if label not in seen_labels:
                        seen_labels.add(label)
                        etiquetas.append({"nombre": label})
                except IndexError:
                    continue

        texto_lower = texto.lower()
        for label in KNOWN_LABELS:
            if label in texto_lower and label not in seen_labels:
                seen_labels.add(label)
                etiquetas.append({"nombre": label})

        return etiquetas

    def process_message(self, texto: str) -> dict:
        logger.info(f"Processing message ({len(texto)} chars)")

        entities = self.extract_entities(texto)
        dnis = self.extract_dnis(texto)
        relationships = self.extract_relationships(texto)
        relationships = self.add_inverse_relationships(relationships)
        labels = self.extract_labels(texto)

        for entity in entities:
            for d in dnis:
                if entity['nombre'] in d['context']:
                    entity['dni'] = d['dni']
                    break

        for d in dnis:
            already_have = any(e.get('dni') == d['dni'] for e in entities)
            if not already_have:
                context = d['context']
                name_match = re.search(
                    r'([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)\s*' + re.escape(d['dni']),
                    context
                )
                if name_match:
                    nombre = name_match.group(1).strip()
                    entities.append({"nombre": nombre, "dni": d['dni'], "tipo": "PERSONA"})

        result = {
            "entidades": entities,
            "relaciones": relationships,
            "etiquetas": labels,
        }

        logger.info(f"Extracted {len(entities)} entities, {len(relationships)} relationships, {len(labels)} labels")
        return result


nlp_service = NLPService()
