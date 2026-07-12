# Security Policy

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting
(**Security → Report a vulnerability** on this repository) so the issue is
not public before a fix ships. If that is unavailable, open an issue asking
for a private contact channel — do not post exploit details publicly.

## Scope

The site is fully static (GitHub Pages), has no accounts, no cookies, no
backend, and stores nothing but two localStorage keys (home system,
auto-refresh). Relevant issues are primarily:

- XSS via API-delivered strings (everything should pass through `esc()`)
- Problems in the GitHub Actions workflow or the generator/mirror scripts
- Supply-chain issues (the site must not load anything from third-party
  hosts except the documented data sources)

ESI or eveonline.com issues belong to CCP
(https://github.com/esi/esi-issues), not this repository.
