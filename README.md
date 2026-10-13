# Spoke documentation

The Mintlify documentation for [Spoke](https://usespoke.xyz), an open distribution protocol on Monad. This repository is connected to Mintlify for publishing from `main`.

The site contains product explanations, merchant/distributor/buyer guides, real testnet screenshots, architecture diagrams, developer setup, API and contract references, deployment evidence, and a phased roadmap.

## Preview and validate

Use Node.js 24 or later and the official [Mintlify CLI](https://www.mintlify.com/docs/installation):

```bash
npm install -g mint
mint dev --no-open
mint validate
mint broken-links --check-anchors
mint a11y
```

The local preview defaults to `http://localhost:3000`. Configuration and navigation live in `docs.json`; pages are MDX files with title and description frontmatter. Add every published page to navigation, use root-relative internal links, and store images under `images/`.

## Content map

- `index.mdx`, `quickstart.mdx`: introduction and first walkthrough.
- `concepts/`: graph, policy math, settlement, and earnings.
- `guides/`: user journeys, accounts, environments, funding, and troubleshooting.
- `developers/`: architecture, setup, indexing, API, authentication, SDK, and contracts.
- `project/`: implemented scope, public proof, roadmap, and glossary.
- `images/screenshots/`: unmodified captures of the deployed testnet application.
- `images/brand/`, `logo/`: Spoke brand assets and header lockups.

## Keep documentation accurate

The current settlement deployment uses Monad Testnet and non-redeemable SDUSD. Keep Live, Demo, disabled optional integrations, and roadmap items clearly labeled. Never describe scripted fixture transactions as customer revenue, source verification as an audit, or a planned route as a live service.

Verify API claims against the [shared protocol schemas](https://github.com/Enoch208/spoke/tree/main/packages/protocol/src/api) and [live registry](https://api.usespoke.xyz/v1/system/endpoints). Date release-specific status claims. Preserve private keys, sessions, provider credentials, private files, and internal planning material outside this public repository.

Screenshots were captured on 13 October 2026 from the hosted testnet application. They are illustrative views of scripted demonstrations; live chain heights, times, and balances can change.

## Source

Application and contracts: [Enoch208/spoke](https://github.com/Enoch208/spoke). Documentation: [Enoch208/docs-madonna](https://github.com/Enoch208/docs-madonna).
