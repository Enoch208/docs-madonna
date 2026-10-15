import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const source = resolve(process.argv[2] ?? "../spoke");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(source, "packages/protocol/package.json"));
const { z } = require("zod");
const { clientMethodSchemas } = await import(
  pathToFileURL(join(source, "packages/protocol/src/api/methods.ts")).href
);
const { clientRoutes } = await import(
  pathToFileURL(join(source, "packages/protocol/src/api/transport.ts")).href
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: source,
  encoding: "utf8",
}).trim();
const methodSource = readFileSync(
  join(source, "packages/protocol/src/api/methods.ts"),
  "utf8",
).split("\n");
const groups = [
  {
    slug: "identity",
    title: "Identity and accounts",
    names: ["auth", "account", "notifications", "workspace"],
    description:
      "Wallet authentication, account profiles, recovery, sessions, wallets, passkeys, and notification preferences.",
  },
  {
    slug: "commerce",
    title: "Merchants, products, and campaigns",
    names: ["merchants", "products", "campaigns", "studio"],
    description:
      "Merchant profiles, product records and assets, campaign drafts and publication, and policy simulation.",
  },
  {
    slug: "distribution",
    title: "Links, graphs, and reputation",
    names: ["links", "graph", "reputation", "distributors"],
    description:
      "Distribution links, graph navigation, ancestry, public records, visibility, and distributor discovery.",
  },
  {
    slug: "settlement",
    title: "Checkout, receipts, and earnings",
    names: [
      "checkout",
      "receipts",
      "fulfillment",
      "earnings",
      "vault",
      "reports",
      "disputes",
    ],
    description:
      "Checkout intents, delivery access, receipt proof, earnings, vault accounting, reports, and refund-request workflows.",
  },
  {
    slug: "funding",
    title: "Funding and insights",
    names: ["funding", "insights"],
    description:
      "Testnet gas assistance, optional Aurora mainnet funding, and cached external wallet context.",
  },
  {
    slug: "platform",
    title: "System, support, and developer tools",
    names: [
      "networks",
      "tokens",
      "support",
      "system",
      "playground",
      "clients",
      "ops",
    ],
    description:
      "Network catalogs, status, endpoint discovery, support, developer surfaces, and operator-scoped methods.",
  },
  {
    slug: "extensions",
    title: "Designed extension methods",
    names: [],
    description:
      "The complete remaining contract for extension workflows; availability is labeled method by method.",
  },
];
const allNames = new Set(groups.flatMap((g) => g.names));
const escape = (s: unknown) =>
  String(s).replaceAll("|", "\\|").replaceAll("\n", " ");
