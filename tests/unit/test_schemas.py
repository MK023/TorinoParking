"""Unit tests for API schema edge cases."""

from app.api.schemas import ParkingDetailSchema


def test_detail_schema_normalizes_null_arrays():
    """Regression: bus_lines/payment_methods sono nullable nel DB.

    Un NULL deve diventare lista vuota, non far esplodere model_validate
    (che ucciderebbe il ciclo scheduler e /nearby alla prima riga senza
    array valorizzati).
    """
    detail = ParkingDetailSchema.model_validate({"bus_lines": None, "payment_methods": None})
    assert detail.bus_lines == []
    assert detail.payment_methods == []
