# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.5.x   | :white_check_mark: |
| 0.4.x   | :white_check_mark: |
| < 0.4   | :x:                |

## Security Model

OCC is designed to operate entirely on your local machine:

- **Local-only file parsing**: All document parsing happens locally — no files are uploaded or transmitted
- **No telemetry**: No data is sent to external servers
- **No credentials**: OCC does not store or handle any API keys, tokens, or passwords
- **No network access**: The only network call is the optional scc binary download during `npm install` (skip with `SCC_SKIP_DOWNLOAD=1`)

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting feature
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial assessment**: Within 1 week
- **Resolution timeline**: Depends on severity, typically 1-4 weeks

## Security Best Practices for Users

1. **Keep dependencies updated**: Regularly update npm dependencies
2. **Review postinstall scripts**: The postinstall script downloads the scc binary — review if concerned

## Scope

This security policy covers:
- The OCC CLI tool (`bin/`, `src/`)
- The postinstall script (`scripts/postinstall.js`)

It does not cover:
- The scc binary (report to [scc maintainers](https://github.com/boyter/scc))
- Third-party npm dependencies (report to respective maintainers)
