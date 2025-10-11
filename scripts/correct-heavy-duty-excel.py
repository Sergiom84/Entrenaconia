#!/usr/bin/env python3
"""
Script de Corrección: Ejercicios_Heavy_duty.xlsx
=================================================

PROBLEMA: El Excel tiene las columnas desplazadas (shifted).
SOLUCIÓN: Este script lee el Excel, corrige el mapeo de columnas,
          infiere el nivel (Básico/Intermedio/Avanzado) automáticamente,
          y genera un CSV validado.

Uso:
    python3 correct-heavy-duty-excel.py
"""

import zipfile
import xml.etree.ElementTree as ET
import csv
import sys
from datetime import datetime

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

EXCEL_PATH = '/mnt/c/Users/Sergio/Downloads/Ejercicios_Heavy_duty.xlsx'
OUTPUT_CSV = '/mnt/c/Users/Sergio/Desktop/Entrenaconia/Ejercicios_Heavy_Duty_CORREGIDO.csv'
OUTPUT_SQL = '/mnt/c/Users/Sergio/Desktop/Entrenaconia/scripts/insert-heavy-duty-exercises.sql'

# Columnas de la BD (orden correcto)
BD_COLUMNS = [
    'exercise_id',           # 1
    'nombre',                # 2
    'nivel',                 # 3 ← INFERIR
    'categoria',             # 4
    'patron',                # 5
    'equipamiento',          # 6
    'series_reps_objetivo',  # 7
    'criterio_de_progreso',  # 8
    'progresion_desde',      # 9
    'progresion_hacia',      # 10
    'notas',                 # 11
    'variante',              # 12
    'explicacion_variante',  # 13
    'tiempo'                 # 14
]

# ============================================================================
# REGLAS DE INFERENCIA DE NIVEL
# ============================================================================

def infer_nivel(ejercicio):
    """
    Infiere el nivel (Básico/Intermedio/Avanzado) basándose en características del ejercicio.

    Args:
        ejercicio: dict con keys del Excel

    Returns:
        str: "Básico", "Intermedio", o "Avanzado"
    """
    nombre = ejercicio.get('nombre', '').lower()
    equipamiento = ejercicio.get('equipamiento_original', '').lower()
    patron = ejercicio.get('patron_original', '').lower()
    grupo_muscular = ejercicio.get('grupo_muscular', '').lower()

    # REGLA 1: Máquinas y poleas = Básico
    if 'máquina' in equipamiento or 'polea' in equipamiento:
        return 'Básico'

    # REGLA 2: Ejercicios con "peso corporal" o "asistidos" = Básico
    if 'peso corporal' in nombre or 'asistid' in nombre:
        return 'Básico'

    # REGLA 3: Barra libre + ejercicios compuestos = Intermedio
    if 'barra' in equipamiento and any(x in nombre for x in ['press', 'sentadilla', 'peso muerto', 'remo']):
        return 'Intermedio'

    # REGLA 4: Mancuernas = Intermedio (más estabilización)
    if 'mancuerna' in equipamiento:
        return 'Intermedio'

    # REGLA 5: Ejercicios complejos o con variantes avanzadas = Avanzado
    advanced_keywords = ['unilateral', 'explosiv', 'deficit', 'pausa', 'cadena', 'band']
    if any(keyword in nombre for keyword in advanced_keywords):
        return 'Avanzado'

    # REGLA 6: Superseries, drop sets, rest-pause = Avanzado
    if 'superserie' in nombre or 'drop' in nombre or 'rest-pause' in nombre:
        return 'Avanzado'

    # REGLA 7: Ejercicios de aislamiento con máquina = Básico
    if grupo_muscular in ['bíceps', 'tríceps', 'gemelos'] and 'máquina' in equipamiento:
        return 'Básico'

    # DEFAULT: Si no hay suficiente información, asignar Básico
    return 'Básico'

# ============================================================================
# EXTRACCIÓN DEL EXCEL
# ============================================================================

