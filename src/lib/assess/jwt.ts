/**
 * Assessment JWT secret helper.
 * Uses ASSESSMENT_JWT_SECRET (dedicated) with SUPABASE_JWT_SECRET as fallback.
 * Backward compatible: sessions signed with SUPABASE_JWT_SECRET still verify.
 */
export function getAssessmentSecret(): string {
    const secret =
        process.env.ASSESSMENT_JWT_SECRET ||
        process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
        throw new Error(
            '[Assessment JWT] Neither ASSESSMENT_JWT_SECRET nor SUPABASE_JWT_SECRET is set. ' +
            'Add ASSESSMENT_JWT_SECRET to your environment variables.'
        );
    }
    return secret;
}

export function encodeAssessmentSecret(): Uint8Array {
    return new TextEncoder().encode(getAssessmentSecret());
}
