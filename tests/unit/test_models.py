"""Unit tests for Parking domain model."""

from app.domain.models import Parking, ParkingDetail


def _make_parking(**overrides) -> Parking:
    defaults = {
        "id": 1,
        "name": "Test",
        "status": 1,
        "total_spots": 100,
        "free_spots": 50,
        "tendence": 0,
        "lat": 45.07,
        "lng": 7.68,
    }
    defaults.update(overrides)
    return Parking(**defaults)


class TestStatusLabel:
    def test_aperto(self):
        p = _make_parking(status=1, free_spots=10)
        assert p.status_label == "aperto"

    def test_pieno(self):
        p = _make_parking(status=1, free_spots=0)
        assert p.status_label == "pieno"

    def test_fuori_servizio(self):
        p = _make_parking(status=0, free_spots=None)
        assert p.status_label == "fuori servizio"

    def test_fuori_servizio_with_spots(self):
        p = _make_parking(status=0, free_spots=10)
        assert p.status_label == "fuori servizio"

    def test_nessun_dato(self):
        p = _make_parking(status=1, free_spots=None)
        assert p.status_label == "nessun dato"


class TestParkingIsAvailable:
    def test_available(self):
        p = _make_parking(status=1, free_spots=10)
        assert p.is_available is True

    def test_not_available_status_zero(self):
        p = _make_parking(status=0, free_spots=10)
        assert p.is_available is False

    def test_not_available_zero_spots(self):
        p = _make_parking(status=1, free_spots=0)
        assert p.is_available is False

    def test_not_available_none_spots(self):
        p = _make_parking(status=1, free_spots=None)
        assert p.is_available is False


class TestOccupancyPercentage:
    def test_normal(self):
        p = _make_parking(total_spots=100, free_spots=25)
        assert p.occupancy_percentage == 75.0

    def test_zero_total(self):
        p = _make_parking(total_spots=0, free_spots=0)
        assert p.occupancy_percentage is None

    def test_none_free(self):
        p = _make_parking(free_spots=None)
        assert p.occupancy_percentage is None

    def test_clamp_negative_free(self):
        p = _make_parking(total_spots=100, free_spots=-10)
        assert p.occupancy_percentage == 100.0

    def test_clamp_over_total(self):
        p = _make_parking(total_spots=100, free_spots=200)
        assert p.occupancy_percentage == 0.0

    def test_full_parking(self):
        p = _make_parking(total_spots=50, free_spots=0)
        assert p.occupancy_percentage == 100.0

    def test_empty_parking(self):
        p = _make_parking(total_spots=50, free_spots=50)
        assert p.occupancy_percentage == 0.0


class TestParkingDetail:
    def test_defaults(self):
        d = ParkingDetail(parking_id=1)
        assert d.operator == "GTT"
        assert d.open_24h is True
        assert d.payment_methods == []
        assert d.bus_lines == []

    def test_with_data(self):
        d = ParkingDetail(
            parking_id=10,
            address="Corso Vittorio Emanuele II",
            hourly_rate_daytime=1.00,
            payment_methods=["carte", "Telepass"],
            has_metro_access=True,
        )
        assert d.address == "Corso Vittorio Emanuele II"
        assert d.hourly_rate_daytime == 1.00
        assert "Telepass" in d.payment_methods
        assert d.has_metro_access is True