def extract_excel_data(excel_path):
    """Extrae datos del Excel usando zipfile y XML parsing."""

    print("=" * 80)
    print("📊 EXTRAYENDO DATOS DEL EXCEL...")
    print("=" * 80)

    with zipfile.ZipFile(excel_path, 'r') as zip_ref:
        # Leer shared strings
        shared_strings_xml = zip_ref.read('xl/sharedStrings.xml')
        strings_root = ET.fromstring(shared_strings_xml)

        shared_strings = []
        for si in strings_root.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
            shared_strings.append(si.text if si.text else '')

        # Leer sheet data
        sheet_xml = zip_ref.read('xl/worksheets/sheet1.xml')
        sheet_root = ET.fromstring(sheet_xml)

        # Namespace
        ns = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows = sheet_root.findall('.//x:row', ns)

        # Primera fila = encabezados (Excel)
        header_row = rows[0]
        excel_headers = []
        cells = header_row.findall('.//x:c', ns)
        for cell in cells:
            v_elem = cell.find('.//x:v', ns)
            t_attr = cell.get('t')
            if v_elem is not None:
                value = v_elem.text
                if t_attr == 's':
                    idx = int(value)
                    excel_headers.append(shared_strings[idx] if idx < len(shared_strings) else '')
                else:
                    excel_headers.append(value)

        print(f"✅ Encabezados Excel: {excel_headers}\n")

        # Extraer ejercicios
        ejercicios_raw = []
        for row in rows[1:]:  # Skip header
            cells = row.findall('.//x:c', ns)
            if not cells:
                continue

            ejercicio = []
            for cell in cells:
                v_elem = cell.find('.//x:v', ns)
                t_attr = cell.get('t')
                if v_elem is not None:
                    value = v_elem.text
                    if t_attr == 's':
                        idx = int(value)
                        ejercicio.append(shared_strings[idx] if idx < len(shared_strings) else '')
                    else:
                        ejercicio.append(value)
                else:
                    ejercicio.append('')

            if any(ejercicio):
                ejercicios_raw.append(ejercicio)

        print(f"✅ Ejercicios extraídos: {len(ejercicios_raw)}\n")

        return excel_headers, ejercicios_raw

# ============================================================================
# MAPEO Y CORRECCIÓN DE COLUMNAS
# ============================================================================

def map_exercise_data(excel_headers, ejercicio_raw):
    """
    Mapea los datos del Excel al formato correcto de BD.

    MAPEO DETECTADO:
    - Excel col 0 (id) → BD exercise_id
    - Excel col 1 (nombre) → BD nombre
    - Excel col 5 (nivel) → BD categoria (grupo muscular) ⚠️ INCORRECTO EN EXCEL
    - Excel col 6 (categoria) → BD patron ⚠️ SHIFTED
    - Excel col 7 (patron) → BD equipamiento ⚠️ SHIFTED
    - Excel col 8 (equipamiento) → BD series_reps_objetivo ⚠️ SHIFTED
    - Excel col 9 (series_reps_objetivo) → BD criterio_de_progreso ⚠️ SHIFTED
    - etc...
    """

    ejercicio_mapped = {
        'exercise_id': ejercicio_raw[0] if len(ejercicio_raw) > 0 else '',
        'nombre': ejercicio_raw[1] if len(ejercicio_raw) > 1 else '',
        'variante': ejercicio_raw[2] if len(ejercicio_raw) > 2 else '',
        'explicacion_variante': ejercicio_raw[3] if len(ejercicio_raw) > 3 else '',
        'tiempo': ejercicio_raw[4] if len(ejercicio_raw) > 4 else '',

        # ⚠️ CORRECCIÓN: Estas columnas están shifted en el Excel
        'grupo_muscular': ejercicio_raw[5] if len(ejercicio_raw) > 5 else '',  # Excel "nivel"
        'patron_original': ejercicio_raw[6] if len(ejercicio_raw) > 6 else '',  # Excel "categoria"
        'equipamiento_original': ejercicio_raw[7] if len(ejercicio_raw) > 7 else '',  # Excel "patron"

        # Mapeo correcto (shifted)
        'categoria': ejercicio_raw[5] if len(ejercicio_raw) > 5 else '',  # grupo muscular
        'patron': ejercicio_raw[6] if len(ejercicio_raw) > 6 else '',  # patrón de movimiento
        'equipamiento': ejercicio_raw[7] if len(ejercicio_raw) > 7 else '',  # equipamiento
        'series_reps_objetivo': ejercicio_raw[8] if len(ejercicio_raw) > 8 else '',
        'criterio_de_progreso': ejercicio_raw[9] if len(ejercicio_raw) > 9 else '',
        'progresion_desde': ejercicio_raw[10] if len(ejercicio_raw) > 10 else '',
        'progresion_hacia': ejercicio_raw[11] if len(ejercicio_raw) > 11 else '',
        'notas': ejercicio_raw[12] if len(ejercicio_raw) > 12 else '',
    }

    # INFERIR NIVEL
    ejercicio_mapped['nivel'] = infer_nivel(ejercicio_mapped)

    return ejercicio_mapped

