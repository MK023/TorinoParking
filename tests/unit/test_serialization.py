"""Unit tests for serialization round-trip and compression logic."""

from app.infrastructure.serialization import (
    COMPRESSED_PREFIX,
    RAW_PREFIX,
    deserialize,
    serialize,
)


class TestSerialization:
    def test_round_trip_compressed(self):
        data = {"parkings": [{"id": i, "name": f"P{i}"} for i in range(50)]}
        blob = serialize(data, compress=True, threshold=100)
        assert blob[0:1] == COMPRESSED_PREFIX
        assert deserialize(blob) == data

    def test_round_trip_uncompressed(self):
        data = {"key": "val"}
        blob = serialize(data, compress=True, threshold=99999)
        assert blob[0:1] == RAW_PREFIX
        assert deserialize(blob) == data

    def test_compress_disabled(self):
        data = {"parkings": [{"id": i} for i in range(100)]}
        blob = serialize(data, compress=False)
        assert blob[0:1] == RAW_PREFIX
        assert deserialize(blob) == data

    def test_small_payload_stays_raw(self):
        data = {"a": 1}
        blob = serialize(data, compress=True, threshold=512)
        assert blob[0:1] == RAW_PREFIX
