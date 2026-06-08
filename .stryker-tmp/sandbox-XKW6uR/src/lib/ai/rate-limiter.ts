// @ts-nocheck
// Intelligent Rate Limiter using Upstash Redis for global shared state.
// Tracks RPM, RPD, TPM with safety margins and exponential backoff
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { ModelConfig } from './providers';
import { getRedis, isCircuitOpen, recordRedisAttempt, redisGet, redisSet } from '../upstash/client';
import { markModelDeprecated } from './model-registry';
import { logSystemEvent } from '../monitoring/events';
import { getFailureMode } from '../rate-limit/decision-layer';
interface RateLimitResult {
  allowed: boolean;
  model?: ModelConfig;
  waitMs?: number;
  reason?: string;
}
export class IntelligentRateLimiter {
  // Cooldown tiers in milliseconds: 5m, 10m, 20m, 40m, 80m
  private readonly COOLDOWN_TIERS = stryMutAct_9fa48("1463") ? [] : (stryCov_9fa48("1463"), [stryMutAct_9fa48("1464") ? 5 / 60 : (stryCov_9fa48("1464"), 5 * 60), stryMutAct_9fa48("1465") ? 10 / 60 : (stryCov_9fa48("1465"), 10 * 60), stryMutAct_9fa48("1466") ? 20 / 60 : (stryCov_9fa48("1466"), 20 * 60), stryMutAct_9fa48("1467") ? 40 / 60 : (stryCov_9fa48("1467"), 40 * 60), stryMutAct_9fa48("1468") ? 80 / 60 : (stryCov_9fa48("1468"), 80 * 60)]);
  constructor() {}

