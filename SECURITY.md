# Security Policy

## Supported versions

The SDK is pre-1.0. The latest published `0.x` minor receives security fixes. Once `1.0` ships, the
current major will be supported.

| Version | Supported |
| --- | --- |
| latest `0.x` | yes |
| older | no |

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue.

- Preferred: open a private advisory at
  <https://github.com/warmbly/warmbly-js/security/advisories/new>.
- Or email <team@warmbly.com> with the details and a reproduction.

We aim to acknowledge reports within three business days and to ship a fix or mitigation as quickly
as the severity warrants. We are happy to credit reporters in the release notes unless you prefer to
stay anonymous.

## Handling credentials

This SDK only transmits the credentials you give it to the Warmbly API over HTTPS. It never logs
tokens. When reporting bugs, redact any API keys (`wmbly_...`), OAuth tokens (`wmat_...`,
`wmrt_...`), client secrets (`wmcs_...`), and webhook secrets (`whsec_...`).
