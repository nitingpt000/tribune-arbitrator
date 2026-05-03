import type { DomainLogger } from '../../domain/ports/logger.port';

/**
 * Uniswap settlement leg.
 *
 * Used when an Arbitrable wants to refund in a different token than the one it
 * holds — e.g. ExampleEscrow holds USDC but the buyer requested a refund in
 * native ETH. The Arbitrable calls a small SettlementHelper contract that uses
 * this adapter on the panel side as the off-chain swap planner.
 *
 * Live availability of Uniswap on 0G Galileo testnet is uncertain at the time
 * of writing — see FEEDBACK.md. When the router is missing, the adapter logs
 * a clear "uniswap_not_deployed" warning and the Arbitrable receives the
 * verdict in the original token.
 */

export interface SwapInput {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  recipient: string;
}

export interface SwapResult {
  amountOut: bigint;
  txHash: string;
}

export interface UniswapSettlementOptions {
  rpcUrl: string;
  routerAddress: string | null;
  signerKey: string | null;
  logger: DomainLogger;
}

export class UniswapSettlementAdapter {
  constructor(private readonly opts: UniswapSettlementOptions) {}

  async swapExactInput(input: SwapInput): Promise<SwapResult> {
    if (!this.opts.routerAddress || !this.opts.signerKey) {
      this.opts.logger.warn('uniswap.not_configured', {
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        amountIn: input.amountIn.toString(),
      });
      return { amountOut: 0n, txHash: '0x' };
    }

    const ethers = await import('ethers').catch(() => null);
    if (!ethers) {
      this.opts.logger.warn('uniswap.ethers_missing');
      return { amountOut: 0n, txHash: '0x' };
    }

    const provider = new ethers.JsonRpcProvider(this.opts.rpcUrl);
    const signer = new ethers.Wallet(this.opts.signerKey, provider);

    // Uniswap V3 SwapRouter02 minimal interface
    const routerAbi = [
      'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
    ];
    const router = new ethers.Contract(this.opts.routerAddress, routerAbi, signer) as unknown as {
      exactInputSingle(args: {
        tokenIn: string;
        tokenOut: string;
        fee: number;
        recipient: string;
        amountIn: bigint;
        amountOutMinimum: bigint;
        sqrtPriceLimitX96: number;
      }): Promise<{ hash: string; wait(): Promise<{ logs?: ReadonlyArray<unknown> }> }>;
    };
    try {
      const tx = await router.exactInputSingle({
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        fee: 3000,
        recipient: input.recipient,
        amountIn: input.amountIn,
        amountOutMinimum: input.minAmountOut,
        sqrtPriceLimitX96: 0,
      });
      const receipt = await tx.wait();
      void receipt;
      this.opts.logger.info('uniswap.swap.submitted', { txHash: tx.hash });
      return { amountOut: input.minAmountOut, txHash: tx.hash };
    } catch (err) {
      this.opts.logger.warn('uniswap.swap_failed', {
        error: (err as Error).message,
      });
      return { amountOut: 0n, txHash: '0x' };
    }
  }
}
