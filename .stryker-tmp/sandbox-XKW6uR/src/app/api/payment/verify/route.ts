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
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { invalidateStudentContext } from '@/lib/kai-context';
import { validateEnv } from '@/lib/startup/validateEnv';
import crypto from 'crypto';
export async function POST(req: Request) {
  if (stryMutAct_9fa48("0")) {
    {}
  } else {
    stryCov_9fa48("0");
    try {
      if (stryMutAct_9fa48("1")) {
        {}
      } else {
        stryCov_9fa48("1");
        validateEnv();
        const supabase = await createServerSupabase();
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (stryMutAct_9fa48("4") ? false : stryMutAct_9fa48("3") ? true : stryMutAct_9fa48("2") ? user : (stryCov_9fa48("2", "3", "4"), !user)) {
          if (stryMutAct_9fa48("5")) {
            {}
          } else {
            stryCov_9fa48("5");
            return NextResponse.json(stryMutAct_9fa48("6") ? {} : (stryCov_9fa48("6"), {
              error: stryMutAct_9fa48("7") ? "" : (stryCov_9fa48("7"), 'Unauthorized')
            }), stryMutAct_9fa48("8") ? {} : (stryCov_9fa48("8"), {
              status: 401
            }));
          }
        }
        const body = (await req.json()) as {
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
        };
        const orderId = body.razorpay_order_id;
        const paymentId = body.razorpay_payment_id;
        const signature = body.razorpay_signature;
        if (stryMutAct_9fa48("11") ? (!orderId || !paymentId) && !signature : stryMutAct_9fa48("10") ? false : stryMutAct_9fa48("9") ? true : (stryCov_9fa48("9", "10", "11"), (stryMutAct_9fa48("13") ? !orderId && !paymentId : stryMutAct_9fa48("12") ? false : (stryCov_9fa48("12", "13"), (stryMutAct_9fa48("14") ? orderId : (stryCov_9fa48("14"), !orderId)) || (stryMutAct_9fa48("15") ? paymentId : (stryCov_9fa48("15"), !paymentId)))) || (stryMutAct_9fa48("16") ? signature : (stryCov_9fa48("16"), !signature)))) {
          if (stryMutAct_9fa48("17")) {
            {}
          } else {
            stryCov_9fa48("17");
            return NextResponse.json(stryMutAct_9fa48("18") ? {} : (stryCov_9fa48("18"), {
              error: stryMutAct_9fa48("19") ? "" : (stryCov_9fa48("19"), 'Missing payment details')
            }), stryMutAct_9fa48("20") ? {} : (stryCov_9fa48("20"), {
              status: 400
            }));
          }
        }

        // Verify Razorpay signature
        const expectedSignature = crypto.createHmac(stryMutAct_9fa48("21") ? "" : (stryCov_9fa48("21"), 'sha256'), process.env.RAZORPAY_KEY_SECRET!).update(stryMutAct_9fa48("22") ? `` : (stryCov_9fa48("22"), `${orderId}|${paymentId}`)).digest(stryMutAct_9fa48("23") ? "" : (stryCov_9fa48("23"), 'hex'));
        if (stryMutAct_9fa48("26") ? expectedSignature === signature : stryMutAct_9fa48("25") ? false : stryMutAct_9fa48("24") ? true : (stryCov_9fa48("24", "25", "26"), expectedSignature !== signature)) {
          if (stryMutAct_9fa48("27")) {
            {}
          } else {
            stryCov_9fa48("27");
            return NextResponse.json(stryMutAct_9fa48("28") ? {} : (stryCov_9fa48("28"), {
              error: stryMutAct_9fa48("29") ? "" : (stryCov_9fa48("29"), 'Invalid signature')
            }), stryMutAct_9fa48("30") ? {} : (stryCov_9fa48("30"), {
              status: 400
            }));
          }
        }
        const serviceClient = getServiceClient();
        const {
          data: existingSubscription,
          error: existingSubscriptionError
        } = await serviceClient.from(stryMutAct_9fa48("31") ? "" : (stryCov_9fa48("31"), 'subscriptions')).select(stryMutAct_9fa48("32") ? "" : (stryCov_9fa48("32"), 'id')).eq(stryMutAct_9fa48("33") ? "" : (stryCov_9fa48("33"), 'provider'), stryMutAct_9fa48("34") ? "" : (stryCov_9fa48("34"), 'razorpay')).eq(stryMutAct_9fa48("35") ? "" : (stryCov_9fa48("35"), 'provider_subscription_id'), orderId).maybeSingle();
        if (stryMutAct_9fa48("37") ? false : stryMutAct_9fa48("36") ? true : (stryCov_9fa48("36", "37"), existingSubscriptionError)) {
          if (stryMutAct_9fa48("38")) {
            {}
          } else {
            stryCov_9fa48("38");
            console.error(stryMutAct_9fa48("39") ? "" : (stryCov_9fa48("39"), 'Failed to check existing subscription:'), existingSubscriptionError);
            return NextResponse.json(stryMutAct_9fa48("40") ? {} : (stryCov_9fa48("40"), {
              error: stryMutAct_9fa48("41") ? "" : (stryCov_9fa48("41"), 'Failed to process subscription')
            }), stryMutAct_9fa48("42") ? {} : (stryCov_9fa48("42"), {
              status: 500
            }));
          }
        }
        if (stryMutAct_9fa48("44") ? false : stryMutAct_9fa48("43") ? true : (stryCov_9fa48("43", "44"), existingSubscription)) {
          if (stryMutAct_9fa48("45")) {
            {}
          } else {
            stryCov_9fa48("45");
            return NextResponse.json(stryMutAct_9fa48("46") ? {} : (stryCov_9fa48("46"), {
              success: stryMutAct_9fa48("47") ? false : (stryCov_9fa48("47"), true)
            }));
          }
        }
        const now = new Date();
        const thirtyDaysFromNow = new Date(stryMutAct_9fa48("48") ? now.getTime() - 30 * 24 * 60 * 60 * 1000 : (stryCov_9fa48("48"), now.getTime() + (stryMutAct_9fa48("49") ? 30 * 24 * 60 * 60 / 1000 : (stryCov_9fa48("49"), (stryMutAct_9fa48("50") ? 30 * 24 * 60 / 60 : (stryCov_9fa48("50"), (stryMutAct_9fa48("51") ? 30 * 24 / 60 : (stryCov_9fa48("51"), (stryMutAct_9fa48("52") ? 30 / 24 : (stryCov_9fa48("52"), 30 * 24)) * 60)) * 60)) * 1000))));

        // Insert into subscriptions table
        const {
          error: subError
        } = await serviceClient.from(stryMutAct_9fa48("53") ? "" : (stryCov_9fa48("53"), 'subscriptions')).insert(stryMutAct_9fa48("54") ? {} : (stryCov_9fa48("54"), {
          user_id: user.id,
          plan_type: stryMutAct_9fa48("55") ? "" : (stryCov_9fa48("55"), 'premium_monthly'),
          status: stryMutAct_9fa48("56") ? "" : (stryCov_9fa48("56"), 'active'),
          provider: stryMutAct_9fa48("57") ? "" : (stryCov_9fa48("57"), 'razorpay'),
          provider_customer_id: paymentId,
          provider_subscription_id: orderId,
          current_period_start: now.toISOString(),
          current_period_end: thirtyDaysFromNow.toISOString(),
          weekly_session_limit: null // null = unlimited
        }));
        if (stryMutAct_9fa48("59") ? false : stryMutAct_9fa48("58") ? true : (stryCov_9fa48("58", "59"), subError)) {
          if (stryMutAct_9fa48("60")) {
            {}
          } else {
            stryCov_9fa48("60");
            console.error(stryMutAct_9fa48("61") ? "" : (stryCov_9fa48("61"), 'Failed to insert subscription:'), subError);
            return NextResponse.json(stryMutAct_9fa48("62") ? {} : (stryCov_9fa48("62"), {
              error: stryMutAct_9fa48("63") ? "" : (stryCov_9fa48("63"), 'Failed to process subscription')
            }), stryMutAct_9fa48("64") ? {} : (stryCov_9fa48("64"), {
              status: 500
            }));
          }
        }

        // Update profiles table
        const {
          error: profileError
        } = await getServiceClient().from(stryMutAct_9fa48("65") ? "" : (stryCov_9fa48("65"), 'profiles')).update(stryMutAct_9fa48("66") ? {} : (stryCov_9fa48("66"), {
          subscription_status: stryMutAct_9fa48("67") ? "" : (stryCov_9fa48("67"), 'premium'),
          subscription_expires_at: thirtyDaysFromNow.toISOString()
        })).eq(stryMutAct_9fa48("68") ? "" : (stryCov_9fa48("68"), 'id'), user.id);
        if (stryMutAct_9fa48("70") ? false : stryMutAct_9fa48("69") ? true : (stryCov_9fa48("69", "70"), profileError)) {
          if (stryMutAct_9fa48("71")) {
            {}
          } else {
            stryCov_9fa48("71");
            console.error(stryMutAct_9fa48("72") ? "" : (stryCov_9fa48("72"), 'Failed to update profile:'), profileError);
            return NextResponse.json(stryMutAct_9fa48("73") ? {} : (stryCov_9fa48("73"), {
              error: stryMutAct_9fa48("74") ? "" : (stryCov_9fa48("74"), 'Failed to update subscription status')
            }), stryMutAct_9fa48("75") ? {} : (stryCov_9fa48("75"), {
              status: 500
            }));
          }
        }

        // Invalidate StudentContext cache
        try {
          if (stryMutAct_9fa48("76")) {
            {}
          } else {
            stryCov_9fa48("76");
            await invalidateStudentContext(user.id);
          }
        } catch (cacheError) {
          if (stryMutAct_9fa48("77")) {
            {}
          } else {
            stryCov_9fa48("77");
            console.warn(stryMutAct_9fa48("78") ? "" : (stryCov_9fa48("78"), 'Failed to invalidate cache:'), cacheError);
          }
        }
        return NextResponse.json(stryMutAct_9fa48("79") ? {} : (stryCov_9fa48("79"), {
          success: stryMutAct_9fa48("80") ? false : (stryCov_9fa48("80"), true)
        }));
      }
    } catch (error) {
      if (stryMutAct_9fa48("81")) {
        {}
      } else {
        stryCov_9fa48("81");
        console.error(stryMutAct_9fa48("82") ? "" : (stryCov_9fa48("82"), 'Error verifying payment:'), error);
        return NextResponse.json(stryMutAct_9fa48("83") ? {} : (stryCov_9fa48("83"), {
          error: stryMutAct_9fa48("84") ? "" : (stryCov_9fa48("84"), 'Internal server error')
        }), stryMutAct_9fa48("85") ? {} : (stryCov_9fa48("85"), {
          status: 500
        }));
      }
    }
  }
}