const typeOf = (s: any): string => {
  if (s.$ref) return `Reference: ${s.$ref.split("/").pop()}`;
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((v: any) => JSON.stringify(v)).join(" · ");
  if (s.anyOf || s.oneOf)
    return [...new Set((s.anyOf ?? s.oneOf).map(typeOf))].join(" or ");
  if (s.type === "array") return `${typeOf(s.items ?? {})}[]`;
  if (Array.isArray(s.type)) return s.type.join(" or ");
  return s.type ?? "See JSON schema";
};
const constraints = (s: any) => {
  const a = [];
  for (const [k, label] of Object.entries({
    minimum: "Minimum",
    maximum: "Maximum",
    exclusiveMinimum: "Greater than",
    exclusiveMaximum: "Less than",
    minLength: "Min length",
    maxLength: "Max length",
    minItems: "Min items",
    maxItems: "Max items",
    format: "Format",
  }))
    if (s[k] !== undefined) a.push(`${label}: ${s[k]}`);
  if (s.pattern) a.push("Pattern validated; see input schema");
  if (s.default !== undefined)
    a.push(`Default: \`${escape(JSON.stringify(s.default))}\``);
  return a.join("; ") || "See nested schema and runtime validation";
};
const deref = (s: any, root: any, seen = new Set<string>()): any => {
  if (s.$ref && !seen.has(s.$ref)) {
    const value = s.$ref
      .split("/")
      .slice(1)
      .reduce((v: any, k: string) => v?.[k], root);
    return value
      ? deref(
          {
            ...value,
            ...Object.fromEntries(
              Object.entries(s).filter(([k]) => k !== "$ref"),
            ),
          },
          root,
          new Set([...seen, s.$ref]),
        )
      : s;
  }
  if (s.anyOf)
    return { ...s, anyOf: s.anyOf.map((v: any) => deref(v, root, seen)) };
  if (s.type === "array")
    return { ...s, items: deref(s.items ?? {}, root, seen) };
  return s;
};
const fieldTable = (s: any) => {
  if (!s.properties)
    return `Output shape: **${escape(typeOf(s))}**. See the complete schema below.\n`;
  const required = new Set(s.required ?? []);
  if (!Object.keys(s.properties).length)
    return "No fields. Use an empty object for the client method input.\n";
  return (
    "| Field | Type | Required | Constraints |\n| --- | --- | --- | --- |\n" +
    Object.entries(s.properties)
      .map(
        ([k, v]) =>
          `| \`${k}\` | ${escape(typeOf(deref(v, s)))} | ${required.has(k) ? "Yes" : "No"} | ${constraints(deref(v, s))} |`,
      )
      .join("\n") +
    "\n"
  );
};
const entries = Object.entries(clientMethodSchemas).map(
  ([name, schemas]: [string, any]) => {
    const route = clientRoutes[name];
    const input = z.toJSONSchema(schemas.input, {
      io: "input",
      unrepresentable: "any",
      reused: "ref",
    });
    const output = z.toJSONSchema(schemas.output, {
      io: "output",
      unrepresentable: "any",
      reused: "ref",
    });
    const status =
      schemas.release === "demo-only"
        ? "Designed — unavailable"
        : name.startsWith("funding.aurora")
          ? "Optional — check configuration"
          : "Core live";
    const line = methodSource.findIndex((l) => l.includes(`"${name}":`)) + 1;
    return {
      name,
      release: schemas.release,
      status,
      route,
      input,
      output,
      source: `https://github.com/Enoch208/spoke/blob/${commit}/packages/protocol/src/api/methods.ts#L${line}`,
    };
  },
);
mkdirSync(join(root, "schemas"), { recursive: true });
mkdirSync(join(root, "reference"), { recursive: true });
writeFileSync(
  join(root, "schemas/client-methods.json"),
  JSON.stringify(
    {
      sourceCommit: commit,
      description:
        "Structural JSON Schema projections of the shared Zod client contract. Custom refinements, transforms, binary values, and runtime authorization require the original Zod schemas and server implementation. Inputs are client method objects before HTTP transport mapping.",
      methods: entries,
    },
    null,
    2,
  ) + "\n",
);
for (const group of groups) {
  const methods = entries.filter((e) =>
    group.slug === "extensions"
      ? !allNames.has(e.name.split(".")[0])
      : group.names.includes(e.name.split(".")[0]),
  );
  let body = `---\ntitle: ${JSON.stringify(group.title)}\ndescription: ${JSON.stringify(group.description)}\n---\n\n${group.description}\n\nThis reference is generated from application commit [\`${commit.slice(0, 7)}\`](https://github.com/Enoch208/spoke/commit/${commit}). It covers **${methods.length} client methods** in this group.\n\n<Note>Input schemas describe the typed client call before path/query/body mapping. Output schemas describe the envelope's \`data\`, not the full HTTP response. Custom refinements, transforms, and runtime permissions are enforced by the [shared Zod contract](https://github.com/Enoch208/spoke/tree/${commit}/packages/protocol/src/api). Read [transport rules](/developers/http-transport) before copying a client object into an HTTP body. Designed methods reject live calls; optional funding still requires provider configuration.</Note>\n\n[Download all method schemas](https://raw.githubusercontent.com/Enoch208/docs-madonna/main/schemas/client-methods.json) · [Live endpoint registry](https://api.usespoke.xyz/v1/system/endpoints)\n\n## Methods at a glance\n\n| Client method | HTTP route | Access | Availability |\n| --- | --- | --- | --- |\n`;
  body +=
    methods
      .map(
        (e) =>
          `| [\`${e.name}\`](#${e.name.replaceAll(".", "-").toLowerCase()}) | \`${e.route.verb} /v1${e.route.path}\` | ${e.route.auth} | ${e.status} |`,
      )
      .join("\n") + "\n";
  for (const e of methods) {
    body += `\n## ${e.name}\n\n**${e.route.verb} \`/v1${e.route.path}\`** · **${e.status}** · Access: **${e.route.auth}**. [Source definition](${e.source}).\n\n`;
    if (e.route.auth === "session")
      body +=
        "An authenticated session is necessary; ownership, merchant/operator scope, and any fresh-confirmation requirements are checked separately by the service.\n\n";
    if (e.route.idempotencyField)
      body += `Idempotency field: \`${e.route.idempotencyField}\`. The frontend also sends this value in the \`idempotency-key\` header. Preserve the same identifier when resuming the same logical action.\n\n`;
    if (e.route.payload)
      body += `HTTP body mapping: send the \`${e.route.payload}\` property itself after removing path fields, rather than the complete client input wrapper.\n\n`;
    if (e.route.multipart)
      body +=
        "Transport: multipart form data. File/blob inputs require the original runtime schema; JSON Schema cannot represent browser Blob validation.\n\n";
    if (e.name === "vault.get")
      body +=
        "With a `campaignId`, the frontend selects `GET /v1/merchant/campaigns/:campaignId/vault`. Without it, the route above is the aggregate view.\n\n";
    body +=
      "**Client input fields**\n\n" +
      fieldTable(e.input) +
      '\n<AccordionGroup>\n\n<Accordion title="Structural input JSON schema">\n\n```json\n' +
      JSON.stringify(e.input, null, 2) +
      '\n```\n\n</Accordion>\n\n<Accordion title="Structural output JSON schema">\n\n```json\n' +
      JSON.stringify(e.output, null, 2) +
      "\n```\n\n</Accordion>\n\n</AccordionGroup>\n";
  }
  writeFileSync(join(root, `reference/${group.slug}.mdx`), body);
}
const seen = new Set(entries.map((e) => e.name));
if (seen.size !== 194)
  throw new Error(
    `Expected 194 methods; got ${seen.size}. Review release scope and update this guard.`,
  );
