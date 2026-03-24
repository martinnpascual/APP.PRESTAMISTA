"""
services/calculadora.py — Motor de Préstamos
=============================================
Fórmulas soportadas:
  • flat        — tasa sobre capital original, cuota fija
  • sobre_saldo — tasa sobre saldo decreciente, cuota variable
  • personalizada — alias de flat por ahora (extensible)

Periodicidades:
  • diaria | semanal | quincenal | mensual

Reglas clave:
  - La tasa es siempre POR PERÍODO (no anual).
    Ej: tasa=10 con periodicidad=mensual → 10% mensual sobre capital.
  - Las fechas de vencimiento se calculan desde fecha_inicio.
  - El resultado es determinista: mismos inputs → mismo calendario.

Uso:
    from app.services.calculadora import calcular_prestamo, PrestamoCalculado

    resultado = calcular_prestamo(
        monto=50000,
        tasa=10,
        tipo_tasa="flat",
        periodicidad="mensual",
        n_cuotas=12,
        fecha_inicio=date.today(),
    )
    print(resultado.monto_cuota)  # Decimal
    print(resultado.cuotas)       # lista de CuotaCalculo
"""
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

from dateutil.relativedelta import relativedelta


# ---------------------------------------------------------------------------
# Tipos
# ---------------------------------------------------------------------------

TipoTasa = Literal["flat", "sobre_saldo", "personalizada"]
Periodicidad = Literal["diaria", "semanal", "quincenal", "mensual"]

CENTAVOS = Decimal("0.01")


@dataclass
class CuotaCalculo:
    """Cuota individual del calendario de pagos."""
    numero: int
    fecha_vencimiento: date
    monto: Decimal          # total a pagar esa cuota (capital + interés)
    capital: Decimal        # porción de capital
    intereses: Decimal      # porción de interés
    saldo_restante: Decimal # saldo tras pagar esta cuota


@dataclass
class PrestamoCalculado:
    """Resultado completo del cálculo de un préstamo."""
    monto: Decimal
    tasa: Decimal
    tipo_tasa: str
    periodicidad: str
    n_cuotas: int
    monto_cuota: Decimal          # cuota representativa (1ra o promedio)
    monto_total: Decimal          # capital + intereses totales
    total_intereses: Decimal
    fecha_inicio: date
    fecha_fin_estimada: date
    cuotas: list[CuotaCalculo] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Fecha de vencimiento por periodicidad
# ---------------------------------------------------------------------------

def _siguiente_fecha(base: date, periodicidad: Periodicidad, n: int) -> date:
    """Retorna la fecha de vencimiento de la cuota número n."""
    if periodicidad == "diaria":
        return base + timedelta(days=n)
    if periodicidad == "semanal":
        return base + timedelta(weeks=n)
    if periodicidad == "quincenal":
        return base + timedelta(days=15 * n)
    if periodicidad == "mensual":
        return base + relativedelta(months=n)
    raise ValueError(f"Periodicidad desconocida: {periodicidad}")


# ---------------------------------------------------------------------------
# Fórmula FLAT
# ---------------------------------------------------------------------------

def _calcular_flat(
    monto: Decimal,
    tasa: Decimal,
    n_cuotas: int,
    fecha_inicio: date,
    periodicidad: Periodicidad,
) -> list[CuotaCalculo]:
    """
    Sistema flat (interés sobre capital original).

    Cuota fija = monto / n + monto * tasa%
    Donde tasa% se aplica sobre el capital ORIGINAL en cada período.

    Ejemplo: $50.000, 10% por cuota, 12 cuotas
      Interés por cuota = 50.000 × 0.10 = $5.000
      Capital por cuota = 50.000 / 12 = $4.166,67
      Cuota = $9.166,67 (fija)
    """
    tasa_dec = tasa / Decimal("100")
    capital_por_cuota = (monto / n_cuotas).quantize(CENTAVOS, ROUND_HALF_UP)
    interes_por_cuota = (monto * tasa_dec).quantize(CENTAVOS, ROUND_HALF_UP)
    cuota_base = capital_por_cuota + interes_por_cuota

    cuotas: list[CuotaCalculo] = []
    saldo = monto

    for i in range(1, n_cuotas + 1):
        es_ultima = i == n_cuotas
        # La última cuota absorbe el redondeo acumulado
        capital = saldo if es_ultima else capital_por_cuota
        cuota_monto = (capital + interes_por_cuota).quantize(CENTAVOS, ROUND_HALF_UP)
        saldo = (saldo - capital).quantize(CENTAVOS, ROUND_HALF_UP)

        cuotas.append(CuotaCalculo(
            numero=i,
            fecha_vencimiento=_siguiente_fecha(fecha_inicio, periodicidad, i),
            monto=cuota_monto,
            capital=capital,
            intereses=interes_por_cuota,
            saldo_restante=saldo,
        ))

    return cuotas


# ---------------------------------------------------------------------------
# Fórmula SOBRE SALDO (sistema francés argentino / decreciente)
# ---------------------------------------------------------------------------

