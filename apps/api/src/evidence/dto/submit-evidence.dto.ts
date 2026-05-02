import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, Matches } from 'class-validator';

export class SubmitEvidenceDto {
  @ApiProperty({ description: 'Submitter address (EVM)' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'submitter must be a 0x-prefixed EVM address' })
  submitter!: string;

  @ApiProperty({ description: 'Evidence URI (IPFS or HTTPS)' })
  @IsUrl({ require_tld: false, protocols: ['http', 'https', 'ipfs'] })
  uri!: string;

  @ApiProperty({ description: '32-byte content hash, 0x-prefixed' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'contentHash must be a 32-byte hex digest' })
  contentHash!: string;
}
