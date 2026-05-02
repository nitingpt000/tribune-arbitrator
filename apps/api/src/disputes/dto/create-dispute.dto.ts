import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, Matches, Min } from 'class-validator';

export class CreateDisputeDto {
  @ApiProperty({
    description: 'Arbitrable contract address (EVM)',
    example: '0x0000000000000000000000000000000000000000',
  })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'arbitrable must be a 0x-prefixed EVM address' })
  arbitrable!: string;

  @ApiProperty({ description: 'External dispute id from the arbitrable contract' })
  @IsString()
  externalDisputeId!: string;

  @ApiProperty({ description: 'Number of ruling choices', minimum: 1, example: 2 })
  @IsInt()
  @Min(1)
  choices!: number;

  @ApiProperty({ description: 'Optional metadata URI (IPFS or HTTPS)', required: false })
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https', 'ipfs'] })
  metadataUri?: string;
}
