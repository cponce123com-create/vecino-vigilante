import re
import logging

logger = logging.getLogger(__name__)

# DNI pattern
DNI_LINE = re.compile(r'DNI\s*:\s*(\d{8})')

# Personal info
NOMBRES_LINE = re.compile(r'NOMBRES\s*:\s*(.+)')
APELLIDOS_LINE = re.compile(r'APELLIDOS\s*:\s*(.+)')
PADRE_LINE = re.compile(r'PADRE\s*:\s*(.+)')
MADRE_LINE = re.compile(r'MADRE\s*:\s*(.+)')
DIRECCION_LINE = re.compile(r'DIRECCION\s*:\s*(.+)')

# Family relationship lines
TIPO_RELACION = re.compile(r'TIPO\s*:\s*(.+)')

# Company data
RUC_LINE = re.compile(r'RUC\s*:\s*(\d{11})')
EMPRESA_LINE = re.compile(r'RAZON SOCIAL\s*:\s*(.+)')
CARGO_LINE = re.compile(r'CARGO\s*:\s*(.+)')

# Vehicle data
PLACA_LINE = re.compile(r'PLACA\s*:\s*([A-Z0-9]+)')
MARCA_LINE = re.compile(r'MARCA\s*:\s*(.+)')
MODELO_LINE = re.compile(r'MODELO\s*:\s*(.+)')
ANIO_VEH = re.compile(r'A.O\s*:\s*(\d{4})')

# Label patterns
APORTANTE = re.compile(r'aportante', re.IGNORECASE)
INVESTIGADO = re.compile(r'investigado', re.IGNORECASE)
DENUNCIAS = re.compile(r'DENUNCIAS?', re.IGNORECASE)

_SECTION_KEYS = {'SUELDOS', 'CORREOS', 'TELEFONOS', 'HOGAR', 'SUNAT', 'AFPS', 'TRABAJOS'}


