"""Infrastructure layer providing concrete implementations of domain protocols.

Contains the 5T API client, XML parser, Redis cache, PostgreSQL repository,
and shared serialization utilities. Each implementation is injected into
the API layer via FastAPI's dependency system.
"""
