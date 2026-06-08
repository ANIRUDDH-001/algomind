export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    isAdmin: boolean;
    error?: boolean;
}
