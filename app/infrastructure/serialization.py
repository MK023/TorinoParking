"""Shared serialization utilities for Redis-compatible data encoding.

Provides orjson serialization with optional zlib compression. A single-byte
prefix distinguishes compressed from raw payloads, allowing transparent
decompression regardless of which component wrote the data.
"""

import zlib

import orjson

COMPRESSED_PREFIX = b"\x01"
RAW_PREFIX = b"\x00"


def serialize(value: dict, *, compress: bool = True, threshold: int = 512) -> bytes:
    raw = orjson.dumps(value)
    if compress and len(raw) > threshold:
        return COMPRESSED_PREFIX + zlib.compress(raw, level=6)
    return RAW_PREFIX + raw


def deserialize(data: bytes) -> dict:
    if data[0:1] == COMPRESSED_PREFIX:
        raw = zlib.decompress(data[1:])
    else:
        raw = data[1:]
    return orjson.loads(raw)
