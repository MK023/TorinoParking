"""API layer handling HTTP concerns, request validation, and response formatting.

This layer translates between the HTTP protocol and the domain layer.
It owns middleware, dependency injection providers, Pydantic schemas,
and route definitions. Business logic is never implemented here.
"""