def parse_conversacion(texto: str) -> dict:
    """Parse a complete LEDER DATA conversation dump."""
    lines = texto.split(chr(10))

    all_persons: dict[str, dict] = {}
    all_relationships: list[dict] = []
    all_companies: list[dict] = []
    all_vehicles: list[dict] = []
    all_labels: set[str] = set()

    current_dni: str | None = None
    in_familia = False
    in_empresas = False
    in_vehiculos = False
    in_direcciones = False

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Section detection
        upper = line.upper()
        if 'FAMILIA' in upper and 'PREMIUM' in upper:
            in_familia = True; in_empresas = False; in_vehiculos = False; in_direcciones = False
            i += 1; continue
        if 'EMPRESAS' in upper and 'PREMIUM' in upper:
            in_empresas = True; in_familia = False; in_vehiculos = False; in_direcciones = False
            i += 1; continue
        if 'VEHICULOS' in upper and 'PREMIUM' in upper:
            in_vehiculos = True; in_familia = False; in_empresas = False; in_direcciones = False
            i += 1; continue
        if 'DIRECCIONES' in upper and 'PREMIUM' in upper:
            in_direcciones = True; in_familia = False; in_empresas = False; in_vehiculos = False
            i += 1; continue
        if any(k in upper for k in _SECTION_KEYS):
            in_familia = False; in_empresas = False; in_vehiculos = False; in_direcciones = False
            i += 1; continue

        # DNI
        dm = DNI_LINE.search(line)
        if dm:
            dni = dm.group(1)
            if in_familia:
                member: dict = {'dni': dni}
                j = i + 1
                while j < len(lines) and j < i + 15:
                    sl = lines[j].strip()
                    am = APELLIDOS_LINE.search(sl)
                    nm = NOMBRES_LINE.search(sl)
                    tm = TIPO_RELACION.search(sl)
                    if am: member['apellidos'] = am.group(1).strip()
                    if nm: member['nombres'] = nm.group(1).strip()
                    if tm:
                        raw = tm.group(1).strip().upper()
                        member['tipo'] = raw
                        _add_relationship(raw, member, current_dni, dni, all_persons, all_relationships)
                    if not sl and len(member) > 1: break
                    j += 1
                name = f"{member.get('nombres', '')} {member.get('apellidos', '')}".strip()
                if name and name != ' ':
                    p = all_persons.setdefault(dni, {})
                    p.update({'dni': dni, 'nombre_completo': name, 'tipo': member.get('tipo', '')})
                i = j; continue
            elif in_empresas: i += 1; continue
            else:
                current_dni = dni
                all_persons.setdefault(dni, {})['dni'] = dni
                i += 1; continue

        # Personal details
        if current_dni and not in_familia and not in_empresas and not in_vehiculos:
            p = all_persons[current_dni]
            am = APELLIDOS_LINE.search(line)
            nm = NOMBRES_LINE.search(line)
            pm = PADRE_LINE.search(line)
            mm = MADRE_LINE.search(line)
            dm2 = DIRECCION_LINE.search(line)
            if am: p['apellidos'] = am.group(1).strip()
            elif nm: p['nombres'] = nm.group(1).strip()
            elif pm: p['padre'] = pm.group(1).strip()
            elif mm: p['madre'] = mm.group(1).strip()
            elif dm2: p['direccion'] = dm2.group(1).strip()

        # Companies
        if in_empresas:
            rm = RUC_LINE.search(line)
            if rm:
                comp = {'dni': current_dni, 'ruc': rm.group(1)}
                j = i + 1
                while j < len(lines) and j < i + 5:
                    sl = lines[j].strip()
                    em = EMPRESA_LINE.search(sl)
                    cm = CARGO_LINE.search(sl)
                    if em: comp['razon_social'] = em.group(1).strip()
                    if cm: comp['cargo'] = cm.group(1).strip()
                    if not sl and len(comp) > 2: break
                    j += 1
                if len(comp) > 2: all_companies.append(comp)
                i = j; continue

        # Vehicles
        if in_vehiculos:
            pm2 = PLACA_LINE.search(line)
            if pm2:
                all_vehicles.append({'dni': current_dni, 'placa': pm2.group(1)})
            elif all_vehicles:
                v = all_vehicles[-1]
                mm2 = MARCA_LINE.search(line)
                mm3 = MODELO_LINE.search(line)
                am2 = ANIO_VEH.search(line)
                if mm2 and 'marca' not in v: v['marca'] = mm2.group(1).strip()
                elif mm3 and 'modelo' not in v: v['modelo'] = mm3.group(1).strip()
                elif am2 and 'anio' not in v: v['anio'] = am2.group(1)

        # Labels
        if APORTANTE.search(line): all_labels.add('aportante')
        if INVESTIGADO.search(line): all_labels.add('investigado')
        if DENUNCIAS.search(line) and current_dni: all_labels.add('con_denuncias')

        i += 1

    # Build person list
    persons_list = []
    for dni, data in all_persons.items():
        nombres = data.get('nombres', '')
        apellidos = data.get('apellidos', '')
        nc = data.get('nombre_completo', f"{nombres} {apellidos}".strip())
        if not nc or nc == ' ': continue
        persons_list.append({
            'dni': dni,
            'nombre': nc,
            'direccion': data.get('direccion', ''),
            'tipo': 'PERSONA',
        })

    logger.info(f"LEDER parser: {len(persons_list)} persons, {len(all_relationships)} rels, "
                f"{len(all_companies)} companies, {len(all_vehicles)} vehicles, {len(all_labels)} labels")
    return {
        'entidades': persons_list,
        'relaciones': all_relationships,
        'etiquetas': [{'nombre': l} for l in all_labels],
        'empresas': all_companies,
        'vehiculos': all_vehicles,
    }


def _add_relationship(raw: str, member: dict, current_dni: str | None, dni: str,
                      all_persons: dict, all_relationships: list[dict]) -> None:
    """Map a TIPO value to a relationship and add it."""
    if not current_dni:
        return
    rel_map = {
        'HIJA': 'HIJO_DE', 'HIJO': 'HIJO_DE',
        'HERMANO': 'HERMANO_DE', 'HERMANA': 'HERMANO_DE',
        'COMPARTEN HIJOS': 'CONYUGE_DE',
        'MADRE': 'MADRE_DE', 'PADRE': 'PADRE_DE',
    }
    rel_type = rel_map.get(raw)
    if not rel_type:
        return

    # For HIJO_DE: child is dni, parent is current_dni
    # For HERMANO_DE: symmetric
    # For CONYUGE_DE: symmetric
    # For MADRE_DE/PADRE_DE: parent is dni, child is current_dni
    if rel_type in ('HIJO_DE',):
        p1, p2 = dni, current_dni
    elif rel_type in ('MADRE_DE', 'PADRE_DE'):
        p1, p2 = dni, current_dni
    else:
        p1, p2 = current_dni, dni

    name1 = f"{member.get('nombres', '')} {member.get('apellidos', '')}".strip()
    name2_p = all_persons.get(current_dni, {})
    name2 = name2_p.get('nombre_completo', '') or f"{name2_p.get('nombres', '')} {name2_p.get('apellidos', '')}".strip()

    all_relationships.append({
        'persona1_dni': p1,
        'persona1_nombre': name1 if p1 == dni else name2,
        'persona2_dni': p2,
        'persona2_nombre': name2 if p2 == current_dni else name1,
        'tipo_relacion': rel_type,
    })