  /**
   * Check if a specific model can be used.
   * Hits Upstash Redis to check shared global rate counters.
   */
  async canUseModel(modelId: string, models: ModelConfig[], _estimatedTokens: number = 0): Promise<RateLimitResult> {
    if (stryMutAct_9fa48("1469")) {
      {}
    } else {
      stryCov_9fa48("1469");
      const model = models.find(stryMutAct_9fa48("1470") ? () => undefined : (stryCov_9fa48("1470"), m => stryMutAct_9fa48("1473") ? m.id !== modelId : stryMutAct_9fa48("1472") ? false : stryMutAct_9fa48("1471") ? true : (stryCov_9fa48("1471", "1472", "1473"), m.id === modelId)));
      if (stryMutAct_9fa48("1476") ? false : stryMutAct_9fa48("1475") ? true : stryMutAct_9fa48("1474") ? model : (stryCov_9fa48("1474", "1475", "1476"), !model)) return stryMutAct_9fa48("1477") ? {} : (stryCov_9fa48("1477"), {
        allowed: stryMutAct_9fa48("1478") ? true : (stryCov_9fa48("1478"), false),
        reason: stryMutAct_9fa48("1479") ? "" : (stryCov_9fa48("1479"), 'model_not_found')
      });
      const failureMode = getFailureMode(stryMutAct_9fa48("1480") ? "" : (stryCov_9fa48("1480"), 'ai_model_selection'));
      const redis = getRedis();
      // AI model selection is critical and follows centralized fail policy.
      if (stryMutAct_9fa48("1482") ? false : stryMutAct_9fa48("1481") ? true : (stryCov_9fa48("1481", "1482"), isCircuitOpen())) {
        if (stryMutAct_9fa48("1483")) {
          {}
        } else {
          stryCov_9fa48("1483");
          return (stryMutAct_9fa48("1486") ? failureMode !== 'fail-closed' : stryMutAct_9fa48("1485") ? false : stryMutAct_9fa48("1484") ? true : (stryCov_9fa48("1484", "1485", "1486"), failureMode === (stryMutAct_9fa48("1487") ? "" : (stryCov_9fa48("1487"), 'fail-closed')))) ? stryMutAct_9fa48("1488") ? {} : (stryCov_9fa48("1488"), {
            allowed: stryMutAct_9fa48("1489") ? true : (stryCov_9fa48("1489"), false),
            reason: stryMutAct_9fa48("1490") ? "" : (stryCov_9fa48("1490"), 'limiter_unavailable')
          }) : stryMutAct_9fa48("1491") ? {} : (stryCov_9fa48("1491"), {
            allowed: stryMutAct_9fa48("1492") ? false : (stryCov_9fa48("1492"), true),
            model
          });
        }
      }
      if (stryMutAct_9fa48("1495") ? false : stryMutAct_9fa48("1494") ? true : stryMutAct_9fa48("1493") ? redis : (stryCov_9fa48("1493", "1494", "1495"), !redis)) {
        if (stryMutAct_9fa48("1496")) {
          {}
        } else {
          stryCov_9fa48("1496");
          return (stryMutAct_9fa48("1499") ? failureMode !== 'fail-closed' : stryMutAct_9fa48("1498") ? false : stryMutAct_9fa48("1497") ? true : (stryCov_9fa48("1497", "1498", "1499"), failureMode === (stryMutAct_9fa48("1500") ? "" : (stryCov_9fa48("1500"), 'fail-closed')))) ? stryMutAct_9fa48("1501") ? {} : (stryCov_9fa48("1501"), {
            allowed: stryMutAct_9fa48("1502") ? true : (stryCov_9fa48("1502"), false),
            reason: stryMutAct_9fa48("1503") ? "" : (stryCov_9fa48("1503"), 'limiter_unavailable')
          }) : stryMutAct_9fa48("1504") ? {} : (stryCov_9fa48("1504"), {
            allowed: stryMutAct_9fa48("1505") ? false : (stryCov_9fa48("1505"), true),
            model
          });
        }
      }
      try {
        if (stryMutAct_9fa48("1506")) {
          {}
        } else {
          stryCov_9fa48("1506");
          // a. Check cooldown key — check levels 0 through 4 (max array size)
          // By testing each potential cooldown tier key manually. (O(1) fast cache reads)
          const cooldownKeys = this.COOLDOWN_TIERS.map(stryMutAct_9fa48("1507") ? () => undefined : (stryCov_9fa48("1507"), (_, idx) => stryMutAct_9fa48("1508") ? `` : (stryCov_9fa48("1508"), `rl:${modelId}:cooldown:${idx}`)));
          if (stryMutAct_9fa48("1512") ? cooldownKeys.length <= 0 : stryMutAct_9fa48("1511") ? cooldownKeys.length >= 0 : stryMutAct_9fa48("1510") ? false : stryMutAct_9fa48("1509") ? true : (stryCov_9fa48("1509", "1510", "1511", "1512"), cooldownKeys.length > 0)) {
            if (stryMutAct_9fa48("1513")) {
              {}
            } else {
              stryCov_9fa48("1513");
              const cooldowns = await redis.mget(...cooldownKeys);
              recordRedisAttempt(stryMutAct_9fa48("1514") ? false : (stryCov_9fa48("1514"), true));
              const inCooldown = stryMutAct_9fa48("1515") ? cooldowns.every(val => val !== null && val !== undefined) : (stryCov_9fa48("1515"), cooldowns.some(stryMutAct_9fa48("1516") ? () => undefined : (stryCov_9fa48("1516"), val => stryMutAct_9fa48("1519") ? val !== null || val !== undefined : stryMutAct_9fa48("1518") ? false : stryMutAct_9fa48("1517") ? true : (stryCov_9fa48("1517", "1518", "1519"), (stryMutAct_9fa48("1521") ? val === null : stryMutAct_9fa48("1520") ? true : (stryCov_9fa48("1520", "1521"), val !== null)) && (stryMutAct_9fa48("1523") ? val === undefined : stryMutAct_9fa48("1522") ? true : (stryCov_9fa48("1522", "1523"), val !== undefined))))));
              if (stryMutAct_9fa48("1525") ? false : stryMutAct_9fa48("1524") ? true : (stryCov_9fa48("1524", "1525"), inCooldown)) {
                if (stryMutAct_9fa48("1526")) {
                  {}
                } else {
                  stryCov_9fa48("1526");
                  return stryMutAct_9fa48("1527") ? {} : (stryCov_9fa48("1527"), {
                    allowed: stryMutAct_9fa48("1528") ? true : (stryCov_9fa48("1528"), false),
                    model,
                    reason: stryMutAct_9fa48("1529") ? "" : (stryCov_9fa48("1529"), 'cooldown')
                  });
                }
              }
            }
          }

          // b. Check rpm counter with atomic INCR
          const rpmKey = stryMutAct_9fa48("1530") ? `` : (stryCov_9fa48("1530"), `rl:${modelId}:rpm`);
          const currentRpm = await redis.incr(rpmKey);
          recordRedisAttempt(stryMutAct_9fa48("1531") ? false : (stryCov_9fa48("1531"), true));
          if (stryMutAct_9fa48("1534") ? currentRpm !== 1 : stryMutAct_9fa48("1533") ? false : stryMutAct_9fa48("1532") ? true : (stryCov_9fa48("1532", "1533", "1534"), currentRpm === 1)) await redis.expire(rpmKey, 65);
          if (stryMutAct_9fa48("1538") ? currentRpm <= model.rpm : stryMutAct_9fa48("1537") ? currentRpm >= model.rpm : stryMutAct_9fa48("1536") ? false : stryMutAct_9fa48("1535") ? true : (stryCov_9fa48("1535", "1536", "1537", "1538"), currentRpm > model.rpm)) {
            if (stryMutAct_9fa48("1539")) {
              {}
            } else {
              stryCov_9fa48("1539");
              await redis.decr(rpmKey);
              return stryMutAct_9fa48("1540") ? {} : (stryCov_9fa48("1540"), {
                allowed: stryMutAct_9fa48("1541") ? true : (stryCov_9fa48("1541"), false),
                model,
                reason: stryMutAct_9fa48("1542") ? "" : (stryCov_9fa48("1542"), 'rpm_limit')
              });
            }
          }

          // c. Check day counter
          const dayKey = stryMutAct_9fa48("1543") ? `` : (stryCov_9fa48("1543"), `rl:${modelId}:day`);
          const currentDay = await redis.incr(dayKey);
          recordRedisAttempt(stryMutAct_9fa48("1544") ? false : (stryCov_9fa48("1544"), true));
          if (stryMutAct_9fa48("1547") ? currentDay !== 1 : stryMutAct_9fa48("1546") ? false : stryMutAct_9fa48("1545") ? true : (stryCov_9fa48("1545", "1546", "1547"), currentDay === 1)) await redis.expire(dayKey, 86400);
          if (stryMutAct_9fa48("1551") ? currentDay <= model.rpd : stryMutAct_9fa48("1550") ? currentDay >= model.rpd : stryMutAct_9fa48("1549") ? false : stryMutAct_9fa48("1548") ? true : (stryCov_9fa48("1548", "1549", "1550", "1551"), currentDay > model.rpd)) {
            if (stryMutAct_9fa48("1552")) {
              {}
            } else {
              stryCov_9fa48("1552");
              await redis.decr(dayKey);
              await redis.decr(rpmKey); // Rollback RPM too
              return stryMutAct_9fa48("1553") ? {} : (stryCov_9fa48("1553"), {
                allowed: stryMutAct_9fa48("1554") ? true : (stryCov_9fa48("1554"), false),
                model,
                reason: stryMutAct_9fa48("1555") ? "" : (stryCov_9fa48("1555"), 'rpd_limit')
              });
            }
          }
          return stryMutAct_9fa48("1556") ? {} : (stryCov_9fa48("1556"), {
            allowed: stryMutAct_9fa48("1557") ? false : (stryCov_9fa48("1557"), true),
            model
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("1558")) {
          {}
        } else {
          stryCov_9fa48("1558");
          recordRedisAttempt(stryMutAct_9fa48("1559") ? true : (stryCov_9fa48("1559"), false), error);
          console.error(stryMutAct_9fa48("1560") ? `` : (stryCov_9fa48("1560"), `Rate limiter check error for ${modelId}:`), error);
          return (stryMutAct_9fa48("1563") ? failureMode !== 'fail-closed' : stryMutAct_9fa48("1562") ? false : stryMutAct_9fa48("1561") ? true : (stryCov_9fa48("1561", "1562", "1563"), failureMode === (stryMutAct_9fa48("1564") ? "" : (stryCov_9fa48("1564"), 'fail-closed')))) ? stryMutAct_9fa48("1565") ? {} : (stryCov_9fa48("1565"), {
            allowed: stryMutAct_9fa48("1566") ? true : (stryCov_9fa48("1566"), false),
            reason: stryMutAct_9fa48("1567") ? "" : (stryCov_9fa48("1567"), 'limiter_error')
          }) : stryMutAct_9fa48("1568") ? {} : (stryCov_9fa48("1568"), {
            allowed: stryMutAct_9fa48("1569") ? false : (stryCov_9fa48("1569"), true),
            model
          });
        }
      }
    }
  }

  /**
   * Get best available model, optionally filtering by tier
   */
  async getAvailableModel(models: ModelConfig[], _preferredTier?: number): Promise<RateLimitResult> {
    if (stryMutAct_9fa48("1570")) {
      {}
    } else {
      stryCov_9fa48("1570");
      const candidates = _preferredTier ? stryMutAct_9fa48("1571") ? models : (stryCov_9fa48("1571"), models.filter(stryMutAct_9fa48("1572") ? () => undefined : (stryCov_9fa48("1572"), m => stryMutAct_9fa48("1576") ? m.tier < _preferredTier : stryMutAct_9fa48("1575") ? m.tier > _preferredTier : stryMutAct_9fa48("1574") ? false : stryMutAct_9fa48("1573") ? true : (stryCov_9fa48("1573", "1574", "1575", "1576"), m.tier >= _preferredTier)))) : models;
      const sortedModels = stryMutAct_9fa48("1577") ? [...candidates] : (stryCov_9fa48("1577"), (stryMutAct_9fa48("1578") ? [] : (stryCov_9fa48("1578"), [...candidates])).sort(stryMutAct_9fa48("1579") ? () => undefined : (stryCov_9fa48("1579"), (a, b) => stryMutAct_9fa48("1580") ? a.tier + b.tier : (stryCov_9fa48("1580"), a.tier - b.tier))));
      for (const model of sortedModels) {
        if (stryMutAct_9fa48("1581")) {
          {}
        } else {
          stryCov_9fa48("1581");
          const res = await this.canUseModel(model.id, models);
          if (stryMutAct_9fa48("1583") ? false : stryMutAct_9fa48("1582") ? true : (stryCov_9fa48("1582", "1583"), res.allowed)) {
            if (stryMutAct_9fa48("1584")) {
              {}
            } else {
              stryCov_9fa48("1584");
              return res;
            }
          }
        }
      }
      return stryMutAct_9fa48("1585") ? {} : (stryCov_9fa48("1585"), {
        allowed: stryMutAct_9fa48("1586") ? true : (stryCov_9fa48("1586"), false),
        waitMs: 5000,
        reason: stryMutAct_9fa48("1587") ? "" : (stryCov_9fa48("1587"), "All models rate limited, deprecated, or in cooldown.")
      });
    }
  }

  /**
   * Record a successful request. Nothing to do for RPM/RPD since canUseModel handles it atomically.
   */
  //  -- automated unused local suppression
  recordRequest(modelId: string, _tokensUsed: number = 0): void {
    if (stryMutAct_9fa48("1588")) {
      {}
    } else {
      stryCov_9fa48("1588");
      const redis = getRedis();
      if (stryMutAct_9fa48("1591") ? false : stryMutAct_9fa48("1590") ? true : stryMutAct_9fa48("1589") ? redis : (stryCov_9fa48("1589", "1590", "1591"), !redis)) return;
      // Legacy: previously ran set NX EX + INCR but we moved it. Kept for typescript usage.
    }
  }

  /**
   * Record a failure (updates cooldowns/deprecation and handles 'model_429' event loggings)
   */
  async recordFailure(modelId: string, error: unknown): Promise<void> {
    if (stryMutAct_9fa48("1592")) {
      {}
    } else {
      stryCov_9fa48("1592");
      const errorMsg = stryMutAct_9fa48("1593") ? String(error).toUpperCase() : (stryCov_9fa48("1593"), String(error).toLowerCase());
      const isRateLimit = stryMutAct_9fa48("1596") ? (errorMsg.includes('429') || errorMsg.includes('rate limit')) && errorMsg.includes('quota') : stryMutAct_9fa48("1595") ? false : stryMutAct_9fa48("1594") ? true : (stryCov_9fa48("1594", "1595", "1596"), (stryMutAct_9fa48("1598") ? errorMsg.includes('429') && errorMsg.includes('rate limit') : stryMutAct_9fa48("1597") ? false : (stryCov_9fa48("1597", "1598"), errorMsg.includes(stryMutAct_9fa48("1599") ? "" : (stryCov_9fa48("1599"), '429')) || errorMsg.includes(stryMutAct_9fa48("1600") ? "" : (stryCov_9fa48("1600"), 'rate limit')))) || errorMsg.includes(stryMutAct_9fa48("1601") ? "" : (stryCov_9fa48("1601"), 'quota')));
      const isNotFound = stryMutAct_9fa48("1604") ? (errorMsg.includes('404') || errorMsg.includes('not found')) && errorMsg.includes('deprecated') : stryMutAct_9fa48("1603") ? false : stryMutAct_9fa48("1602") ? true : (stryCov_9fa48("1602", "1603", "1604"), (stryMutAct_9fa48("1606") ? errorMsg.includes('404') && errorMsg.includes('not found') : stryMutAct_9fa48("1605") ? false : (stryCov_9fa48("1605", "1606"), errorMsg.includes(stryMutAct_9fa48("1607") ? "" : (stryCov_9fa48("1607"), '404')) || errorMsg.includes(stryMutAct_9fa48("1608") ? "" : (stryCov_9fa48("1608"), 'not found')))) || errorMsg.includes(stryMutAct_9fa48("1609") ? "" : (stryCov_9fa48("1609"), 'deprecated')));
      if (stryMutAct_9fa48("1611") ? false : stryMutAct_9fa48("1610") ? true : (stryCov_9fa48("1610", "1611"), isNotFound)) {
        if (stryMutAct_9fa48("1612")) {
          {}
        } else {
          stryCov_9fa48("1612");
          await markModelDeprecated(modelId, stryMutAct_9fa48("1613") ? "" : (stryCov_9fa48("1613"), "404 Not Found or Deprecated"));
          return;
        }
      }
      if (stryMutAct_9fa48("1615") ? false : stryMutAct_9fa48("1614") ? true : (stryCov_9fa48("1614", "1615"), isRateLimit)) {
        if (stryMutAct_9fa48("1616")) {
          {}
        } else {
          stryCov_9fa48("1616");
          const redis = getRedis();
          if (stryMutAct_9fa48("1618") ? false : stryMutAct_9fa48("1617") ? true : (stryCov_9fa48("1617", "1618"), redis)) {
            if (stryMutAct_9fa48("1619")) {
              {}
            } else {
              stryCov_9fa48("1619");
              try {
                if (stryMutAct_9fa48("1620")) {
                  {}
                } else {
                  stryCov_9fa48("1620");
                  // find current highest cooldown level active in order to increment penalties
                  let currentLevel = 0;
                  const cooldownKeys = this.COOLDOWN_TIERS.map(stryMutAct_9fa48("1621") ? () => undefined : (stryCov_9fa48("1621"), (_, idx) => stryMutAct_9fa48("1622") ? `` : (stryCov_9fa48("1622"), `rl:${modelId}:cooldown:${idx}`)));
                  const activeCooldowns = await redis.mget<unknown[]>(...cooldownKeys);
                  for (let i = stryMutAct_9fa48("1623") ? activeCooldowns.length + 1 : (stryCov_9fa48("1623"), activeCooldowns.length - 1); stryMutAct_9fa48("1626") ? i < 0 : stryMutAct_9fa48("1625") ? i > 0 : stryMutAct_9fa48("1624") ? false : (stryCov_9fa48("1624", "1625", "1626"), i >= 0); stryMutAct_9fa48("1627") ? i++ : (stryCov_9fa48("1627"), i--)) {
                    if (stryMutAct_9fa48("1628")) {
                      {}
                    } else {
                      stryCov_9fa48("1628");
                      if (stryMutAct_9fa48("1631") ? activeCooldowns[i] === null : stryMutAct_9fa48("1630") ? false : stryMutAct_9fa48("1629") ? true : (stryCov_9fa48("1629", "1630", "1631"), activeCooldowns[i] !== null)) {
                        if (stryMutAct_9fa48("1632")) {
                          {}
                        } else {
                          stryCov_9fa48("1632");
                          currentLevel = stryMutAct_9fa48("1633") ? Math.max(i + 1, this.COOLDOWN_TIERS.length - 1) : (stryCov_9fa48("1633"), Math.min(stryMutAct_9fa48("1634") ? i - 1 : (stryCov_9fa48("1634"), i + 1), stryMutAct_9fa48("1635") ? this.COOLDOWN_TIERS.length + 1 : (stryCov_9fa48("1635"), this.COOLDOWN_TIERS.length - 1)));
                          break;
                        }
                      }
                    }
                  }
                  const cooldownSeconds = this.COOLDOWN_TIERS[currentLevel];
                  await redisSet(stryMutAct_9fa48("1636") ? `` : (stryCov_9fa48("1636"), `rl:${modelId}:cooldown:${currentLevel}`), stryMutAct_9fa48("1637") ? "" : (stryCov_9fa48("1637"), "true"), cooldownSeconds);
                }
              } catch (err) {
                if (stryMutAct_9fa48("1638")) {
                  {}
                } else {
                  stryCov_9fa48("1638");
                  console.error(stryMutAct_9fa48("1639") ? "" : (stryCov_9fa48("1639"), "Error setting exponential cooldown in Redis:"), err);
                }
              }
            }
          }

          // Log 'model_429' event silently explicitly via events logger
          logSystemEvent(stryMutAct_9fa48("1640") ? {} : (stryCov_9fa48("1640"), {
            type: stryMutAct_9fa48("1641") ? "" : (stryCov_9fa48("1641"), 'model_429'),
            modelId,
            errorMessage: (stryMutAct_9fa48("1644") ? typeof error === 'object' && error !== null || 'message' in error : stryMutAct_9fa48("1643") ? false : stryMutAct_9fa48("1642") ? true : (stryCov_9fa48("1642", "1643", "1644"), (stryMutAct_9fa48("1646") ? typeof error === 'object' || error !== null : stryMutAct_9fa48("1645") ? true : (stryCov_9fa48("1645", "1646"), (stryMutAct_9fa48("1648") ? typeof error !== 'object' : stryMutAct_9fa48("1647") ? true : (stryCov_9fa48("1647", "1648"), typeof error === (stryMutAct_9fa48("1649") ? "" : (stryCov_9fa48("1649"), 'object')))) && (stryMutAct_9fa48("1651") ? error === null : stryMutAct_9fa48("1650") ? true : (stryCov_9fa48("1650", "1651"), error !== null)))) && (stryMutAct_9fa48("1652") ? "" : (stryCov_9fa48("1652"), 'message')) in error)) ? String((error as Error).message) : String(error)
          })).catch(() => {});
        }
      }
    }
  }

  // Alias for compatibility if needed, or intended helper
  recordError(modelId: string, error: unknown): void {
    if (stryMutAct_9fa48("1653")) {
      {}
    } else {
      stryCov_9fa48("1653");
      this.recordFailure(modelId, error).catch(() => {});
    }
  }

  /**
   * Manual reset for a model overriding existing TTLs.
   */
  resetModel(modelId: string): void {
    if (stryMutAct_9fa48("1654")) {
      {}
    } else {
      stryCov_9fa48("1654");
      const redis = getRedis();
      if (stryMutAct_9fa48("1657") ? false : stryMutAct_9fa48("1656") ? true : stryMutAct_9fa48("1655") ? redis : (stryCov_9fa48("1655", "1656", "1657"), !redis)) return;
      const keysToDelete = stryMutAct_9fa48("1658") ? [] : (stryCov_9fa48("1658"), [stryMutAct_9fa48("1659") ? `` : (stryCov_9fa48("1659"), `rl:${modelId}:rpm`), stryMutAct_9fa48("1660") ? `` : (stryCov_9fa48("1660"), `rl:${modelId}:day`), ...this.COOLDOWN_TIERS.map(stryMutAct_9fa48("1661") ? () => undefined : (stryCov_9fa48("1661"), (_, i) => stryMutAct_9fa48("1662") ? `` : (stryCov_9fa48("1662"), `rl:${modelId}:cooldown:${i}`)))]);
      redis.del(...keysToDelete).catch(() => {});
    }
  }

  /**
   * Get usage statistics for debugging/monitoring.
   * Reads real counters from Redis using individual gets.
   */
  async getUsageStats(models: ModelConfig[] = stryMutAct_9fa48("1663") ? ["Stryker was here"] : (stryCov_9fa48("1663"), [])): Promise<Record<string, {
    rpm: string;
    rpd: string;
    failures: number;
    deprecated: boolean;
    cooldown: string;
  }>> {
    if (stryMutAct_9fa48("1664")) {
      {}
    } else {
      stryCov_9fa48("1664");
      const redis = getRedis();
      if (stryMutAct_9fa48("1667") ? !redis && models.length === 0 : stryMutAct_9fa48("1666") ? false : stryMutAct_9fa48("1665") ? true : (stryCov_9fa48("1665", "1666", "1667"), (stryMutAct_9fa48("1668") ? redis : (stryCov_9fa48("1668"), !redis)) || (stryMutAct_9fa48("1670") ? models.length !== 0 : stryMutAct_9fa48("1669") ? false : (stryCov_9fa48("1669", "1670"), models.length === 0)))) return {};
      const result: Record<string, {
        rpm: string;
        rpd: string;
        failures: number;
        deprecated: boolean;
        cooldown: string;
      }> = {};
      for (const model of models) {
        if (stryMutAct_9fa48("1671")) {
          {}
        } else {
          stryCov_9fa48("1671");
          try {
            if (stryMutAct_9fa48("1672")) {
              {}
            } else {
              stryCov_9fa48("1672");
              const [rpmStr, rpdStr] = await Promise.all(stryMutAct_9fa48("1673") ? [] : (stryCov_9fa48("1673"), [redisGet(stryMutAct_9fa48("1674") ? `` : (stryCov_9fa48("1674"), `rl:${model.id}:rpm`)), redisGet(stryMutAct_9fa48("1675") ? `` : (stryCov_9fa48("1675"), `rl:${model.id}:day`))]));
              result[model.id] = stryMutAct_9fa48("1676") ? {} : (stryCov_9fa48("1676"), {
                rpm: stryMutAct_9fa48("1679") ? rpmStr && '0' : stryMutAct_9fa48("1678") ? false : stryMutAct_9fa48("1677") ? true : (stryCov_9fa48("1677", "1678", "1679"), rpmStr || (stryMutAct_9fa48("1680") ? "" : (stryCov_9fa48("1680"), '0'))),
                rpd: stryMutAct_9fa48("1683") ? rpdStr && '0' : stryMutAct_9fa48("1682") ? false : stryMutAct_9fa48("1681") ? true : (stryCov_9fa48("1681", "1682", "1683"), rpdStr || (stryMutAct_9fa48("1684") ? "" : (stryCov_9fa48("1684"), '0'))),
                failures: 0,
                deprecated: stryMutAct_9fa48("1685") ? true : (stryCov_9fa48("1685"), false),
                cooldown: stryMutAct_9fa48("1686") ? "" : (stryCov_9fa48("1686"), 'none')
              });
            }
          } catch (e) {
            if (stryMutAct_9fa48("1687")) {
              {}
            } else {
              stryCov_9fa48("1687");
              console.error(stryMutAct_9fa48("1688") ? `` : (stryCov_9fa48("1688"), `[RateLimiter] Failed to read rate limit status for model '${model.id}' — dashboard will show '?':`), e);
              result[model.id] = stryMutAct_9fa48("1689") ? {} : (stryCov_9fa48("1689"), {
                rpm: stryMutAct_9fa48("1690") ? "" : (stryCov_9fa48("1690"), '?'),
                rpd: stryMutAct_9fa48("1691") ? "" : (stryCov_9fa48("1691"), '?'),
                failures: 0,
                deprecated: stryMutAct_9fa48("1692") ? true : (stryCov_9fa48("1692"), false),
                cooldown: stryMutAct_9fa48("1693") ? "" : (stryCov_9fa48("1693"), 'unknown')
              });
            }
          }
        }
      }
      return result;
    }
  }

  /**
   * Get all currently available models.
   */
  async getAvailableModels(models: ModelConfig[]): Promise<ModelConfig[]> {
    if (stryMutAct_9fa48("1694")) {
      {}
    } else {
      stryCov_9fa48("1694");
      const result: ModelConfig[] = stryMutAct_9fa48("1695") ? ["Stryker was here"] : (stryCov_9fa48("1695"), []);
      for (const model of models) {
        if (stryMutAct_9fa48("1696")) {
          {}
        } else {
          stryCov_9fa48("1696");
          const res = await this.canUseModel(model.id, models);
          if (stryMutAct_9fa48("1699") ? res.allowed || res.model : stryMutAct_9fa48("1698") ? false : stryMutAct_9fa48("1697") ? true : (stryCov_9fa48("1697", "1698", "1699"), res.allowed && res.model)) {
            if (stryMutAct_9fa48("1700")) {
              {}
            } else {
              stryCov_9fa48("1700");
              result.push(res.model);
            }
          }
        }
      }
      return result;
    }
  }

  /**
   * Get remaining capacity (approximate)
   * For distributed Redis architecture this represents a mock response or requires heavy aggregation.
   */
  async getRemainingCapacity(_models: ModelConfig[]): Promise<{
    minuteRemaining: number;
    dayRemaining: number;
  }> {
    if (stryMutAct_9fa48("1701")) {
      {}
    } else {
      stryCov_9fa48("1701");
      return stryMutAct_9fa48("1702") ? {} : (stryCov_9fa48("1702"), {
        minuteRemaining: 0,
        dayRemaining: 0
      });
    }
  }
}

// Singleton
let instance: IntelligentRateLimiter | null = null;
export function getRateLimiter(): IntelligentRateLimiter {
  if (stryMutAct_9fa48("1703")) {
    {}
  } else {
    stryCov_9fa48("1703");
    if (stryMutAct_9fa48("1706") ? false : stryMutAct_9fa48("1705") ? true : stryMutAct_9fa48("1704") ? instance : (stryCov_9fa48("1704", "1705", "1706"), !instance)) {
      if (stryMutAct_9fa48("1707")) {
        {}
      } else {
        stryCov_9fa48("1707");
        instance = new IntelligentRateLimiter();
      }
    }
    return instance;
  }
}