import type { Route } from 'next';

export const REPO_URL = 'https://github.com/nitingpt000/tribune-arbitrator';

export interface LandingLink {
  label: string;
  href: string;
  external?: boolean;
}

export const NAV_LINKS: LandingLink[] = [
  { label: 'How it works', href: '#how' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Docs', href: `${REPO_URL}#readme`, external: true },
  { label: 'GitHub', href: REPO_URL, external: true },
];

export const HERO = {
  pill: 'ETHGlobal Open Agents · 2026',
  headline: 'An AI court for the agent economy.',
  subhead:
    'When two AI agents disagree about a payment or a service, Tribune runs three LLMs as a jury panel and settles in 60 seconds for under a dollar. ERC-792 compatible — drop into any onchain dispute flow.',
  primaryCta: { label: 'Try the demo', href: '/disputes' as Route },
  secondaryCta: { label: 'View on GitHub', href: REPO_URL, external: true },
  metadata: 'Live on 0G Chain testnet · ERC-792 + ERC-1497 · MIT licensed',
} as const;

export interface PanelistFixture {
  id: string;
  model: string;
  affiliation: string;
  status: 'voted' | 'reasoning';
  reasoning: string;
  vote?: 'refund' | 'reject';
  confidence?: number;
  partial?: string;
}

export const HERO_DISPUTE = {
  shortId: 'TRB-2641',
  claim: 'Service quality',
  summary:
    'Forecast endpoint returned 3 daily entries; SOW article 2 requires a 7-entry array. Refund requested.',
  claimant: 'buyer.verdikt.eth',
  respondent: 'forecaster.verdikt.eth',
  amount: '1,250',
  asset: 'USDC',
  txHash: '0xa83f1e4b0c9d2f5e8a1b6c7d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f607',
} as const;

export const HERO_PANELISTS: PanelistFixture[] = [
  {
    id: 'qwen',
    model: 'qwen3.6-plus',
    affiliation: 'Alibaba',
    status: 'voted',
    reasoning:
      'SOW article 2 specifies daily.length === 7. The respondent\u2019s payload validates against the buyer\u2019s schema with length 3. The defect is on the face of the response. Refund.',
    vote: 'refund',
    confidence: 0.94,
  },
  {
    id: 'glm',
    model: 'glm-5-fp8',
    affiliation: 'Zhipu AI',
    status: 'voted',
    reasoning:
      'Re-running the buyer\u2019s prompt against the seller\u2019s endpoint reproduces the 3-entry response. The schema requires a 7-day forecast; only 3 days were returned. The deliverable does not satisfy the agreement.',
    vote: 'refund',
    confidence: 0.91,
  },
  {
    id: 'llama',
    model: 'llama-4-70b',
    affiliation: 'Meta',
    status: 'reasoning',
    reasoning:
      'Seller invokes a force-majeure clause citing upstream rate-limits. The clause requires written notice within one hour;',
    partial:
      'Seller invokes a force-majeure clause citing upstream rate-limits. The clause requires written notice within one hour;',
  },
];

export const WEDGE = {
  left: {
    label: 'Kleros',
    bullets: [
      'Crowd-staked human jurors',
      'Hours to days per dispute',
      '$50–200+ in juror stakes plus gas',
      'Optimised for $100+ disputes',
    ],
  },
  right: {
    label: 'Tribune',
    bullets: [
      'Three LLMs on 0G Compute as jurors',
      'Under 60 seconds per dispute',
      '$0.50 arbitration fee, sub-$0.10 gas',
      'Optimised for sub-$10 agent micropayments',
    ],
  },
  caption:
    'Same ERC-792 interface. Tribune is a drop-in alternative arbitrator for the dispute tier human juries can\u2019t economically serve.',
} as const;

export interface HowItWorksStep {
  index: string;
  title: string;
  description: string;
}

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    index: '01',
    title: 'Dispute filed',
    description: 'An Arbitrable contract calls Tribune\u2019s createDispute() per ERC-792.',
  },
  {
    index: '02',
    title: 'Evidence sealed',
    description: 'Encrypted bundles uploaded to 0G Storage, accessible only to panel and parties.',
  },
  {
    index: '03',
    title: 'Panel deliberates',
    description: 'Three independent LLMs reason in parallel on 0G Compute. Verifiable inference.',
  },
  {
    index: '04',
    title: 'Verdict settled',
    description:
      'Majority verdict written onchain. KeeperHub guarantees execution, Uniswap settles payouts.',
  },
  {
    index: '05',
    title: 'Reputation updated',
    description:
      'Both parties\u2019 ENS text records updated with dispute outcome and quality scores.',
  },
];

export const ARCHITECTURE = {
  heading: 'Built for inspection, not just demos',
  subtitle:
    'Hexagonal architecture means the panel orchestration is pure domain logic. Every external dependency — 0G Compute, 0G Storage, KeeperHub, ENS — is a swappable adapter behind a stable port.',
  pillars: [
    {
      title: 'Testable',
      body: 'Mock adapters for every port. Full domain runs in unit tests with deterministic stubs. CI runs on every commit.',
    },
    {
      title: 'Swappable',
      body: 'If KeeperHub testnet is congested, the dry-run adapter takes over. Domain doesn\u2019t know.',
    },
    {
      title: 'Audit-ready',
      body: 'Solidity contracts mirror Kleros\u2019s reference Arbitrable contract. ERC-792 compliance tested.',
    },
  ],
} as const;

export const SPONSORS: LandingLink[] = [
  { label: '0G', href: 'https://0g.ai', external: true },
  { label: 'KeeperHub', href: 'https://keeperhub.io', external: true },
  { label: 'ENS', href: 'https://ens.domains', external: true },
  { label: 'Uniswap', href: 'https://uniswap.org', external: true },
  { label: 'ETHGlobal', href: 'https://ethglobal.com/events/openagents', external: true },
];

export const FINAL_CTA = {
  heading: 'See it work.',
  body: 'The full dispute lifecycle takes 47 seconds in the demo. File a dispute, watch three LLMs deliberate, see the verdict settle onchain, and check the agents\u2019 updated reputation.',
  primary: { label: 'Open the demo', href: '/disputes' as Route },
  secondary: { label: 'Read the docs', href: `${REPO_URL}#readme`, external: true },
} as const;

export const FOOTER = {
  tagline: 'An AI court for the agent economy.',
  hackathon: 'ETHGlobal Open Agents · April 24 – May 6, 2026',
  links: [
    { label: 'How it works', href: '#how' },
    { label: 'Architecture', href: '#architecture' },
    { label: 'GitHub', href: REPO_URL, external: true },
    { label: 'Demo', href: '/disputes' },
  ] as LandingLink[],
  legal: '© 2026 Tribune · MIT licensed · Built for ETHGlobal Open Agents',
} as const;
