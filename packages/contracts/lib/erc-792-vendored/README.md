# Vendored Kleros ERC-792 sources

Copied verbatim from <https://github.com/kleros/erc-792> at commit
`master` (MIT-licensed). The compatibility test in
`test/KlerosCompat.t.sol` deploys these unmodified to prove that
`TribuneArbitrator` is a drop-in ERC-792 arbitrator.

We vendor (rather than git-submodule) so a clean clone of the Tribune
repo plus `forge install` is enough to run the credibility test —
no extra `git submodule init/update` step required.

| File                        | Origin                                                      |
| --------------------------- | ----------------------------------------------------------- |
| `IArbitrator.sol`           | `kleros/erc-792@master:contracts/IArbitrator.sol`           |
| `IArbitrable.sol`           | `kleros/erc-792@master:contracts/IArbitrable.sol`           |
| `examples/SimpleEscrow.sol` | `kleros/erc-792@master:contracts/examples/SimpleEscrow.sol` |
