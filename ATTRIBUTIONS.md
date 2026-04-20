# ATTRIBUTIONS — Open Source Components

This project uses the following open-source packages. All licenses are compatible with commercial use.

| Package | License | Purpose |
|---------|---------|---------|
| express | MIT | HTTP framework |
| pg | MIT | PostgreSQL client |
| bcryptjs | MIT | Password hashing |
| jsonwebtoken | MIT | JWT auth tokens |
| dotenv | BSD-2-Clause | Environment config |
| helmet | MIT | Security headers |
| cors | MIT | CORS middleware |
| express-rate-limit | MIT | Rate limiting |
| uuid | MIT | UUID generation |
| axios | MIT | HTTP client |
| resend | MIT | Email delivery |
| handlebars | MIT | Email templating |
| pdfkit | MIT | PDF generation |
| knex | MIT | SQL query builder |

## License Policy

This system prohibits use of AGPL or GPL-licensed components in the production codebase.
All dependencies are audited via `npm audit` and `license-checker` in CI/CD.

A Software Bill of Materials (SBOM) can be generated at any time using:
```
npx @cyclonedx/bom -o sbom.json
```
