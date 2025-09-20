"""
Serialization utilities for safe JSON conversion of Decimal, Date, and other types.
"""
from decimal import Decimal
from datetime import date, datetime


def as_float(x):
    """Convert Decimal or numeric values to float safely."""
    if x is None:
        return None
    if isinstance(x, Decimal):
        return float(x)
    return float(x)


def as_iso(x):
    """Convert date/datetime to ISO string safely."""
    if x is None:
        return None
    if isinstance(x, (date, datetime)):
        return x.isoformat()
    return str(x)