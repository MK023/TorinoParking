# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please send an email to the repository maintainer with:

1. A description of the vulnerability
2. Steps to reproduce the issue
3. Potential impact
4. Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a timeline for a fix.

## Security Measures

This project implements the following security practices:

- **Dependency scanning**: Dependabot monitors all dependencies (Python, npm, Docker, GitHub Actions) weekly
- **SAST**: Bandit static analysis runs on every PR and push to main
- **Secret detection**: Gitleaks scans for accidentally committed secrets
- **Vulnerability audit**: `pip-audit` and `npm audit` check for known CVEs
- **CodeQL**: GitHub CodeQL analysis for code-level vulnerabilities
- **Docker**: Minimal base images (slim variants) to reduce attack surface

## Dependencies

Dependencies are automatically updated via Dependabot with the following strategy:

- **Minor and patch updates**: Grouped and auto-created weekly
- **Major updates**: Created as individual PRs for manual review
- **GitHub Actions**: Grouped updates for CI dependencies
