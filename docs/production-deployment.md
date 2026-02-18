# Production Deployment Checklist

## Pre-Deployment

### Code Quality
- [x] All 6 integration tests passing
- [ ] Run `npm run build` - no errors
- [ ] Run `npm run lint` - no warnings
- [ ] Run `npm run type-check` - no errors
- [ ] Bundle size < 500KB gzipped (check with `npm run build:analyze`)

### Feature Flags
- [ ] All flags have correct default values in production
- [ ] Admin panel accessible at /admin/features
- [ ] VAD disabled by default (gradual rollout)
- [ ] Smart routing enabled (improves UX)
- [ ] Caching enabled (improves performance)

### Environment Variables
- [ ] All API keys set in production environment
- [ ] Analytics keys configured (PostHog, Sentry)
- [ ] Rate limits configured appropriately
- [ ] CORS settings correct

### Database
- [ ] All migrations applied
- [ ] Indexes created for performance
- [ ] Backup configured
- [ ] Connection pool sized correctly

### Monitoring
- [ ] Error tracking (Sentry) configured
- [ ] Performance monitoring (Web Vitals) active
- [ ] Voice analytics tracking implemented
- [ ] Alerts configured for critical errors

### Security
- [ ] API keys not exposed to client
- [ ] Rate limiting active
- [ ] Input validation on all API routes
- [ ] HTTPS enforced
- [ ] CSP headers configured

## Deployment Steps

1. **Create Production Build**
   ```bash
   npm run build
   npm run start # Test production build locally
   ```

2. **Deploy to Vercel/Platform**
   ```bash
   vercel --prod
   # OR
   git push origin main # If using auto-deploy
   ```

3. **Verify Deployment**
   - Visit production URL
   - Check all pages load correctly
   - Test voice interview flow manually
   - Verify feature flags work

4. **Enable Monitoring**
   - Check Sentry for errors
   - Verify analytics events firing
   - Monitor response times

## Post-Deployment

### Smoke Tests (Manual)
- [ ] Navigate to /interview
- [ ] Start interview (manual mode)
- [ ] Speak and verify transcription
- [ ] AI responds appropriately
- [ ] Complete interview and save session
- [ ] Check assessment generated generated correctly

### Feature Flag Rollout (Week by Week)
- **Week 1**: Internal testing
  - Enable VAD for team members only
  - Monitor for issues
  - Collect feedback

- **Week 2**: 10% rollout
  - Use localStorage A/B flag: `voice_beta_user=true`
  - Track metrics: interruption rate, satisfaction, latency
  - Monitor error rate

- **Week 3**: 50% rollout
  - If Week 2 metrics good, increase to 50%
  - Continue monitoring

- **Week 4**: Full rollout or rollback based on data
  - If all metrics positive: enable for 100%
  - If issues: rollback and investigate

### Metrics to Monitor
- [ ] Voice interview completion rate
- [ ] Average interview duration
- [ ] VAD initialization success rate
- [ ] Interruption frequency
- [ ] Cache hit rate
- [ ] Smart routing distribution (Groq vs Gemini)
- [ ] User satisfaction scores
- [ ] Error rate (should be < 1%)
- [ ] P95 latency (should be < 2s)

### Rollback Procedure
If critical issues detected:

1. **Immediate**: Disable VAD via admin panel
   - Navigate to /admin/features
   - Toggle ENABLE_VAD_INTERRUPTIONS to OFF
   - Broadcast via localStorage

2. **If issues persist**: Rollback deployment
   ```bash
   vercel rollback
   # OR revert git commit
   git revert HEAD
   git push origin main
   ```

3. **Investigate**: Check logs, Sentry errors, analytics

4. **Fix**: Address issues in development

5. **Re-test**: Run full test suite again

6. **Re-deploy**: When confident in fix

## Success Criteria

Deployment is successful when:
- ✅ All smoke tests pass
- ✅ No critical errors in Sentry
- ✅ P95 latency < 2s
- ✅ Error rate < 1%
- ✅ Users can complete interviews end-to-end
- ✅ Feature flags control behavior correctly
- ✅ Rollback procedure tested and works