# ============================================================================
# GENERACIÓN DE CSV Y SQL
# ============================================================================

def generate_csv(ejercicios_mapped, output_csv):
    """Genera CSV con los datos corregidos."""

    print("=" * 80)
    print(f"📝 GENERANDO CSV: {output_csv}")
    print("=" * 80)

    with open(output_csv, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=BD_COLUMNS)
        writer.writeheader()

        for ej in ejercicios_mapped:
            # Seleccionar solo las columnas de BD
            row = {col: ej.get(col, '') for col in BD_COLUMNS}
            writer.writerow(row)

    print(f"✅ CSV generado: {len(ejercicios_mapped)} ejercicios\n")

def generate_sql(ejercicios_mapped, output_sql):
    """Genera script SQL INSERT."""

    print("=" * 80)
    print(f"🗄️  GENERANDO SQL: {output_sql}")
    print("=" * 80)

    with open(output_sql, 'w', encoding='utf-8') as f:
        f.write("-- ============================================================================\n")
        f.write("-- INSERT EJERCICIOS HEAVY DUTY - CORREGIDOS\n")
        f.write(f"-- Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"-- Total ejercicios: {len(ejercicios_mapped)}\n")
        f.write("-- ============================================================================\n\n")

        f.write("BEGIN;\n\n")

        # Limpiar tabla existente (opcional - comentado por seguridad)
        f.write("-- DESCOMENTAR SI QUIERES LIMPIAR TABLA EXISTENTE:\n")
        f.write("-- DELETE FROM app.\"Ejercicios_Heavy_Duty\";\n\n")

        for idx, ej in enumerate(ejercicios_mapped, 1):
            f.write(f"-- Ejercicio {idx}: {ej.get('nombre', 'Sin nombre')}\n")
            f.write("INSERT INTO app.\"Ejercicios_Heavy_Duty\" (\n")
            f.write("  exercise_id, nombre, nivel, categoria, patron, equipamiento,\n")
            f.write("  series_reps_objetivo, criterio_de_progreso, progresion_desde,\n")
            f.write("  progresion_hacia, notas, variante, explicacion_variante, tiempo\n")
            f.write(") VALUES (\n")

            # Escapar comillas simples para SQL
            def escape_sql(text):
                if not text:
                    return 'NULL'
                return "'" + str(text).replace("'", "''") + "'"

            values = [
                escape_sql(ej.get('exercise_id', '')),
                escape_sql(ej.get('nombre', '')),
                escape_sql(ej.get('nivel', 'Básico')),
                escape_sql(ej.get('categoria', '')),
                escape_sql(ej.get('patron', '')),
                escape_sql(ej.get('equipamiento', '')),
                escape_sql(ej.get('series_reps_objetivo', '')),
                escape_sql(ej.get('criterio_de_progreso', '')),
                escape_sql(ej.get('progresion_desde', '')),
                escape_sql(ej.get('progresion_hacia', '')),
                escape_sql(ej.get('notas', '')),
                escape_sql(ej.get('variante', '')),
                escape_sql(ej.get('explicacion_variante', '')),
                escape_sql(ej.get('tiempo', ''))
            ]

            f.write(f"  {', '.join(values)}\n")
            f.write(");\n\n")

        f.write("COMMIT;\n\n")
        f.write("-- ============================================================================\n")
        f.write("-- VERIFICACIÓN\n")
        f.write("-- ============================================================================\n\n")
        f.write("SELECT COUNT(*) as total_ejercicios FROM app.\"Ejercicios_Heavy_Duty\";\n")
        f.write("SELECT nivel, COUNT(*) as cantidad FROM app.\"Ejercicios_Heavy_Duty\" GROUP BY nivel;\n")

    print(f"✅ SQL generado: {len(ejercicios_mapped)} INSERTs\n")

# ============================================================================
# REPORTE DE ESTADÍSTICAS
# ============================================================================

def print_statistics(ejercicios_mapped):
    """Imprime estadísticas de los ejercicios procesados."""

    print("=" * 80)
    print("📊 ESTADÍSTICAS DE EJERCICIOS CORREGIDOS")
    print("=" * 80)

    # Por nivel
    niveles = {}
    for ej in ejercicios_mapped:
        nivel = ej.get('nivel', 'Sin nivel')
        niveles[nivel] = niveles.get(nivel, 0) + 1

    print("\n🎯 DISTRIBUCIÓN POR NIVEL:")
    for nivel, count in sorted(niveles.items()):
        print(f"  • {nivel}: {count} ejercicios")

    # Por categoría (grupo muscular)
    categorias = {}
    for ej in ejercicios_mapped:
        cat = ej.get('categoria', 'Sin categoría')
        categorias[cat] = categorias.get(cat, 0) + 1

    print("\n💪 DISTRIBUCIÓN POR GRUPO MUSCULAR:")
    for cat, count in sorted(categorias.items(), key=lambda x: -x[1])[:10]:
        print(f"  • {cat}: {count} ejercicios")

    # Por equipamiento
    equipamientos = {}
    for ej in ejercicios_mapped:
        equip = ej.get('equipamiento', 'Sin equipamiento')
        equipamientos[equip] = equipamientos.get(equip, 0) + 1

    print("\n🏋️  DISTRIBUCIÓN POR EQUIPAMIENTO:")
    for equip, count in sorted(equipamientos.items(), key=lambda x: -x[1])[:10]:
        print(f"  • {equip}: {count} ejercicios")

    print("\n" + "=" * 80)

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Función principal del script."""

    print("\n" + "=" * 80)
    print("🔧 SCRIPT DE CORRECCIÓN: EJERCICIOS HEAVY DUTY")
    print("=" * 80)
    print(f"📁 Excel input: {EXCEL_PATH}")
    print(f"📄 CSV output: {OUTPUT_CSV}")
    print(f"🗄️  SQL output: {OUTPUT_SQL}")
    print("=" * 80 + "\n")

    try:
        # 1. Extraer datos del Excel
        excel_headers, ejercicios_raw = extract_excel_data(EXCEL_PATH)

        # 2. Mapear y corregir datos
        print("=" * 80)
        print("🔄 MAPEANDO Y CORRIGIENDO DATOS...")
        print("=" * 80)

        ejercicios_mapped = []
        for idx, ej_raw in enumerate(ejercicios_raw, 1):
            ej_mapped = map_exercise_data(excel_headers, ej_raw)
            ejercicios_mapped.append(ej_mapped)

            if idx <= 3:  # Mostrar primeros 3 como ejemplo
                print(f"\n✓ Ejercicio {idx}: {ej_mapped['nombre']}")
                print(f"  - Nivel inferido: {ej_mapped['nivel']}")
                print(f"  - Categoría: {ej_mapped['categoria']}")
                print(f"  - Patrón: {ej_mapped['patron']}")
                print(f"  - Equipamiento: {ej_mapped['equipamiento']}")

        print(f"\n✅ Mapeados: {len(ejercicios_mapped)} ejercicios\n")

        # 3. Generar CSV
        generate_csv(ejercicios_mapped, OUTPUT_CSV)

        # 4. Generar SQL
        generate_sql(ejercicios_mapped, OUTPUT_SQL)

        # 5. Estadísticas
        print_statistics(ejercicios_mapped)

        # 6. Instrucciones finales
        print("=" * 80)
        print("✅ PROCESO COMPLETADO EXITOSAMENTE")
        print("=" * 80)
        print("\n📋 PRÓXIMOS PASOS:\n")
        print(f"1. Revisa el CSV generado: {OUTPUT_CSV}")
        print("   - Valida que los niveles sean correctos")
        print("   - Ajusta manualmente si es necesario\n")
        print(f"2. Si todo está OK, ejecuta el SQL:")
        print(f"   psql ... -f {OUTPUT_SQL}\n")
        print("3. O importa el CSV directamente a Supabase\n")
        print("=" * 80 + "\n")

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
