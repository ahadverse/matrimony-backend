import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/**
 * Identity-document numbers are not digits-only or fixed-length once you leave
 * Bangladesh: a UK driving licence is alphanumeric (MORGA657054SM9IJ), US state
 * licences mix letters and digits, and many national IDs group characters with
 * hyphens or spaces. The previous `^\d{10,17}$` accepted only the Bangladeshi
 * shapes and rejected every one of those.
 *
 * So this is deliberately permissive: 5-32 letters or digits, with spaces,
 * hyphens and slashes allowed as separators and not counted. It exists to catch
 * an empty or obviously-junk submission, nothing more — an admin compares the
 * number against the selfie before approving, and that review is the real
 * check. Kept in step with the client-side rule in
 * `frontend-v3/src/app/(app)/verify-selfie/page.tsx`.
 */
export class SubmitVerificationDto {
  @ApiProperty({
    description:
      'National ID, passport or driving licence number. 5-32 letters or digits; spaces, hyphens and slashes are allowed and ignored.',
    examples: ['1234567890123', 'MORGA657054SM9IJ', 'AB-1234-CD'],
  })
  // Anchored, and the {5,32} counts only alphanumerics: each separator must be
  // followed by another alphanumeric, so trailing or doubled separators are
  // rejected without a second rule.
  @Matches(/^[A-Za-z0-9](?:[ \-/]?[A-Za-z0-9]){4,31}$/, {
    message:
      'Enter a valid document number — 5 to 32 letters or digits, optionally separated by spaces, hyphens or slashes',
  })
  nidNumber: string;
}