def _calcular_sobre_saldo(
    monto: Decimal,
    tasa: Decimal,
    n_cuotas: int,
    fecha_inicio: date,
    periodicidad: Periodicidad,
) -> list[CuotaCalculo]:
    """
    Sistema sobre saldo (cuota de capital fija, interés decreciente).

    Capital por cuota = monto / n_cuotas (constante)
    Interés cuota i   = saldo_i × tasa%
    Cuota i           = capital + interés_i  (decrece con el tiempo)

    Ejemplo: $30.000, 8% por cuota, 8 cuotas
      Capital por cuota = 30.000 / 8 = $3.750
      Cuota 1: interés = 30.000 × 0.08 = $2.400  → cuota = $6.150
      Cuota 2: interés = 26.250 × 0.08 = $2.100  → cuota = $5.850
      ...
    """
    tasa_dec = tasa / Decimal("100")
    capital_por_cuota = (monto / n_cuotas).quantize(CENTAVOS, ROUND_HALF_UP)

    cuotas: list[CuotaCalculo] = []
    saldo = monto

    for i in range(1, n_cuotas + 1):
        es_ultima = i == n_cuotas
        capital = saldo if es_ultima else capital_por_cuota
        interes = (saldo * tasa_dec).quantize(CENTAVOS, ROUND_HALF_UP)
        cuota_monto = (capital + interes).quantize(CENTAVOS, ROUND_HALF_UP)
        saldo = (saldo - capital).quantize(CENTAVOS, ROUND_HALF_UP)

        cuotas.append(CuotaCalculo(
            numero=i,
            fecha_vencimiento=_siguiente_fecha(fecha_inicio, periodicidad, i),
            monto=cuota_monto,
            capital=capital,
            intereses=interes,
            saldo_restante=saldo,
        ))

    return cuotas


# ---------------------------------------------------------------------------
# Entry point público
# ---------------------------------------------------------------------------

def calcular_prestamo(
    monto: Decimal | float | int,
    tasa: Decimal | float | int,
    tipo_tasa: TipoTasa,
    periodicidad: Periodicidad,
    n_cuotas: int,
    fecha_inicio: date,
) -> PrestamoCalculado:
    """
    Calcula el calendario completo de cuotas para un préstamo.

    Args:
        monto:       Capital prestado (siempre positivo).
        tasa:        Tasa de interés POR PERÍODO en porcentaje (ej: 10 = 10%).
        tipo_tasa:   'flat' | 'sobre_saldo' | 'personalizada'.
        periodicidad:'diaria' | 'semanal' | 'quincenal' | 'mensual'.
        n_cuotas:    Cantidad de cuotas (entero positivo).
        fecha_inicio:Fecha de inicio del préstamo (día 0).

    Returns:
        PrestamoCalculado con el calendario completo.

    Raises:
        ValueError: Si los parámetros son inválidos.
    """
    monto = Decimal(str(monto))
    tasa = Decimal(str(tasa))

    if monto <= 0:
        raise ValueError("El monto debe ser mayor a 0")
    if tasa < 0:
        raise ValueError("La tasa no puede ser negativa")
    if n_cuotas <= 0:
        raise ValueError("n_cuotas debe ser mayor a 0")

    # Normalizar 'personalizada' → flat (extensible en el futuro)
    tipo_efectivo = tipo_tasa if tipo_tasa != "personalizada" else "flat"

    if tipo_efectivo == "flat":
        cuotas = _calcular_flat(monto, tasa, n_cuotas, fecha_inicio, periodicidad)
    elif tipo_efectivo == "sobre_saldo":
        cuotas = _calcular_sobre_saldo(monto, tasa, n_cuotas, fecha_inicio, periodicidad)
    else:
        raise ValueError(f"tipo_tasa no soportado: {tipo_tasa}")

    total_pagado = sum(c.monto for c in cuotas)
    total_intereses = sum(c.intereses for c in cuotas)
    monto_cuota_repr = cuotas[0].monto if cuotas else Decimal("0")

    return PrestamoCalculado(
        monto=monto,
        tasa=tasa,
        tipo_tasa=tipo_tasa,
        periodicidad=periodicidad,
        n_cuotas=n_cuotas,
        monto_cuota=monto_cuota_repr,
        monto_total=total_pagado,
        total_intereses=total_intereses,
        fecha_inicio=fecha_inicio,
        fecha_fin_estimada=cuotas[-1].fecha_vencimiento if cuotas else fecha_inicio,
        cuotas=cuotas,
    )


def cuota_a_dict(c: CuotaCalculo) -> dict:
    """Convierte una CuotaCalculo a dict serializable para la API."""
    return {
        "numero": c.numero,
        "fecha_vencimiento": c.fecha_vencimiento.isoformat(),
        "monto": float(c.monto),
        "capital": float(c.capital),
        "intereses": float(c.intereses),
        "saldo_restante": float(c.saldo_restante),
    }
