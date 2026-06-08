// @ts-nocheck
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
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { invalidateStudentContext } from '@/lib/kai-context';
import { validateEnv } from '@/lib/startup/validateEnv';
import { logSystemEvent } from '@/lib/monitoring/events';
import { getCorrelationId } from '@/lib/tracing/correlation';

/**
 * Razorpay Webhook Handler for Subscription Lifecycle Events
 * 
 * Handles:
 * - subscription.charged: When subscription payment is processed
 * - subscription.cancelled: When subscription is cancelled
 * - subscription.paused: When subscription is paused
 * - subscription.resumed: When subscription is resumed
 * - subscription.halted: When subscription is halted due to max attempts
 * - subscription.completed: When subscription reaches its end
 */
export async function POST(req: Request) {
  if (stryMutAct_9fa48("86")) {
    {}
  } else {
    stryCov_9fa48("86");
    const correlationId = await getCorrelationId();
    try {
      if (stryMutAct_9fa48("87")) {
        {}
      } else {
        stryCov_9fa48("87");
        validateEnv();

        // ── 1. Read raw body BEFORE any parsing ────────────────────────────────
        const rawBody = await req.text();
        const signature = req.headers.get(stryMutAct_9fa48("88") ? "" : (stryCov_9fa48("88"), 'x-razorpay-signature'));
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // ── 2. Reject immediately if secret not configured ─────────────────────
        if (stryMutAct_9fa48("91") ? false : stryMutAct_9fa48("90") ? true : stryMutAct_9fa48("89") ? webhookSecret : (stryCov_9fa48("89", "90", "91"), !webhookSecret)) {
          if (stryMutAct_9fa48("92")) {
            {}
          } else {
            stryCov_9fa48("92");
            console.error(stryMutAct_9fa48("93") ? "" : (stryCov_9fa48("93"), '[Webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting all webhook events'));
            void logSystemEvent(stryMutAct_9fa48("94") ? {} : (stryCov_9fa48("94"), {
              type: stryMutAct_9fa48("95") ? "" : (stryCov_9fa48("95"), 'payment.webhook_failed'),
              correlationId,
              metadata: stryMutAct_9fa48("96") ? {} : (stryCov_9fa48("96"), {
                component: stryMutAct_9fa48("97") ? "" : (stryCov_9fa48("97"), 'payment.webhook'),
                operation: stryMutAct_9fa48("98") ? "" : (stryCov_9fa48("98"), 'webhook_rejected'),
                reason: stryMutAct_9fa48("99") ? "" : (stryCov_9fa48("99"), 'secret_not_configured')
              })
            }));
            return NextResponse.json(stryMutAct_9fa48("100") ? {} : (stryCov_9fa48("100"), {
              error: stryMutAct_9fa48("101") ? "" : (stryCov_9fa48("101"), 'Misconfigured')
            }), stryMutAct_9fa48("102") ? {} : (stryCov_9fa48("102"), {
              status: 500
            }));
          }
        }

        // ── 3. Reject if signature header is missing ───────────────────────────
        if (stryMutAct_9fa48("105") ? false : stryMutAct_9fa48("104") ? true : stryMutAct_9fa48("103") ? signature : (stryCov_9fa48("103", "104", "105"), !signature)) {
          if (stryMutAct_9fa48("106")) {
            {}
          } else {
            stryCov_9fa48("106");
            void logSystemEvent(stryMutAct_9fa48("107") ? {} : (stryCov_9fa48("107"), {
              type: stryMutAct_9fa48("108") ? "" : (stryCov_9fa48("108"), 'payment.webhook_failed'),
              correlationId,
              metadata: stryMutAct_9fa48("109") ? {} : (stryCov_9fa48("109"), {
                component: stryMutAct_9fa48("110") ? "" : (stryCov_9fa48("110"), 'payment.webhook'),
                operation: stryMutAct_9fa48("111") ? "" : (stryCov_9fa48("111"), 'webhook_rejected'),
                reason: stryMutAct_9fa48("112") ? "" : (stryCov_9fa48("112"), 'missing_signature_header')
              })
            }));
            return NextResponse.json(stryMutAct_9fa48("113") ? {} : (stryCov_9fa48("113"), {
              error: stryMutAct_9fa48("114") ? "" : (stryCov_9fa48("114"), 'Missing signature')
            }), stryMutAct_9fa48("115") ? {} : (stryCov_9fa48("115"), {
              status: 400
            }));
          }
        }

        // ── 4. HMAC verification (timing-safe) ─────────────────────────────────
        const expectedHex = crypto.createHmac(stryMutAct_9fa48("116") ? "" : (stryCov_9fa48("116"), 'sha256'), webhookSecret).update(rawBody).digest(stryMutAct_9fa48("117") ? "" : (stryCov_9fa48("117"), 'hex'));
        let signatureValid = stryMutAct_9fa48("118") ? true : (stryCov_9fa48("118"), false);
        try {
          if (stryMutAct_9fa48("119")) {
            {}
          } else {
            stryCov_9fa48("119");
            signatureValid = crypto.timingSafeEqual(Buffer.from(expectedHex, stryMutAct_9fa48("120") ? "" : (stryCov_9fa48("120"), 'hex')), Buffer.from(signature, stryMutAct_9fa48("121") ? "" : (stryCov_9fa48("121"), 'hex')));
          }
        } catch {
          if (stryMutAct_9fa48("122")) {
            {}
          } else {
            stryCov_9fa48("122");
            // Buffer lengths differ → invalid signature (don't throw, just reject)
            signatureValid = stryMutAct_9fa48("123") ? true : (stryCov_9fa48("123"), false);
          }
        }
        if (stryMutAct_9fa48("126") ? false : stryMutAct_9fa48("125") ? true : stryMutAct_9fa48("124") ? signatureValid : (stryCov_9fa48("124", "125", "126"), !signatureValid)) {
          if (stryMutAct_9fa48("127")) {
            {}
          } else {
            stryCov_9fa48("127");
            void logSystemEvent(stryMutAct_9fa48("128") ? {} : (stryCov_9fa48("128"), {
              type: stryMutAct_9fa48("129") ? "" : (stryCov_9fa48("129"), 'payment.webhook_failed'),
              correlationId,
              metadata: stryMutAct_9fa48("130") ? {} : (stryCov_9fa48("130"), {
                component: stryMutAct_9fa48("131") ? "" : (stryCov_9fa48("131"), 'payment.webhook'),
                operation: stryMutAct_9fa48("132") ? "" : (stryCov_9fa48("132"), 'webhook_rejected'),
                reason: stryMutAct_9fa48("133") ? "" : (stryCov_9fa48("133"), 'invalid_signature')
              })
            }));
            return NextResponse.json(stryMutAct_9fa48("134") ? {} : (stryCov_9fa48("134"), {
              error: stryMutAct_9fa48("135") ? "" : (stryCov_9fa48("135"), 'Invalid signature')
            }), stryMutAct_9fa48("136") ? {} : (stryCov_9fa48("136"), {
              status: 400
            }));
          }
        }

        // ── 5. Parse body only after signature is verified ─────────────────────
        let body: {
          event?: string;
          payload?: {
            subscription?: {
              id?: string;
              entity?: string;
              status?: string;
              current_start?: number;
              current_end?: number;
              ended_at?: number | null;
              quantity?: number;
              notes?: Record<string, unknown>;
              customer_id?: string;
            };
            payment?: {
              id?: string;
              entity?: string;
              amount?: number;
            };
          };
          created_at?: number;
        };
        try {
          if (stryMutAct_9fa48("137")) {
            {}
          } else {
            stryCov_9fa48("137");
            body = JSON.parse(rawBody);
          }
        } catch {
          if (stryMutAct_9fa48("138")) {
            {}
          } else {
            stryCov_9fa48("138");
            return NextResponse.json(stryMutAct_9fa48("139") ? {} : (stryCov_9fa48("139"), {
              error: stryMutAct_9fa48("140") ? "" : (stryCov_9fa48("140"), 'Invalid JSON body')
            }), stryMutAct_9fa48("141") ? {} : (stryCov_9fa48("141"), {
              status: 400
            }));
          }
        }
        const webhookEvent = body.event;
        const payload = body.payload;
        if (stryMutAct_9fa48("144") ? !webhookEvent && !payload : stryMutAct_9fa48("143") ? false : stryMutAct_9fa48("142") ? true : (stryCov_9fa48("142", "143", "144"), (stryMutAct_9fa48("145") ? webhookEvent : (stryCov_9fa48("145"), !webhookEvent)) || (stryMutAct_9fa48("146") ? payload : (stryCov_9fa48("146"), !payload)))) {
          if (stryMutAct_9fa48("147")) {
            {}
          } else {
            stryCov_9fa48("147");
            return NextResponse.json(stryMutAct_9fa48("148") ? {} : (stryCov_9fa48("148"), {
              error: stryMutAct_9fa48("149") ? "" : (stryCov_9fa48("149"), 'Invalid webhook payload')
            }), stryMutAct_9fa48("150") ? {} : (stryCov_9fa48("150"), {
              status: 400
            }));
          }
        }

        // Log webhook receipt
        await logSystemEvent(stryMutAct_9fa48("151") ? {} : (stryCov_9fa48("151"), {
          type: stryMutAct_9fa48("152") ? "" : (stryCov_9fa48("152"), 'payment.webhook_received'),
          correlationId,
          metadata: stryMutAct_9fa48("153") ? {} : (stryCov_9fa48("153"), {
            component: stryMutAct_9fa48("154") ? "" : (stryCov_9fa48("154"), 'payment.webhook'),
            operation: stryMutAct_9fa48("155") ? "" : (stryCov_9fa48("155"), 'webhook_received')
          })
        }));
        const subscription = payload.subscription;
        if (stryMutAct_9fa48("158") ? !subscription && !subscription.id : stryMutAct_9fa48("157") ? false : stryMutAct_9fa48("156") ? true : (stryCov_9fa48("156", "157", "158"), (stryMutAct_9fa48("159") ? subscription : (stryCov_9fa48("159"), !subscription)) || (stryMutAct_9fa48("160") ? subscription.id : (stryCov_9fa48("160"), !subscription.id)))) {
          if (stryMutAct_9fa48("161")) {
            {}
          } else {
            stryCov_9fa48("161");
            return NextResponse.json(stryMutAct_9fa48("162") ? {} : (stryCov_9fa48("162"), {
              error: stryMutAct_9fa48("163") ? "" : (stryCov_9fa48("163"), 'Invalid subscription data')
            }), stryMutAct_9fa48("164") ? {} : (stryCov_9fa48("164"), {
              status: 400
            }));
          }
        }
        const serviceClient = getServiceClient();

        // Handle different subscription events
        switch (webhookEvent) {
          case stryMutAct_9fa48("166") ? "" : (stryCov_9fa48("166"), 'subscription.charged'):
            if (stryMutAct_9fa48("165")) {} else {
              stryCov_9fa48("165");
              {
                if (stryMutAct_9fa48("167")) {
                  {}
                } else {
                  stryCov_9fa48("167");
                  // Extend subscription period when payment is processed
                  const chargeDate = new Date(stryMutAct_9fa48("168") ? subscription.current_start! / 1000 : (stryCov_9fa48("168"), subscription.current_start! * 1000));
                  const nextChargeDate = new Date(stryMutAct_9fa48("169") ? subscription.current_end! / 1000 : (stryCov_9fa48("169"), subscription.current_end! * 1000));
                  const {
                    data: existingSubscription
                  } = await serviceClient.from(stryMutAct_9fa48("170") ? "" : (stryCov_9fa48("170"), 'subscriptions')).select(stryMutAct_9fa48("171") ? "" : (stryCov_9fa48("171"), 'user_id, id')).eq(stryMutAct_9fa48("172") ? "" : (stryCov_9fa48("172"), 'provider'), stryMutAct_9fa48("173") ? "" : (stryCov_9fa48("173"), 'razorpay')).eq(stryMutAct_9fa48("174") ? "" : (stryCov_9fa48("174"), 'provider_subscription_id'), subscription.id).maybeSingle();
                  if (stryMutAct_9fa48("176") ? false : stryMutAct_9fa48("175") ? true : (stryCov_9fa48("175", "176"), existingSubscription)) {
                    if (stryMutAct_9fa48("177")) {
                      {}
                    } else {
                      stryCov_9fa48("177");
                      // Update subscription period
                      const {
                        error: updateError
                      } = await serviceClient.from(stryMutAct_9fa48("178") ? "" : (stryCov_9fa48("178"), 'subscriptions')).update(stryMutAct_9fa48("179") ? {} : (stryCov_9fa48("179"), {
                        current_period_start: chargeDate.toISOString(),
                        current_period_end: nextChargeDate.toISOString(),
                        status: stryMutAct_9fa48("180") ? "" : (stryCov_9fa48("180"), 'active')
                      })).eq(stryMutAct_9fa48("181") ? "" : (stryCov_9fa48("181"), 'id'), existingSubscription.id);
                      if (stryMutAct_9fa48("183") ? false : stryMutAct_9fa48("182") ? true : (stryCov_9fa48("182", "183"), updateError)) {
                        if (stryMutAct_9fa48("184")) {
                          {}
                        } else {
                          stryCov_9fa48("184");
                          console.error(stryMutAct_9fa48("185") ? "" : (stryCov_9fa48("185"), 'Failed to update subscription on charge:'), updateError);
                          throw new Error(stryMutAct_9fa48("186") ? `` : (stryCov_9fa48("186"), `Subscription update failed: ${updateError.message}`));
                        }
                      }

                      // Update profile subscription expiry
                      const {
                        error: profileError
                      } = await serviceClient.from(stryMutAct_9fa48("187") ? "" : (stryCov_9fa48("187"), 'profiles')).update(stryMutAct_9fa48("188") ? {} : (stryCov_9fa48("188"), {
                        subscription_status: stryMutAct_9fa48("189") ? "" : (stryCov_9fa48("189"), 'premium'),
                        subscription_expires_at: nextChargeDate.toISOString()
                      })).eq(stryMutAct_9fa48("190") ? "" : (stryCov_9fa48("190"), 'id'), existingSubscription.user_id);
                      if (stryMutAct_9fa48("192") ? false : stryMutAct_9fa48("191") ? true : (stryCov_9fa48("191", "192"), profileError)) {
                        if (stryMutAct_9fa48("193")) {
                          {}
                        } else {
                          stryCov_9fa48("193");
                          console.error(stryMutAct_9fa48("194") ? "" : (stryCov_9fa48("194"), 'Failed to update profile on charge:'), profileError);
                          throw new Error(stryMutAct_9fa48("195") ? `` : (stryCov_9fa48("195"), `Profile update failed: ${profileError.message}`));
                        }
                      }

                      // Invalidate cache
                      try {
                        if (stryMutAct_9fa48("196")) {
                          {}
                        } else {
                          stryCov_9fa48("196");
                          await invalidateStudentContext(existingSubscription.user_id);
                        }
                      } catch (e) {
                        if (stryMutAct_9fa48("197")) {
                          {}
                        } else {
                          stryCov_9fa48("197");
                          console.warn(stryMutAct_9fa48("198") ? "" : (stryCov_9fa48("198"), 'Failed to invalidate cache on charge:'), e);
                        }
                      }

                      // Log success
                      await logSystemEvent(stryMutAct_9fa48("199") ? {} : (stryCov_9fa48("199"), {
                        type: stryMutAct_9fa48("200") ? "" : (stryCov_9fa48("200"), 'payment.subscription_charged'),
                        user_id: existingSubscription.user_id,
                        correlationId,
                        metadata: stryMutAct_9fa48("201") ? {} : (stryCov_9fa48("201"), {
                          component: stryMutAct_9fa48("202") ? "" : (stryCov_9fa48("202"), 'payment.webhook'),
                          operation: stryMutAct_9fa48("203") ? "" : (stryCov_9fa48("203"), 'subscription_charged')
                        })
                      }));
                    }
                  }
                  break;
                }
              }
            }
          case stryMutAct_9fa48("205") ? "" : (stryCov_9fa48("205"), 'subscription.cancelled'):
            if (stryMutAct_9fa48("204")) {} else {
              stryCov_9fa48("204");
              {
                if (stryMutAct_9fa48("206")) {
                  {}
                } else {
                  stryCov_9fa48("206");
                  // Downgrade user on subscription cancellation
                  const {
                    data: existingSubscription
                  } = await serviceClient.from(stryMutAct_9fa48("207") ? "" : (stryCov_9fa48("207"), 'subscriptions')).select(stryMutAct_9fa48("208") ? "" : (stryCov_9fa48("208"), 'user_id, id')).eq(stryMutAct_9fa48("209") ? "" : (stryCov_9fa48("209"), 'provider'), stryMutAct_9fa48("210") ? "" : (stryCov_9fa48("210"), 'razorpay')).eq(stryMutAct_9fa48("211") ? "" : (stryCov_9fa48("211"), 'provider_subscription_id'), subscription.id).maybeSingle();
                  if (stryMutAct_9fa48("213") ? false : stryMutAct_9fa48("212") ? true : (stryCov_9fa48("212", "213"), existingSubscription)) {
                    if (stryMutAct_9fa48("214")) {
                      {}
                    } else {
                      stryCov_9fa48("214");
                      // Update subscription status
                      const {
                        error: updateError
                      } = await serviceClient.from(stryMutAct_9fa48("215") ? "" : (stryCov_9fa48("215"), 'subscriptions')).update(stryMutAct_9fa48("216") ? {} : (stryCov_9fa48("216"), {
                        status: stryMutAct_9fa48("217") ? "" : (stryCov_9fa48("217"), 'cancelled'),
                        ended_at: new Date().toISOString()
                      })).eq(stryMutAct_9fa48("218") ? "" : (stryCov_9fa48("218"), 'id'), existingSubscription.id);
                      if (stryMutAct_9fa48("220") ? false : stryMutAct_9fa48("219") ? true : (stryCov_9fa48("219", "220"), updateError)) {
                        if (stryMutAct_9fa48("221")) {
                          {}
                        } else {
                          stryCov_9fa48("221");
                          console.error(stryMutAct_9fa48("222") ? "" : (stryCov_9fa48("222"), 'Failed to update subscription on cancel:'), updateError);
                          throw new Error(stryMutAct_9fa48("223") ? `` : (stryCov_9fa48("223"), `Subscription update failed: ${updateError.message}`));
                        }
                      }

                      // Downgrade profile to free
                      const {
                        error: profileError
                      } = await serviceClient.from(stryMutAct_9fa48("224") ? "" : (stryCov_9fa48("224"), 'profiles')).update(stryMutAct_9fa48("225") ? {} : (stryCov_9fa48("225"), {
                        subscription_status: stryMutAct_9fa48("226") ? "" : (stryCov_9fa48("226"), 'free'),
                        subscription_expires_at: null
                      })).eq(stryMutAct_9fa48("227") ? "" : (stryCov_9fa48("227"), 'id'), existingSubscription.user_id);
                      if (stryMutAct_9fa48("229") ? false : stryMutAct_9fa48("228") ? true : (stryCov_9fa48("228", "229"), profileError)) {
                        if (stryMutAct_9fa48("230")) {
                          {}
                        } else {
                          stryCov_9fa48("230");
                          console.error(stryMutAct_9fa48("231") ? "" : (stryCov_9fa48("231"), 'Failed to downgrade profile on cancel:'), profileError);
                          throw new Error(stryMutAct_9fa48("232") ? `` : (stryCov_9fa48("232"), `Profile downgrade failed: ${profileError.message}`));
                        }
                      }

                      // Invalidate cache
                      try {
                        if (stryMutAct_9fa48("233")) {
                          {}
                        } else {
                          stryCov_9fa48("233");
                          await invalidateStudentContext(existingSubscription.user_id);
                        }
                      } catch (e) {
                        if (stryMutAct_9fa48("234")) {
                          {}
                        } else {
                          stryCov_9fa48("234");
                          console.warn(stryMutAct_9fa48("235") ? "" : (stryCov_9fa48("235"), 'Failed to invalidate cache on cancel:'), e);
                        }
                      }

                      // Log cancellation
                      await logSystemEvent(stryMutAct_9fa48("236") ? {} : (stryCov_9fa48("236"), {
                        type: stryMutAct_9fa48("237") ? "" : (stryCov_9fa48("237"), 'payment.subscription_cancelled'),
                        user_id: existingSubscription.user_id,
                        correlationId,
                        metadata: stryMutAct_9fa48("238") ? {} : (stryCov_9fa48("238"), {
                          component: stryMutAct_9fa48("239") ? "" : (stryCov_9fa48("239"), 'payment.webhook'),
                          operation: stryMutAct_9fa48("240") ? "" : (stryCov_9fa48("240"), 'subscription_cancelled')
                        })
                      }));
                    }
                  }
                  break;
                }
              }
            }
          case stryMutAct_9fa48("241") ? "" : (stryCov_9fa48("241"), 'subscription.paused'):
          case stryMutAct_9fa48("242") ? "" : (stryCov_9fa48("242"), 'subscription.resumed'):
          case stryMutAct_9fa48("243") ? "" : (stryCov_9fa48("243"), 'subscription.halted'):
          case stryMutAct_9fa48("245") ? "" : (stryCov_9fa48("245"), 'subscription.completed'):
            if (stryMutAct_9fa48("244")) {} else {
              stryCov_9fa48("244");
              {
                if (stryMutAct_9fa48("246")) {
                  {}
                } else {
                  stryCov_9fa48("246");
                  // Log other subscription lifecycle events without taking action
                  console.log(stryMutAct_9fa48("247") ? `` : (stryCov_9fa48("247"), `Received subscription event: ${webhookEvent}`), stryMutAct_9fa48("248") ? {} : (stryCov_9fa48("248"), {
                    subscription
                  }));
                  await logSystemEvent(stryMutAct_9fa48("249") ? {} : (stryCov_9fa48("249"), {
                    type: stryMutAct_9fa48("250") ? "" : (stryCov_9fa48("250"), 'payment.webhook_processed'),
                    correlationId,
                    metadata: stryMutAct_9fa48("251") ? {} : (stryCov_9fa48("251"), {
                      component: stryMutAct_9fa48("252") ? "" : (stryCov_9fa48("252"), 'payment.webhook'),
                      operation: stryMutAct_9fa48("253") ? `` : (stryCov_9fa48("253"), `subscription_${webhookEvent.split(stryMutAct_9fa48("254") ? "" : (stryCov_9fa48("254"), '.'))[1]}`)
                    })
                  }));
                  break;
                }
              }
            }
          default:
            if (stryMutAct_9fa48("255")) {} else {
              stryCov_9fa48("255");
              console.log(stryMutAct_9fa48("256") ? `` : (stryCov_9fa48("256"), `Received unhandled webhook event: ${webhookEvent}`));
              break;
            }
        }

        // Log successful webhook processing
        await logSystemEvent(stryMutAct_9fa48("257") ? {} : (stryCov_9fa48("257"), {
          type: stryMutAct_9fa48("258") ? "" : (stryCov_9fa48("258"), 'payment.webhook_processed'),
          correlationId,
          metadata: stryMutAct_9fa48("259") ? {} : (stryCov_9fa48("259"), {
            component: stryMutAct_9fa48("260") ? "" : (stryCov_9fa48("260"), 'payment.webhook'),
            operation: stryMutAct_9fa48("261") ? "" : (stryCov_9fa48("261"), 'webhook_processed')
          })
        }));
        return NextResponse.json(stryMutAct_9fa48("262") ? {} : (stryCov_9fa48("262"), {
          success: stryMutAct_9fa48("263") ? false : (stryCov_9fa48("263"), true)
        }));
      }
    } catch (error) {
      if (stryMutAct_9fa48("264")) {
        {}
      } else {
        stryCov_9fa48("264");
        console.error(stryMutAct_9fa48("265") ? "" : (stryCov_9fa48("265"), 'Error processing webhook:'), error);

        // Log webhook failure
        await logSystemEvent(stryMutAct_9fa48("266") ? {} : (stryCov_9fa48("266"), {
          type: stryMutAct_9fa48("267") ? "" : (stryCov_9fa48("267"), 'payment.webhook_failed'),
          correlationId,
          errorMessage: error instanceof Error ? error.message : String(error),
          metadata: stryMutAct_9fa48("268") ? {} : (stryCov_9fa48("268"), {
            component: stryMutAct_9fa48("269") ? "" : (stryCov_9fa48("269"), 'payment.webhook'),
            operation: stryMutAct_9fa48("270") ? "" : (stryCov_9fa48("270"), 'webhook_processing_failed')
          })
        }));
        return NextResponse.json(stryMutAct_9fa48("271") ? {} : (stryCov_9fa48("271"), {
          error: stryMutAct_9fa48("272") ? "" : (stryCov_9fa48("272"), 'Webhook processing failed')
        }), stryMutAct_9fa48("273") ? {} : (stryCov_9fa48("273"), {
          status: 500
        }));
      }
    }
  }
}