console.log(
  `Generated ${seen.size} methods in ${groups.length} reference pages at ${commit.slice(0, 7)}.`,
);

const { spokeProtocolAbi } = await import(
  pathToFileURL(join(source, "packages/protocol/src/abi/spoke-protocol.ts"))
    .href
);
const eventNotes: Record<string, string> = {
  CampaignCreated:
    "Establishes the campaign, merchant, product commitment, price, token, and initial policy hash. Creation is not activation.",
  PolicyVersionRegistered:
    "Records the terms and effective time of a policy version. A scheduled version is not effective merely because the event exists.",
  CampaignFunded:
    "Adds received tokens to the separate reward budget. The funder is not necessarily the campaign merchant.",
  CampaignStatusChanged:
    "Records active, paused, and ended flags. Time-based expiry still needs evaluation against the applicable policy.",
  NodeCreated:
    "Records an immutable parent edge and node owner inside a campaign. This is attribution, not a commission payment.",
  NativePurchaseAccepted:
    "Records a purchase, accepted policy, price, reserved reward, and unlock time. Finalization is a later event.",
  RewardReserved:
    "Records one pending allocation. A reservation is not yet claimable.",
  SaleRefunded:
    "Returns the buyer payment and releases the reserved reward before unlock. This is terminal for the sale.",
  SaleFinalized:
    "Moves merchant proceeds and rewards to claimable liabilities after the hold. This does not itself transfer all beneficiaries their funds.",
  RewardVested:
    "Records an individual allocation becoming claimable as part of finalization.",
  RewardClaimed:
    "Records a recipient withdrawing reward balance from a campaign. One token-wide claim can emit multiple campaign events.",
  MerchantProceedsClaimed:
    "Records the merchant withdrawing claimable product proceeds for a campaign.",
  SurplusReturned:
    "Records unused available rewards returned to the merchant under the lifecycle restrictions.",
};
let eventBody = `---\ntitle: "Contract event reference"\ndescription: "Decode every protocol event and connect it to attribution, policy, settlement, and claims."\n---\n\nThis reference is generated from the protocol ABI at [\`${commit.slice(0, 7)}\`](https://github.com/Enoch208/spoke/commit/${commit}). It documents protocol events; ERC-20 token transfer events are a separate stream.\n\n## Event processing rules\n\nUse the generated ABI to decode logs. Preserve chain ID, contract address, transaction hash, log index, block number, block hash, and block timestamp. Process canonical ordering and handle removed/reorganized history; a log seen once is not a permanent settlement fact.\n\nSeveral events can describe one action. A purchase emits its acceptance and allocation reservations; finalization emits vesting events as well as the sale result. Do not add those events as separate sales or count both reservations and vesting as new earnings.\n\nSee [indexing](/developers/indexing), [data model](/developers/data-model), and [vault accounting](/concepts/vault-accounting).\n`;
for (const event of spokeProtocolAbi.filter((e: any) => e.type === "event")) {
  eventBody += `\n## ${event.name}\n\n${eventNotes[event.name] ?? "See the contract source for the emitting action."}\n\n| Field | ABI type | Indexed topic |\n| --- | --- | --- |\n`;
  eventBody +=
    event.inputs
      .map(
        (i: any) =>
          `| \`${i.name}\` | \`${i.type}\` | ${i.indexed ? "Yes" : "No"} |`,
      )
      .join("\n") + "\n";
  if (event.inputs.some((i: any) => i.components))
    eventBody +=
      '\n<Accordion title="Tuple field definition">\n\n```json\n' +
      JSON.stringify(
        event.inputs.filter((i: any) => i.components),
        null,
        2,
      ) +
      "\n```\n\n</Accordion>\n";
}
writeFileSync(join(root, "developers/events.mdx"), eventBody);
const { errorCodes } = await import(
  pathToFileURL(join(source, "packages/protocol/src/errors.ts")).href
);
writeFileSync(
  join(root, "schemas/error-codes.json"),
  JSON.stringify({ sourceCommit: commit, errorCodes }, null, 2) + "\n",
);
