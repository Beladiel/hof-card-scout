const VERSION = "3.23.6";
const DEFAULT_ORIGIN = "https://beladiel.github.io";
const VALUATION_CACHE_VERSION = 1;
const VALUATION_CACHE_FRESH_SECONDS = 6 * 60 * 60;
const VALUATION_CACHE_RETENTION_SECONDS = 48 * 60 * 60;
const SERP_TIMEOUT_MS = 8000;
const SERP_COMPLETED_FAST_TIMEOUT_MS = 5000;
// Target/value sold-comps discovery gets its own request, so it can afford
// a little more provider time than live Deal Finder searches.
const SERP_SOLD_STRICT_TIMEOUT_MS = 10000;
// Broad sold searches use SerpApi async submission + Search Archive polling.
// This avoids holding one slow HTTP connection open until eBay finishes rendering.
const SERP_ASYNC_POLL_INTERVAL_MS = 1800;
const SERP_ASYNC_MAX_WAIT_MS = 30000;
const TARGET_EVIDENCE_GOAL = 4;
const TARGET_ENRICHMENT_WAIT_MS = 11000;
const TARGET_MARKET_CHECK_VERSION = 5;
const APIFY_FAST_COUNT = 12;
const APIFY_DEEP_COUNT = 15;
const APIFY_FAST_TIMEOUT_SECONDS = 20;
const APIFY_DEEP_TIMEOUT_SECONDS = 35;
const PSA_TIMEOUT_MS = 8000;
const PSA_CACHE_TTL_SECONDS = 24 * 60 * 60;
const CARD_API_TIMEOUT_MS = 7000;
const CARD_API_PER_PLATFORM_LIMIT = 5;
const CARD_API_EBAY_SOLD_LIMIT = 45;
const CARD_API_EBAY_FALLBACK_LIMIT = 25;
const CARD_API_TARGET_ROW_LIMIT = 70;
const CARD_API_BEST_OFFER_LIMIT = 15;
const BEST_OFFER_BRIDGE_APIFY_COUNT = 12;
const BEST_OFFER_BRIDGE_MAX_CANDIDATES = 3;
const LIVE_BO_FAST_MAX_CANDIDATES = 1;
const LIVE_BO_DEEP_MAX_CANDIDATES = 3;
const LIVE_BO_FAST_TIMEOUT_MS = 3500;
const LIVE_BO_DEEP_TIMEOUT_MS = 5000;
const CARD_API_PLATFORMS = ["goldin", "lelands", "scp", "hakes", "rea"];
const DEALS_TIMEOUT_MS = 9000;
const DEALS_SEARCH_COUNT = 50;
const DEALS_BIN_LIMIT = 8;
const DEALS_AUCTION_LIMIT = 6;
const DEALS_REJECT_LIMIT = 10;
const COLLECTION_KV_KEY = "collection:primary:v1";
const COLLECTION_MAX_BYTES = 512 * 1024;
const COLLECTION_MAX_PLAYERS = 500;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    const corsOrigin = origin === allowedOrigin ? origin : allowedOrigin;
    const cors = {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,X-Scout-Key",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized" }, 401, cors);
      }
      return json({
        ok: true,
        version: VERSION,
        configured: Boolean(env.SERPAPI_KEY || env.APIFY_TOKEN),
        providers: {
          serpapi: Boolean(env.SERPAPI_KEY),
          apify: Boolean(env.APIFY_TOKEN),
          psa: Boolean(env.PSA_API_TOKEN),
          cardapi: Boolean(env.CARD_API_KEY),
          cloudStorage: Boolean(env.SCOUT_DATA),
        }
      }, 200, cors);
    }

    if (url.pathname === "/psa/verify" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.PSA_API_TOKEN) {
        return json({ ok: false, error: "psa_not_configured", message: "PSA_API_TOKEN is not configured on the Worker." }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const certNumber = normalizePsaCertNumber(body?.certNumber);
      if (!certNumber) {
        return json({ ok: false, error: "invalid_cert", message: "Enter a numeric PSA certification number." }, 400, cors);
      }

      try {
        const cached = await readPsaCache(certNumber);
        if (cached) return json({ ok: true, version: VERSION, cached: true, ...cached }, 200, cors);

        const result = await verifyPsaCert(certNumber, env.PSA_API_TOKEN);
        if (result.verified) {
          const put = writePsaCache(certNumber, result);
          if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put);
          else await put;
        }
        return json({ ok: true, version: VERSION, cached: false, ...result }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({ ok: false, error: err?.code || "psa_lookup_failed", message: err?.message || "PSA verification failed." }, status, cors);
      }
    }

    if (url.pathname === "/cardapi/test" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.CARD_API_KEY) {
        return json({ ok: false, error: "cardapi_not_configured", message: "CARD_API_KEY is not configured on the Worker." }, 503, cors);
      }

      let card;
      try { card = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        const result = await testCardApiSecondarySources(card, env.CARD_API_KEY);
        return json({
          ok: true,
          version: VERSION,
          provider: "The Card API",
          cachePolicy: "session-only / not persisted",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({ ok: false, error: err?.code || "cardapi_test_failed", message: err?.message || "The Card API test failed." }, status, cors);
      }
    }

    if (url.pathname === "/cardapi/bestoffer" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.CARD_API_KEY) {
        return json({ ok: false, error: "cardapi_not_configured", message: "CARD_API_KEY is not configured on the Worker." }, 503, cors);
      }

      let card;
      try { card = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        const result = await testCardApiBestOffers(card, env.CARD_API_KEY);
        return json({
          ok: true,
          version: VERSION,
          provider: "The Card API — eBay Best Offer",
          cachePolicy: "session-only / not persisted",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({ ok: false, error: err?.code || "cardapi_bestoffer_failed", message: err?.message || "The Card API Best Offer test failed." }, status, cors);
      }
    }


    if (url.pathname === "/cardapi/recover-bestoffers" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.APIFY_TOKEN || !env.CARD_API_KEY) {
        return json({
          ok: false,
          error: "bridge_not_configured",
          message: "Both APIFY_TOKEN and CARD_API_KEY are required for Best Offer recovery."
        }, 503, cors);
      }

      let card;
      try { card = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        const result = await testBestOfferRecoveryBridge(card, env.APIFY_TOKEN, env.CARD_API_KEY);
        return json({
          ok: true,
          version: VERSION,
          provider: "Apify → The Card API Best Offer Bridge",
          cachePolicy: "test-only / not persisted",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({
          ok: false,
          error: err?.code || "bestoffer_bridge_failed",
          message: err?.message || "Best Offer recovery bridge failed."
        }, status, cors);
      }
    }


    if (url.pathname === "/confidence/explain" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY && !env.CARD_API_KEY && !env.APIFY_TOKEN) {
        return json({ ok: false, error: "provider_not_configured", message: "No sold-comps provider is configured." }, 503, cors);
      }

      let card;
      try { card = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

      try {
        // Phase 2C should explain the exact valuation Scout already produced,
        // not make a second set of paid/slow provider calls. Read the normal
        // six-hour cache only. The lab therefore costs zero additional
        // SerpApi, Apify, or Card API usage.
        const fastMode = Boolean(card.fastMode);
        const cacheEntry = await readValuationCache(card, fastMode);
        const cached = cacheEntry?.fresh ? cacheEntry.result : null;
        if (!cached) {
          return json({
            ok: false,
            error: "no_cached_valuation",
            message: fastMode
              ? "No cached Fast Mode valuation is available. Run this card once in normal HOF Card Scout with Fast Mode ON, then try Explain Confidence again."
              : "No cached Deep Mode valuation is available. Run this card once in normal HOF Card Scout with Fast Mode OFF, then try Explain Confidence again."
          }, 409, cors);
        }

        const result = withCurrentShopVerdict(cached, card, true);
        const experimental = explainExperimentalConfidence(result, card);
        return json({
          ok: true,
          version: VERSION,
          phase: "2C confidence model",
          cachePolicy: "read-only explanation of Scout's existing 6-hour valuation cache",
          current: {
            confidence: result.confidence,
            verdictTier: result.verdictTier,
            provider: result.provider,
            used: result.used,
            median: result.median,
            low: result.low,
            high: result.high,
            bestOfferRecovered: result.bestOfferRecovered || 0,
            bestOfferRecoveryAttempted: result.bestOfferRecoveryAttempted || 0,
          },
          experimental,
          comps: result.comps,
          notes: result.notes,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({ ok: false, error: "confidence_lab_failed", message: err?.message || "Confidence lab failed." }, 502, cors);
      }
    }



    if (url.pathname === "/monthly-pick" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY) {
        return json({
          ok: false,
          error: "monthly_pick_provider_not_configured",
          message: "Scout's Monthly Pick needs the existing SERPAPI_KEY configured on the Worker."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const player = String(body?.player || "").trim();
      const budget = Number(body?.budget);
      const mode = body?.mode === "upgrade" ? "upgrade" : "need";
      const currentCard = body?.currentCard && typeof body.currentCard === "object" ? body.currentCard : null;
      const excludeIds = Array.isArray(body?.excludeIds)
        ? body.excludeIds.map(x => String(x || "")).filter(Boolean).slice(0, 25)
        : [];
      const preferredSellers = Array.isArray(body?.preferredSellers)
        ? body.preferredSellers.map(x => String(x || "").trim()).filter(Boolean).slice(0, 100)
        : [];

      if (player.length < 2 || player.length > 100) {
        return json({ ok: false, error: "invalid_player", message: "Monthly Pick needs a valid Hall of Famer name." }, 400, cors);
      }
      if (!Number.isFinite(budget) || budget < 1 || budget > 10000) {
        return json({ ok: false, error: "invalid_budget", message: "Enter a monthly budget between $1 and $10,000." }, 400, cors);
      }

      try {
        const result = await searchMonthlyPickListing({
          player,
          budget,
          mode,
          currentCard,
          excludeIds,
          preferredSellers,
          apiKey: env.SERPAPI_KEY,
          purpose: "monthly"
        });
        return json({
          ok: true,
          version: VERSION,
          phase: "6 Scout's Monthly Pick lab",
          provider: "Active eBay listings via SerpApi",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({
          ok: false,
          error: err?.code || "monthly_pick_failed",
          message: err?.message || "Scout could not find this month's recommendation."
        }, status, cors);
      }
    }


    if (url.pathname === "/find-target" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY) {
        return json({
          ok: false,
          error: "find_target_provider_not_configured",
          message: "Find a Target needs the existing SERPAPI_KEY configured on the Worker."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const player = String(body?.player || "").trim();
      const budget = Number(body?.budget);
      const mode = body?.mode === "upgrade" ? "upgrade" : "need";
      const currentCard = body?.currentCard && typeof body.currentCard === "object" ? body.currentCard : null;
      const searchHint = String(body?.searchHint || "").trim().slice(0, 180);
      const futureHof = body?.futureHof === true;
      const excludeIds = Array.isArray(body?.excludeIds)
        ? body.excludeIds.map(x => String(x || "")).filter(Boolean).slice(0, 25)
        : [];
      const preferredSellers = Array.isArray(body?.preferredSellers)
        ? body.preferredSellers.map(x => String(x || "").trim()).filter(Boolean).slice(0, 100)
        : [];

      if (player.length < 2 || player.length > 100) {
        return json({ ok: false, error: "invalid_player", message: "Find a Target needs a valid Hall of Famer name." }, 400, cors);
      }
      if (!Number.isFinite(budget) || budget < 1 || budget > 10000) {
        return json({ ok: false, error: "invalid_budget", message: "Enter a target budget between $1 and $10,000." }, 400, cors);
      }
      if (mode === "upgrade" && !currentCard) {
        return json({ ok: false, error: "current_card_required", message: "Scout needs the current representative card to judge an upgrade." }, 400, cors);
      }

      try {
        const result = await searchMonthlyPickListing({
          player,
          budget,
          mode,
          currentCard,
          excludeIds,
          preferredSellers,
          apiKey: env.SERPAPI_KEY,
          purpose: "target",
          searchHint,
          futureHof
        });
        if (result?.suggestion) {
          result.suggestion.marketCheck = await targetRecommendationMarketCheck(result.suggestion, player, env);
        }
        return json({
          ok: true,
          version: VERSION,
          phase: "6 Find a Target lab",
          provider: "Active eBay listings via SerpApi",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({
          ok: false,
          error: err?.code || "find_target_failed",
          message: err?.message || "Scout could not find a target recommendation."
        }, status, cors);
      }
    }

    if (url.pathname === "/deals" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SERPAPI_KEY) {
        return json({
          ok: false,
          error: "deal_provider_not_configured",
          message: "Deal Finder needs the existing SERPAPI_KEY configured on the Worker."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

      const card = body?.card || body;
      const targets = body?.targets || {};
      const valid = validateCard(card);
      if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);
      if (!String(card.cardNum || "").trim()) {
        return json({
          ok: false,
          error: "card_number_required",
          message: "Deal Finder needs the card number so Scout can safely match active listings."
        }, 400, cors);
      }

      const targetCheck = validateDealTargets(targets);
      if (!targetCheck.ok) {
        return json({ ok: false, error: "invalid_targets", message: targetCheck.message }, 400, cors);
      }

      try {
        const result = await searchActiveEbayDeals(card, targetCheck.targets, env.SERPAPI_KEY);
        return json({
          ok: true,
          version: VERSION,
          phase: "4A Deal Finder live lab",
          provider: "Active eBay listings via SerpApi",
          ...result,
        }, 200, cors);
      } catch (err) {
        console.error(err);
        const status = Number(err?.status) || 502;
        return json({
          ok: false,
          error: err?.code || "deal_search_failed",
          message: err?.message || "Active listing search failed."
        }, status, cors);
      }
    }


    if (url.pathname === "/collection/load" && request.method === "GET") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({
          ok: false,
          error: "cloud_storage_not_configured",
          message: "SCOUT_DATA KV binding is not configured on the Worker."
        }, 503, cors);
      }

      try {
        const saved = await env.SCOUT_DATA.get(COLLECTION_KV_KEY, { type: "json" });
        if (!saved) {
          return json({
            ok: true,
            version: VERSION,
            found: false,
            message: "No Scout cloud backup exists yet."
          }, 200, cors);
        }

        return json({
          ok: true,
          version: VERSION,
          found: true,
          schema: Number(saved.schema) || 1,
          savedAt: saved.savedAt || null,
          clientUpdatedAt: saved.clientUpdatedAt || null,
          playerCount: saved.playerUpdates && typeof saved.playerUpdates === "object"
            ? Object.keys(saved.playerUpdates).length
            : 0,
          playerUpdates: saved.playerUpdates && typeof saved.playerUpdates === "object"
            ? saved.playerUpdates
            : {},
          monthlyPick: saved.monthlyPick && typeof saved.monthlyPick === "object" && !Array.isArray(saved.monthlyPick)
            ? saved.monthlyPick
            : null,
          futureHof: saved.futureHof && typeof saved.futureHof === "object" && !Array.isArray(saved.futureHof)
            ? saved.futureHof
            : null
        }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({
          ok: false,
          error: "cloud_load_failed",
          message: err?.message || "Scout could not load the cloud backup."
        }, 502, cors);
      }
    }

    if (url.pathname === "/collection/save" && request.method === "POST") {
      const supplied = request.headers.get("X-Scout-Key") || "";
      if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
        return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
      }
      if (!env.SCOUT_DATA) {
        return json({
          ok: false,
          error: "cloud_storage_not_configured",
          message: "SCOUT_DATA KV binding is not configured on the Worker."
        }, 503, cors);
      }

      let body;
      try { body = await request.json(); }
      catch { return json({ ok: false, error: "bad_json", message: "Cloud backup payload is not valid JSON." }, 400, cors); }

      const playerUpdates = body?.playerUpdates;
      if (!playerUpdates || typeof playerUpdates !== "object" || Array.isArray(playerUpdates)) {
        return json({
          ok: false,
          error: "invalid_collection",
          message: "playerUpdates must be an object keyed by Hall of Famer name."
        }, 400, cors);
      }

      const monthlyPick = body?.monthlyPick == null
        ? null
        : (typeof body.monthlyPick === "object" && !Array.isArray(body.monthlyPick) ? body.monthlyPick : undefined);
      if (body?.monthlyPick != null && monthlyPick === undefined) {
        return json({
          ok: false,
          error: "invalid_monthly_pick",
          message: "monthlyPick must be an object or null."
        }, 400, cors);
      }

      const futureHof = body?.futureHof == null
        ? null
        : (typeof body.futureHof === "object" && !Array.isArray(body.futureHof) ? body.futureHof : undefined);
      if (body?.futureHof != null && futureHof === undefined) {
        return json({
          ok: false,
          error: "invalid_future_hof",
          message: "futureHof must be an object or null."
        }, 400, cors);
      }

      const playerCount = Object.keys(playerUpdates).length;
      if (playerCount > COLLECTION_MAX_PLAYERS) {
        return json({
          ok: false,
          error: "collection_too_large",
          message: "Scout received more player records than expected."
        }, 413, cors);
      }

      const record = {
        schema: 3,
        savedAt: new Date().toISOString(),
        clientUpdatedAt: body?.clientUpdatedAt || null,
        appVersion: body?.appVersion || null,
        playerUpdates,
        monthlyPick,
        futureHof
      };
      const serialized = JSON.stringify(record);

      if (new TextEncoder().encode(serialized).byteLength > COLLECTION_MAX_BYTES) {
        return json({
          ok: false,
          error: "collection_too_large",
          message: "Scout cloud backup is larger than the allowed safety limit."
        }, 413, cors);
      }

      try {
        await env.SCOUT_DATA.put(COLLECTION_KV_KEY, serialized);
        return json({
          ok: true,
          version: VERSION,
          savedAt: record.savedAt,
          playerCount,
          bytes: new TextEncoder().encode(serialized).byteLength
        }, 200, cors);
      } catch (err) {
        console.error(err);
        return json({
          ok: false,
          error: "cloud_save_failed",
          message: err?.message || "Scout could not save the cloud backup."
        }, 502, cors);
      }
    }

    if (url.pathname !== "/value" || request.method !== "POST") {
      return json({ ok: false, error: "not_found" }, 404, cors);
    }

    const supplied = request.headers.get("X-Scout-Key") || "";
    if (!env.SCOUT_ACCESS_KEY || supplied !== env.SCOUT_ACCESS_KEY) {
      return json({ ok: false, error: "unauthorized", message: "Scout access key rejected." }, 401, cors);
    }
    if (!env.SERPAPI_KEY && !env.CARD_API_KEY && !env.APIFY_TOKEN) {
      return json({
        ok: false,
        error: "provider_not_configured",
        message: "No SerpApi, The Card API, or Apify sold-comps provider is configured on the Worker."
      }, 503, cors);
    }

    let card;
    try { card = await request.json(); }
    catch { return json({ ok: false, error: "bad_json" }, 400, cors); }

    const valid = validateCard(card);
    if (!valid.ok) return json({ ok: false, error: "invalid_card", message: valid.message }, 400, cors);

    try {
      const fastMode = Boolean(card.fastMode);
      const result = await getValuationWithCache(card, env, fastMode, ctx);
      return json({ ok: true, version: VERSION, ...result }, 200, cors);
    } catch (err) {
      console.error(err);
      return json({ ok: false, error: "valuation_failed", message: err?.message || "Valuation failed." }, 502, cors);
    }
  }
};

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function validateCard(c) {
  if (!c || typeof c !== "object") return { ok: false, message: "Card data is missing." };
  if (!String(c.player || "").trim()) return { ok: false, message: "Player is required." };
  const year = Number(c.year);
  if (!Number.isInteger(year) || year < 1880 || year > new Date().getFullYear() + 1) return { ok: false, message: "A valid card year is required." };
  if (!String(c.set || "").trim()) return { ok: false, message: "Set is required." };
  return { ok: true };
}

function normalizePsaCertNumber(value) {
  const raw = String(value ?? "").trim().replace(/[\s-]+/g, "");
  if (!/^\d{4,12}$/.test(raw)) return "";
  return raw;
}

async function verifyPsaCert(certNumber, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PSA_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error("PSA did not respond within 8 seconds. Please try again.");
      e.code = "psa_timeout";
      e.status = 504;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return { verified: false, certNumber, message: "PSA returned no certification data for that number." };
  }

  if (response.status === 429) {
    const e = new Error("PSA's 100-call daily API quota has been reached. Try again after PSA resets the daily quota.");
    e.code = "psa_daily_quota";
    e.status = 429;
    throw e;
  }

  if (response.status === 401 || response.status === 403) {
    const e = new Error("PSA rejected the API authorization. Generate a fresh PSA token if this continues after the quota resets.");
    e.code = "psa_auth_rejected";
    e.status = 502;
    throw e;
  }

  let data = null;
  try { data = await response.json(); }
  catch {
    const e = new Error(`PSA returned an unreadable response (HTTP ${response.status}).`);
    e.code = "psa_bad_response";
    e.status = 502;
    throw e;
  }

  if (!response.ok) {
    const e = new Error(response.status >= 500
      ? "PSA rejected the API request or is temporarily unavailable."
      : `PSA request failed (HTTP ${response.status}).`);
    e.code = response.status >= 500 ? "psa_auth_or_server_error" : "psa_http_error";
    e.status = 502;
    throw e;
  }

  const psa = data?.PSACert || data?.PsaCert || data?.psaCert || null;
  const validRequest = data?.IsValidRequest ?? data?.isValidRequest;
  const serverMessage = String(data?.ServerMessage ?? data?.serverMessage ?? "").trim();

  if (validRequest === false) {
    return { verified: false, certNumber, message: serverMessage || "PSA says that certification number is invalid." };
  }
  if (!psa) {
    return { verified: false, certNumber, message: serverMessage || "No PSA certification record was found." };
  }

  const year = firstText(psa.YearIssued, psa.Year, psa.yearIssued, psa.year);
  const brand = firstText(psa.Brand, psa.BrandTitle, psa.brand, psa.brandTitle);
  const variety = firstText(psa.Variety, psa.variety);
  const subject = firstText(psa.Subject, psa.subject);
  const cardNumber = firstText(psa.CardNumber, psa.cardNumber);
  const grade = firstText(psa.CardGrade, psa.Grade, psa.cardGrade, psa.grade);
  const gradeDescription = firstText(psa.GradeDescription, psa.gradeDescription);
  const category = firstText(psa.Category, psa.category);
  const cardAttributes = firstText(psa.CardAttributes, psa.SpecAttr, psa.cardAttributes, psa.specAttr);
  const labelType = firstText(psa.LabelType, psa.labelType);
  const imageUrl = firstText(psa.ImageURL, psa.ImageUrl, psa.imageURL, psa.imageUrl);
  const returnedCert = firstText(psa.CertNumber, psa.CertNo, psa.certNumber, psa.certNo, certNumber);
  const setName = [brand, variety].filter(Boolean).join(" ").trim();

  return {
    verified: true,
    certNumber: returnedCert || certNumber,
    message: serverMessage || "Request successful",
    card: {
      year,
      brand,
      variety,
      set: setName,
      subject,
      cardNumber,
      grade,
      gradeDescription,
      category,
      cardAttributes,
      labelType,
      imageUrl,
    },
    psaUrl: `https://www.psacard.com/cert/${encodeURIComponent(returnedCert || certNumber)}/psa`,
  };
}

function firstText(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function psaCacheKey(certNumber) {
  return new Request(`https://hof-card-scout-cache.invalid/psa?cert=${encodeURIComponent(certNumber)}&v=${encodeURIComponent(VERSION)}`, { method: "GET" });
}

async function readPsaCache(certNumber) {
  try {
    const hit = await caches.default.match(psaCacheKey(certNumber));
    if (!hit) return null;
    return await hit.json();
  } catch {
    return null;
  }
}

async function writePsaCache(certNumber, result) {
  try {
    const response = new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${PSA_CACHE_TTL_SECONDS}`,
      }
    });
    await caches.default.put(psaCacheKey(certNumber), response);
  } catch (err) {
    console.warn("PSA cache write failed", err);
  }
}


function buildCardApiQuery(card) {
  const parts = [
    card.year,
    String(card.set || "").trim(),
    String(card.player || "").trim(),
    card.cardNum ? String(card.cardNum).replace(/^#/, "").trim() : "",
  ];
  if (card.autograph) parts.push("autograph");
  if (card.relic) parts.push("relic");
  const denom = serialDenominator(card.serial);
  if (denom) parts.push(`/${denom}`);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildCardApiEbaySoldQuery(card) {
  const parts = [buildCardApiQuery(card)];
  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  if (grader && grader !== "Raw") parts.push(grader, grade);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildCardApiEbayFallbackQuery(card) {
  const playerTokens = normalizeText(card.player).split(" ").filter(Boolean);
  const lastName = playerTokens[playerTokens.length - 1] || "";
  return [
    card.year,
    String(card.set || "").trim(),
    lastName,
    card.cardNum ? String(card.cardNum).replace(/^#/, "").trim() : "",
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function applyCardApiGradingFilters(params, card) {
  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  if (grader === "Raw") {
    params.set("graded", "false");
  } else if (grader) {
    params.set("graded", "true");
    params.set("grader", grader);
    if (grade) params.set("grade", grade);
  }
}

async function fetchCardApiEbaySoldRows(card, query, apiKey, limit, label) {
  const params = new URLSearchParams({
    q: query,
    platform: "ebay",
    sort: "date_desc",
    limit: String(limit),
  });
  applyCardApiGradingFilters(params, card);
  const response = await fetchWithTimeout(
    `https://thecardapi.com/api/v1/market/sales?${params.toString()}`,
    { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
    CARD_API_TIMEOUT_MS,
    `${label} timed out`
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(String(payload?.message || payload?.error || `The Card API returned HTTP ${response.status}`));
    err.status = response.status;
    err.code = response.status === 429 ? "cardapi_rate_limit" : "cardapi_http_error";
    throw err;
  }
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function searchCardApiEbaySold(card, apiKey, options={}) {
  const targetEnrichment = options?.targetEnrichment === true;
  const evidenceGoal = targetEnrichment ? Math.max(TARGET_EVIDENCE_GOAL, Number(options?.evidenceGoal) || 0) : 0;
  const query = buildCardApiEbaySoldQuery(card);
  const initialRows = await fetchCardApiEbaySoldRows(
    card,
    query,
    apiKey,
    CARD_API_EBAY_SOLD_LIMIT,
    "The Card API eBay sold search"
  );

  let rows = [...initialRows];
  let normalized = rows
    .map(normalizeCardApiResult)
    .filter(Boolean)
    .filter(item => normalizeText(item.platform) === "ebay");
  let evaluation = evaluateComparableResults(normalized, card, isProductionCardApiComparable);
  let fallbackQuery = "";
  let fallbackError = "";

  if (targetEnrichment && evaluation.cleaned.length < evidenceGoal) {
    fallbackQuery = buildCardApiEbayFallbackQuery(card);
    if (fallbackQuery && normalizeText(fallbackQuery) !== normalizeText(query)) {
      const remainingRowBudget = Math.max(0, CARD_API_TARGET_ROW_LIMIT - CARD_API_EBAY_SOLD_LIMIT);
      const fallbackLimit = Math.min(CARD_API_EBAY_FALLBACK_LIMIT, remainingRowBudget);
      if (fallbackLimit > 0) {
        try {
          const fallbackRows = await fetchCardApiEbaySoldRows(
            card,
            fallbackQuery,
            apiKey,
            fallbackLimit,
            "The Card API target fallback search"
          );
          rows = [...initialRows, ...fallbackRows];
          normalized = dedupeSoldComps(rows
            .map(normalizeCardApiResult)
            .filter(Boolean)
            .filter(item => normalizeText(item.platform) === "ebay"));
          evaluation = evaluateComparableResults(normalized, card, isProductionCardApiComparable);
        } catch (err) {
          fallbackError = err?.message || "The Card API target fallback failed.";
        }
      }
    }
  }

  const notes = buildNotes(card, rows.length, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);
  const unconfirmed = rows.filter(row => row?.price_confirmed === false).length;
  if (unconfirmed) {
    notes.push(`${unconfirmed} The Card API sale${unconfirmed === 1 ? " was" : "s were"} rejected because the transaction price was not confirmed.`);
  }
  if (evaluation.matchMode === "relaxed") {
    notes.push("Scout used a controlled relaxed title match on The Card API results because marketplace titles format grades/card numbers inconsistently.");
  }
  if (fallbackQuery) {
    notes.unshift("The Card API exact-title search remained below the target evidence goal, so Scout tried one last-name/card-number discovery query and reapplied every exact-card rule.");
  }
  if (fallbackError) notes.push(`The Card API target fallback was unavailable: ${fallbackError} Scout kept the verified initial-query evidence.`);

  return {
    ...evaluation,
    searched: rows.length,
    matched: evaluation.matchedItems.length,
    searchMode: fallbackQuery ? "The Card API eBay sold sales + target fallback" : "The Card API eBay sold sales",
    discoveryQuery: fallbackQuery ? `${query} | ${fallbackQuery}` : query,
    notes,
  };
}

async function testCardApiSecondarySources(card, apiKey) {
  const query = buildCardApiQuery(card);
  const settled = await Promise.allSettled(
    CARD_API_PLATFORMS.map(platform => searchCardApiPlatform(card, query, platform, apiKey))
  );

  const all = [];
  const failures = [];
  const platformStats = {};

  settled.forEach((entry, index) => {
    const platform = CARD_API_PLATFORMS[index];
    if (entry.status === "fulfilled") {
      const value = entry.value;
      platformStats[platform] = { returned: value.returned, matched: value.matched.length };
      all.push(...value.matched);
    } else {
      const err = entry.reason || {};
      platformStats[platform] = { returned: 0, matched: 0, error: err.message || "request failed" };
      failures.push(`${platform}: ${err.message || "request failed"}`);
    }
  });

  const matched = dedupeCardApiSales(all)
    .sort((a, b) => new Date(b.soldDate || 0) - new Date(a.soldDate || 0));

  const byPlatform = {};
  for (const item of matched) byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1;

  return {
    query,
    lookbackNote: "The Card API Free plan automatically limits this test to the most recent 3 days.",
    rowBudgetMax: CARD_API_PLATFORMS.length * CARD_API_PER_PLATFORM_LIMIT,
    platformsSearched: CARD_API_PLATFORMS,
    platformStats,
    matched: matched.length,
    byPlatform,
    comps: matched.map(x => ({
      platform: x.platform,
      title: x.title,
      price: x.price,
      soldDate: x.soldDate,
      listingType: x.listingType,
      priceConfirmed: x.priceConfirmed,
      link: x.link,
      grader: x.grader,
      grade: x.grade,
      cardNumber: x.cardNumber,
    })),
    notes: uniqueStrings([
      "This Phase 2B test intentionally excludes eBay so it measures independent auction-house evidence only.",
      "No The Card API transaction response is written to Cloudflare cache or other persistent storage.",
      failures.length ? `Some source checks failed: ${failures.join(" | ")}` : "",
    ]),
  };
}

async function searchCardApiPlatform(card, query, platform, apiKey) {
  const params = new URLSearchParams({
    q: query,
    platform,
    sort: "date_desc",
    limit: String(CARD_API_PER_PLATFORM_LIMIT),
  });

  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  if (grader === "Raw") {
    params.set("graded", "false");
  } else if (grader) {
    params.set("graded", "true");
    params.set("grader", grader);
    if (grade) params.set("grade", grade);
  }

  let response;
  try {
    response = await fetchWithTimeout(
      `https://thecardapi.com/api/v1/market/sales?${params.toString()}`,
      { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
      CARD_API_TIMEOUT_MS,
      `The Card API ${platform} search timed out`
    );
  } catch (err) {
    throw err;
  }

  let payload = null;
  try { payload = await response.json(); } catch {}

  if (!response.ok) {
    const message = payload?.message || payload?.error || `The Card API returned HTTP ${response.status}`;
    const err = new Error(String(message));
    err.status = response.status;
    err.code = response.status === 429 ? "cardapi_rate_limit" : "cardapi_http_error";
    throw err;
  }

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const normalized = rows.map(normalizeCardApiResult).filter(Boolean);
  const matched = normalized.filter(item => isCardApiComparable(item, card));
  return { returned: rows.length, matched };
}

function normalizeCardApiResult(r) {
  if (!r || !r.title) return null;
  const price = extractPrice(r.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  const currency = String(r.currency || "USD").toUpperCase();
  if (currency && currency !== "USD") return null;
  if (r.price_confirmed === false) return null;
  const soldDate = r.sale_date || r.sold_at || null;
  if (!isReasonableSoldDate(soldDate, true)) return null;

  return {
    id: `cardapi:${r.platform || "unknown"}:${r.id || r.listing_url || r.title}`,
    title: String(r.title),
    price,
    originalPrice: extractPrice(r.original_price),
    soldDate,
    condition: r.condition || "",
    link: r.listing_url || "",
    thumbnail: r.thumbnail_url || r.image_url || "",
    source: "The Card API",
    platform: String(r.platform || "").trim(),
    listingType: r.listing_type || "",
    priceConfirmed: r.price_confirmed !== false,
    player: r.player || "",
    cardSet: r.card_set || "",
    cardNumber: r.card_number || "",
    year: r.year ?? "",
    grader: r.grader || "",
    grade: r.grade || "",
    features: Array.isArray(r.features) ? r.features : [],
  };
}

function isCardApiComparable(item, card, relaxed=false) {
  const structuredBits = [
    item.year,
    item.cardSet,
    item.player,
    item.cardNumber ? `#${item.cardNumber}` : "",
    item.grader,
    item.grade,
    ...(item.features || []),
  ].filter(Boolean).join(" ");

  const comparisonItem = { ...item, title: `${item.title} ${structuredBits}`.trim() };
  return isComparable(comparisonItem, card, relaxed);
}

function isProductionCardApiComparable(item, card, relaxed=false) {
  return isComparable(item, card, relaxed) && isCardApiComparable(item, card, relaxed);
}

function dedupeCardApiSales(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item.id || `${item.platform}|${item.link}|${item.title}|${item.price}|${item.soldDate}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function testCardApiBestOffers(card, apiKey) {
  const baseQuery = buildCardApiQuery(card);
  const graderText = String(card?.grader || "").trim();
  const gradeText = String(card?.grade || "").trim();
  const gradedSuffix =
    graderText && graderText.toLowerCase() !== "raw"
      ? ` ${graderText}${gradeText ? " " + gradeText : ""}`
      : "";
  const query = `${baseQuery}${gradedSuffix}`.trim();

  // Deliberately keep the upstream request simple. We previously sent
  // listing_type=best_offer plus grading filters to The Card API; that
  // combination produced a network-level failure for a real test.
  // v3.6.2 fetches a small recent eBay sample and performs Best Offer +
  // card/grade matching locally instead.
  const params = new URLSearchParams({
    q: query,
    platform: "ebay",
    sort: "date_desc",
    limit: String(CARD_API_BEST_OFFER_LIMIT),
  });

  const endpoint = `https://thecardapi.com/api/v1/market/sales?${params.toString()}`;

  let response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
      CARD_API_TIMEOUT_MS,
      "The Card API eBay search timed out"
    );
  } catch (firstErr) {
    // One lightweight retry for a transient upstream connection reset.
    await new Promise(resolve => setTimeout(resolve, 350));
    try {
      response = await fetchWithTimeout(
        endpoint,
        { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
        CARD_API_TIMEOUT_MS,
        "The Card API eBay retry timed out"
      );
    } catch (secondErr) {
      const err = new Error(`The Card API connection failed twice: ${secondErr?.message || firstErr?.message || "network error"}`);
      err.code = "cardapi_network_error";
      err.status = 502;
      throw err;
    }
  }

  let payload = null;
  let rawText = "";
  try {
    rawText = await response.text();
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || rawText?.slice(0, 240) || `The Card API returned HTTP ${response.status}`;
    const err = new Error(String(message));
    err.status = response.status;
    err.code = response.status === 429 ? "cardapi_rate_limit" : "cardapi_http_error";
    throw err;
  }

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const normalized = rows.map(normalizeCardApiResult).filter(Boolean);

  const bestOfferRows = normalized.filter(item =>
    String(item.listingType || "").trim().toLowerCase() === "best_offer"
  );

  const matched = dedupeCardApiSales(
    bestOfferRows.filter(item => isCardApiComparable(item, card))
  ).sort((a, b) => new Date(b.soldDate || 0) - new Date(a.soldDate || 0));

  const offers = matched.map(x => {
    const original = Number(x.originalPrice);
    const accepted = Number(x.price);
    const hasOriginal = Number.isFinite(original) && original > 0;
    const discount = hasOriginal && Number.isFinite(accepted) && accepted > 0 && original >= accepted
      ? Math.round(((original - accepted) / original) * 1000) / 10
      : null;
    return {
      platform: x.platform || "eBay",
      title: x.title,
      acceptedPrice: accepted,
      originalPrice: hasOriginal ? original : null,
      discountPct: discount,
      soldDate: x.soldDate,
      listingType: x.listingType,
      priceConfirmed: x.priceConfirmed,
      link: x.link,
      grader: x.grader,
      grade: x.grade,
      cardNumber: x.cardNumber,
    };
  });

  const meta = payload?.meta || {};
  return {
    query,
    strategy: "recent eBay sample; Best Offer + grade matching performed locally",
    lookbackNote: "The Card API Free plan limits this check to the most recent 3 days.",
    rowBudgetMax: CARD_API_BEST_OFFER_LIMIT,
    platform: "ebay",
    listingType: "best_offer",
    returned: rows.length,
    bestOfferRows: bestOfferRows.length,
    matched: offers.length,
    coverage: {
      from: meta.coverage_date_from || null,
      to: meta.coverage_date_to || null,
    },
    offers,
    notes: [
      "v3.6.3 adds grader/grade to the eBay text query, while still avoiding The Card API's server-side Best Offer filter.",
      "Only records labeled best_offer are eligible for recovery.",
      "The Card API documents price as the transaction price; original_price, when present, is shown as the pre-negotiation ask.",
      "No The Card API transaction response is written to Cloudflare cache or other persistent storage.",
    ],
  };
}


function extractEbayItemId(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  const direct = s.match(/^\d{9,16}$/);
  if (direct) return direct[0];
  const fromUrl = s.match(/\/itm\/(?:[^/?#]+\/)?(\d{9,16})(?:[/?#]|$)/i);
  if (fromUrl) return fromUrl[1];
  const ebayPrefixed = s.match(/^ebay[-_:](\d{9,16})$/i);
  return ebayPrefixed ? ebayPrefixed[1] : "";
}

function normalizeApifyBestOfferCandidate(r) {
  if (!r || !r.title) return null;
  const isBO = r.isBestOfferAccepted === true ||
    String(r.listingType || "").trim().toLowerCase() === "best_offer_accepted";
  if (!isBO) return null;

  const currency = String(r.soldCurrency || "USD").toUpperCase();
  if (currency && currency !== "USD") return null;

  const soldDate = r.endedAt || null;
  if (!isReasonableSoldDate(soldDate, true)) return null;

  const itemId = extractEbayItemId(r.itemId || r.itemNumber || r.url || "");
  if (!itemId) return null;

  return {
    itemId,
    title: String(r.title),
    soldDate,
    askingPrice: extractPrice(r.soldPrice),
    link: r.url || `https://www.ebay.com/itm/${itemId}`,
    listingType: "best_offer_accepted",
  };
}

async function fetchApifyBestOfferCandidates(card, token) {
  const input = {
    keywords: [buildApifyQuery(card)],
    categoryId: "212",
    daysToScrape: 7,
    count: BEST_OFFER_BRIDGE_APIFY_COUNT,
    ebaySite: "ebay.com",
    sortOrder: "endedRecently",
    itemLocation: "default",
    itemCondition: "any",
    includeCompletedListings: true,
  };

  const endpoint = new URL("https://api.apify.com/v2/acts/caffein.dev~ebay-sold-listings/run-sync-get-dataset-items");
  endpoint.searchParams.set("timeout", "25");
  endpoint.searchParams.set("maxItems", String(BEST_OFFER_BRIDGE_APIFY_COUNT));
  endpoint.searchParams.set("maxTotalChargeUsd", "0.10");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("clean", "true");

  const res = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || data?.message || `Apify returned HTTP ${res.status}.`);
    err.status = res.status;
    err.code = "apify_bridge_search_failed";
    throw err;
  }
  if (!Array.isArray(data)) throw new Error("Apify returned an unexpected response.");

  const candidates = data
    .map(normalizeApifyBestOfferCandidate)
    .filter(Boolean)
    .filter(item => isComparable({ ...item, price: item.askingPrice || 1 }, card, false))
    .sort((a, b) => dateValue(b.soldDate) - dateValue(a.soldDate));

  return {
    searched: data.length,
    candidates: dedupeByKey(candidates, x => x.itemId).slice(0, BEST_OFFER_BRIDGE_MAX_CANDIDATES),
  };
}

function dedupeByKey(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(keyFn(item) || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function fetchCardApiSaleByExactEbayId(itemId, apiKey, timeoutMs=CARD_API_TIMEOUT_MS) {
  // The Card API documents sale IDs as platform-prefixed (for example ebay-123...).
  // Try that form first; keep the bare ID as a compatibility fallback.
  const variants = [`ebay-${itemId}`, itemId];
  const attempts = [];

  for (const saleId of variants) {
    const endpoint = `https://thecardapi.com/api/v1/market/sales/${encodeURIComponent(saleId)}`;
    let response;
    try {
      response = await fetchWithTimeout(
        endpoint,
        { method: "GET", headers: { "x-market-api-key": apiKey, "Accept": "application/json" } },
        timeoutMs,
        "The Card API exact-sale lookup timed out"
      );
    } catch (err) {
      attempts.push({ saleId, status: "network_error", message: err?.message || "network error" });
      continue;
    }

    let rawText = "";
    let payload = {};
    try {
      rawText = await response.text();
      payload = rawText ? JSON.parse(rawText) : {};
    } catch {}

    attempts.push({
      saleId,
      status: response.status,
      message: response.ok ? "ok" : (payload?.message || payload?.error || rawText.slice(0, 120) || `HTTP ${response.status}`)
    });

    if (response.status === 404) continue;
    if (!response.ok) {
      const err = new Error(payload?.message || payload?.error || `The Card API returned HTTP ${response.status}.`);
      err.status = response.status;
      err.code = response.status === 429 ? "cardapi_rate_limit" : "cardapi_exact_lookup_failed";
      err.attempts = attempts;
      throw err;
    }

    const rawSale =
      (payload?.data && !Array.isArray(payload.data) ? payload.data : null) ||
      (Array.isArray(payload?.data) ? payload.data[0] : null) ||
      payload?.sale ||
      payload;

    return { rawSale, attempts };
  }

  return { rawSale: null, attempts };
}

function exactSaleMatchesCandidate(rawSale, candidate, card) {
  if (!rawSale || typeof rawSale !== "object") return false;
  const platform = String(rawSale.platform || "").toLowerCase();
  if (platform && platform !== "ebay") return false;

  const rawId = extractEbayItemId(rawSale.id || rawSale.listing_url || "");
  if (rawId && rawId !== candidate.itemId) return false;

  const normalized = normalizeCardApiResult(rawSale);
  if (!normalized) return false;
  if (String(normalized.listingType || "").toLowerCase() !== "best_offer") return false;
  return isCardApiComparable(normalized, card);
}


async function recoverBestOffersFromExistingApifyRows(card, rawRows, cardApiKey, fastMode=false) {
  if (!cardApiKey || !Array.isArray(rawRows) || !rawRows.length) {
    return { attempted: 0, recovered: [], misses: [] };
  }

  const maxCandidates = fastMode ? LIVE_BO_FAST_MAX_CANDIDATES : LIVE_BO_DEEP_MAX_CANDIDATES;
  const timeoutMs = fastMode ? LIVE_BO_FAST_TIMEOUT_MS : LIVE_BO_DEEP_TIMEOUT_MS;

  const candidates = dedupeByKey(
    rawRows
      .map(normalizeApifyBestOfferCandidate)
      .filter(Boolean)
      .filter(item => isComparable({ ...item, price: item.askingPrice || 1 }, card, false))
      .sort((a, b) => dateValue(b.soldDate) - dateValue(a.soldDate)),
    x => x.itemId
  ).slice(0, maxCandidates);

  const recovered = [];
  const misses = [];

  for (const candidate of candidates) {
    try {
      const exact = await fetchCardApiSaleByExactEbayId(candidate.itemId, cardApiKey, timeoutMs);
      if (!exact.rawSale || !exactSaleMatchesCandidate(exact.rawSale, candidate, card)) {
        misses.push(candidate.itemId);
        continue;
      }

      const sale = normalizeCardApiResult(exact.rawSale);
      if (!sale || String(sale.listingType || "").toLowerCase() !== "best_offer" || sale.priceConfirmed === false) {
        misses.push(candidate.itemId);
        continue;
      }

      // Shape it like the normal sold-comps rows so the existing matching,
      // outlier, confidence, and verdict math can remain unchanged.
      recovered.push({
        id: candidate.itemId,
        title: sale.title || candidate.title,
        price: Number(sale.price),
        soldDate: sale.soldDate || candidate.soldDate,
        condition: sale.condition || "",
        link: sale.link || candidate.link,
        thumbnail: sale.thumbnail || "",
        source: "Card API Best Offer",
        listingType: "best_offer_recovered",
        originalPrice: Number.isFinite(Number(sale.originalPrice)) ? Number(sale.originalPrice) : candidate.askingPrice,
        priceConfirmed: true,
      });
    } catch (err) {
      // Recovery is enrichment only. A Card API timeout/rate-limit must never
      // break a valuation that already has valid SerpApi/Apify sold comps.
      misses.push(candidate.itemId);
    }
  }

  return { attempted: candidates.length, recovered, misses };
}

async function testBestOfferRecoveryBridge(card, apifyToken, cardApiKey) {
  const apify = await fetchApifyBestOfferCandidates(card, apifyToken);
  const recoveries = [];
  const misses = [];

  for (const candidate of apify.candidates) {
    const exact = await fetchCardApiSaleByExactEbayId(candidate.itemId, cardApiKey);
    if (!exact.rawSale) {
      misses.push({
        itemId: candidate.itemId,
        title: candidate.title,
        soldDate: candidate.soldDate,
        askingPriceSeenByApify: candidate.askingPrice,
        reason: "Exact sale ID was not found in The Card API free-window data.",
        attempts: exact.attempts,
      });
      continue;
    }

    if (!exactSaleMatchesCandidate(exact.rawSale, candidate, card)) {
      misses.push({
        itemId: candidate.itemId,
        title: candidate.title,
        soldDate: candidate.soldDate,
        askingPriceSeenByApify: candidate.askingPrice,
        reason: "The Card API returned the ID, but it was not a confirmed matching best_offer record for this card.",
        attempts: exact.attempts,
      });
      continue;
    }

    const sale = normalizeCardApiResult(exact.rawSale);
    const accepted = Number(sale.price);
    const apiOriginal = Number(sale.originalPrice);
    const apifyAsk = Number(candidate.askingPrice);
    const original =
      Number.isFinite(apiOriginal) && apiOriginal > 0 ? apiOriginal :
      Number.isFinite(apifyAsk) && apifyAsk > 0 ? apifyAsk : null;
    const discountPct =
      Number.isFinite(original) && original >= accepted && accepted > 0
        ? Math.round(((original - accepted) / original) * 1000) / 10
        : null;

    recoveries.push({
      itemId: candidate.itemId,
      title: sale.title || candidate.title,
      soldDate: sale.soldDate || candidate.soldDate,
      acceptedPrice: accepted,
      originalAsk: original,
      originalAskSource: Number.isFinite(apiOriginal) && apiOriginal > 0 ? "The Card API" : "Apify asking-price placeholder",
      discountPct,
      listingType: sale.listingType,
      priceConfirmed: sale.priceConfirmed,
      link: sale.link || candidate.link,
      grader: sale.grader,
      grade: sale.grade,
      attempts: exact.attempts,
    });
  }

  return {
    query: buildApifyQuery(card),
    apifySearched: apify.searched,
    bestOfferCandidates: apify.candidates.length,
    recovered: recoveries.length,
    recoveries,
    misses,
    limits: {
      apifyRows: BEST_OFFER_BRIDGE_APIFY_COUNT,
      exactCandidatesChecked: BEST_OFFER_BRIDGE_MAX_CANDIDATES,
      apifyMaxChargeUsd: 0.10,
    },
    notes: [
      "This is a test-only bridge; recovered prices do not affect Scout's live valuation yet.",
      "Apify identifies Best Offer Accepted listings and supplies the eBay item ID; The Card API is asked for that exact sale.",
      "Only The Card API records labeled best_offer with confirmed transaction pricing are accepted.",
      "The Card API free plan can only recover sales that are still inside its current lookback window.",
      "No The Card API transaction response is written to Cloudflare cache or other persistent storage.",
    ],
  };
}

function normalizeValuationProfile(options={}) {
  const targetEnrichment = options?.targetEnrichment === true;
  return {
    targetEnrichment,
    evidenceGoal: targetEnrichment
      ? Math.max(TARGET_EVIDENCE_GOAL, Number(options?.evidenceGoal) || 0)
      : 0,
    extraWaitMs: targetEnrichment
      ? Math.min(12000, Math.max(10000, Number(options?.extraWaitMs) || TARGET_ENRICHMENT_WAIT_MS))
      : 0,
    fallbackEvidenceCount: targetEnrichment
      ? Math.max(0, Number(options?.fallbackEvidenceCount) || 0)
      : 0,
  };
}

async function valueCard(card, env, fastMode=false, options={}) {
  const profile = normalizeValuationProfile(options);
  const query = buildQuery(card);
  const sourceNotes = [];
  let serp = null;
  let cardApi = null;
  let apify = null;
  let serpError = "";
  let cardApiError = "";
  let apifyError = "";

  // SerpApi and The Card API are independent primary sources. Starting both
  // together prevents one provider's latency from delaying the other.
  const primarySearches = [];
  if (env.SERPAPI_KEY) {
    primarySearches.push({
      key: "serp",
      promise: searchSerpApi(card, query, env.SERPAPI_KEY, fastMode, profile),
    });
  }
  if (env.CARD_API_KEY) {
    primarySearches.push({
      key: "cardApi",
      promise: searchCardApiEbaySold(card, env.CARD_API_KEY, profile),
    });
  }

  const primarySettled = await Promise.allSettled(primarySearches.map(source => source.promise));
  primarySettled.forEach((entry, index) => {
    const key = primarySearches[index].key;
    if (entry.status === "fulfilled") {
      if (key === "serp") serp = entry.value;
      else cardApi = entry.value;
      return;
    }
    const message = entry.reason?.message || "search failed.";
    if (key === "serp") {
      serpError = message;
      sourceNotes.push(`SerpApi was unavailable: ${message}`);
    } else {
      cardApiError = message;
      sourceNotes.push(`The Card API was unavailable: ${message}`);
    }
  });

  const primaryResults = [serp, cardApi].filter(Boolean);
  const primaryItems = dedupeSoldComps(primaryResults.flatMap(result => result.matchedItems || []));
  const primaryEvaluation = evaluateComparableResults(primaryItems, card);
  const evidenceAvailableBeforeApify = profile.targetEnrichment
    ? Math.max(primaryEvaluation.cleaned.length, profile.fallbackEvidenceCount)
    : primaryEvaluation.cleaned.length;

  // Fast Mode can stop with two clean exact-card comps across the primary
  // sources. Deep mode keeps the stronger four-comp threshold before Apify.
  const needsApify = Boolean(env.APIFY_TOKEN) && (
    fastMode
      ? (evidenceAvailableBeforeApify < 2 || (primaryEvaluation.confidence === "insufficient" && profile.fallbackEvidenceCount < 2))
      : (primaryEvaluation.cleaned.length < 4 || primaryEvaluation.confidence === "low" || primaryEvaluation.confidence === "insufficient")
  );

  if (needsApify) {
    try {
      apify = await searchApify(card, query, env.APIFY_TOKEN, fastMode, env.CARD_API_KEY || "");
    } catch (err) {
      apifyError = err?.message || "Apify search failed.";
      sourceNotes.push(`Apify tertiary backup was unavailable: ${apifyError} Scout kept usable primary-source evidence.`);
    }
  }

  const availableResults = [serp, cardApi, apify].filter(Boolean);
  if (!availableResults.length) {
    const parts = [];
    if (serpError) parts.push(`SerpApi: ${serpError}`);
    if (cardApiError) parts.push(`The Card API: ${cardApiError}`);
    if (apifyError) parts.push(`Apify: ${apifyError}`);
    throw new Error(parts.length ? `All sold-comps sources failed. ${parts.join(" ")}` : "No sold-comps source is available.");
  }

  const combinedItems = dedupeSoldComps(availableResults.flatMap(result => result.matchedItems || []));
  const combinedEvaluation = evaluateComparableResults(combinedItems, card);
  const providerNames = [];
  if (serp) providerNames.push("SerpApi");
  if (cardApi) providerNames.push("The Card API");
  if (apify) providerNames.push("Apify");
  let provider = `eBay sold results via ${providerNames.join(" + ")}`;
  if (apify?.bestOfferRecovered > 0) provider += " + Best Offer recovery";

  const combinedNotes = uniqueStrings([
    ...availableResults.flatMap(result => result.notes || []),
    ...sourceNotes,
    needsApify && apify ? "Scout used Apify only as a tertiary backup because the combined primary-source evidence was still weak." : "",
    fastMode && !profile.targetEnrichment && !needsApify && combinedEvaluation.cleaned.length < 4
      ? "Fast Mode returned after the primary sources produced at least two clean exact-card comps; Deep Mode can seek more evidence."
      : "",
    profile.targetEnrichment && combinedEvaluation.cleaned.length < profile.evidenceGoal
      ? `Target enrichment finished with ${combinedEvaluation.cleaned.length} clean exact-card comp${combinedEvaluation.cleaned.length === 1 ? "" : "s"}; Scout kept the existing confidence standard.`
      : "",
  ]);
  const searchModes = availableResults.map(result => result.searchMode).filter(Boolean).join(" + ");

  return finalizeValuation(card, query, combinedEvaluation.matchedItems, {
    provider,
    searchMode: searchModes,
    matchMode: combinedEvaluation.matchMode,
    searched: availableResults.reduce((sum, result) => sum + Number(result.searched || 0), 0),
    matched: combinedEvaluation.matchedItems.length,
    notes: combinedNotes,
    mode: fastMode ? "fast" : "deep",
    bestOfferRecovered: apify?.bestOfferRecovered || 0,
    bestOfferRecoveryAttempted: apify?.bestOfferRecoveryAttempted || 0,
  });
}



function targetDealClamp(v,min,max){return Math.max(min,Math.min(max,v))}
function targetDealStep(v){
  if(v<10)return .25;
  if(v<25)return .50;
  if(v<100)return 1;
  if(v<250)return 2;
  if(v<1000)return 5;
  return 10;
}
function targetDealRound(v){
  if(!Number.isFinite(v))return null;
  const step=targetDealStep(v);
  return Math.round(v/step)*step;
}
function targetSmartBuyTargets(data){
  const median=Number(data?.median);
  if(!Number.isFinite(median)||median<=0)return null;

  const market=data?.confidenceLab?.market||{};
  const score=Number.isFinite(Number(market.score))?Number(market.score):Number(data?.confidenceScore||50);
  const conf=targetDealClamp(score/100,0,1);
  const spreadRaw=Number(market?.components?.priceConsistency?.iqrToMedian);
  const low=Number(data?.low),high=Number(data?.high);
  const fallbackSpread=Number.isFinite(low)&&Number.isFinite(high)&&median>0?(high-low)/median:.60;
  const spread=targetDealClamp(Number.isFinite(spreadRaw)?spreadRaw:fallbackSpread,0,1.5);
  const spreadForBuffer=Math.min(spread,1);

  const greatDiscount=targetDealClamp(.12+.12*(1-conf)+.08*spreadForBuffer,.14,.32);
  const ceilingDiscount=targetDealClamp(.02+.08*(1-conf)+.05*spreadForBuffer,.04,.18);
  const walkPremium=targetDealClamp(.08*conf-.05*spreadForBuffer,-.03,.06);

  let greatRaw=median*(1-greatDiscount);
  if(Number.isFinite(low)&&low>0&&low<greatRaw){
    const softenedLow=low*1.02;
    greatRaw=(greatRaw*.75)+(softenedLow*.25);
  }
  greatRaw=Math.max(greatRaw,median*.68);

  const ceilingRaw=median*(1-ceilingDiscount);
  let walkRaw=median*(1+walkPremium);
  if(Number.isFinite(high)&&high>0)walkRaw=Math.min(walkRaw,high*1.02);

  let greatBuy=targetDealRound(greatRaw);
  let buyCeiling=targetDealRound(ceilingRaw);
  let walkAway=targetDealRound(walkRaw);

  if(buyCeiling<=greatBuy)buyCeiling=greatBuy+targetDealStep(greatBuy);
  if(walkAway<=buyCeiling)walkAway=buyCeiling+targetDealStep(buyCeiling);

  return {median,greatBuy,buyCeiling,walkAway,confidenceScore:score};
}
function targetPriceVerdict(delivered,targets){
  const total=Number(delivered);
  if(!targets||!Number.isFinite(total)||total<=0){
    return {tier:"market_check",label:"MARKET CHECK",message:"Scout likes the target, but does not have enough pricing evidence to judge this listing."};
  }
  if(total<=targets.greatBuy)return {tier:"great_buy",label:"GREAT BUY",message:"This listing is at or below Scout's Great Buy price."};
  if(total<=targets.buyCeiling)return {tier:"buy",label:"BUY",message:"This listing is below Scout's Buy Ceiling."};
  if(total<=targets.median)return {tier:"fair",label:"FAIR PRICE",message:"The listing is reasonable, but it is not a bargain."};
  if(total<=targets.walkAway)return {tier:"negotiate",label:"NEGOTIATE",message:"Scout likes the card, but would try for a lower price."};
  return {tier:"pass",label:"PASS",message:"Good target, bad price. Scout would wait for another copy."};
}
function targetRecommendationCanonicalSet(suggestion) {
  const verifiedSet = String(suggestion?.traits?.rookieVerification?.set || "").trim();
  if (verifiedSet) return verifiedSet;

  const parsed = monthlyPickSet(suggestion?.title || "");
  if (parsed) return parsed;

  return String(suggestion?.set || "").trim();
}

function sanitizePricingDiagnosticText(value, maxLength=280) {
  let text = String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  text = text
    .replace(/https?:\/\/[^\s)\]}]+/gi, "[redacted URL]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/((?:api[_\s-]?key|access[_\s-]?token|token|authorization|x-scout-key|x-market-api-key)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:api_key|access_token|token|key)=)[^&\s]+/gi, "$1[redacted]");
  return text.slice(0, maxLength);
}

function pricingDiagnosticCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function targetPricingEvidenceDetails(live={}, targetEnrichmentAttempted=false) {
  const notes = uniqueStrings((Array.isArray(live?.notes) ? live.notes : [])
    .map(note => sanitizePricingDiagnosticText(note))
    .filter(Boolean))
    .slice(0, 8);
  return {
    providers: sanitizePricingDiagnosticText(live?.provider),
    searchModes: sanitizePricingDiagnosticText(live?.searchMode),
    listingsSearched: pricingDiagnosticCount(live?.searched),
    exactMatches: pricingDiagnosticCount(live?.matched),
    soldCompsUsed: pricingDiagnosticCount(live?.used),
    cacheHit: live?.cacheHit === true,
    staleFallback: live?.staleCacheFallback === true,
    targetEnrichmentAttempted: targetEnrichmentAttempted === true,
    notes,
  };
}

function targetEnrichmentWasAttempted(live) {
  const strongFreshCache = live?.cacheHit === true &&
    live?.staleCacheFallback !== true &&
    live?.targetEnrichmentFallback !== true &&
    valuationEvidenceCount(live) >= TARGET_EVIDENCE_GOAL;
  return !strongFreshCache;
}

async function targetRecommendationMarketCheck(suggestion,player,env){
  const delivered=Number(suggestion?.delivered);
  const year=Number(suggestion?.year);
  const set=targetRecommendationCanonicalSet(suggestion);
  const cardNum=String(suggestion?.cardNum||"").trim();

  if(!Number.isFinite(delivered)||delivered<=0){
    return {
      version:TARGET_MARKET_CHECK_VERSION,
      rated:false,tier:"market_check",label:"MARKET CHECK",
      pricingEvidence:targetPricingEvidenceDetails({},false),
      reason:"Delivered listing price is unavailable."
    };
  }
  if(!Number.isInteger(year)||!set){
    return {
      version:TARGET_MARKET_CHECK_VERSION,
      rated:false,tier:"market_check",label:"MARKET CHECK",delivered,
      pricingEvidence:targetPricingEvidenceDetails({},false),
      reason:"Scout likes the target, but the listing identity is not specific enough for a trustworthy sold-comps price check."
    };
  }

  const gradeInfo=suggestion?.gradeInfo||{};
  const traits=suggestion?.traits||{};
  const card={
    year,set,player,cardNum,
    grader:gradeInfo?.grader||"Raw",
    grade:gradeInfo?.grade??"",
    autograph:!!traits.autograph,
    relic:false,
    serial:"",
    shopPrice:delivered,
    notes:"",
    fastMode:true
  };

  try{
    const live=await getValuationWithCache(card,env,true,null,{
      evidenceGoal:TARGET_EVIDENCE_GOAL,
      targetEnrichment:true,
      extraWaitMs:TARGET_ENRICHMENT_WAIT_MS
    });

    const used=Number(live?.used||0);
    const confidence=String(live?.confidence||"insufficient");
    const median=Number(live?.median);
    const pricingEvidence=targetPricingEvidenceDetails(live,targetEnrichmentWasAttempted(live));

    if(used<2||confidence==="insufficient"||!Number.isFinite(median)||median<=0){
      return {
        version:TARGET_MARKET_CHECK_VERSION,
        rated:false,tier:"market_check",label:"MARKET CHECK",delivered,used,confidence,
        confidenceScore:Number(live?.confidenceScore||0),
        median:Number.isFinite(median)?median:null,
        low:Number.isFinite(Number(live?.low))?Number(live.low):null,
        high:Number.isFinite(Number(live?.high))?Number(live.high):null,
        pricingIdentity:{year,set,player,cardNum},
        pricingEvidence,
        reason:"Scout likes the target, but there are not enough reliable sold comps to call this listing a bargain or a pass."
      };
    }

    const targets=targetSmartBuyTargets(live);
    const verdict=targetPriceVerdict(delivered,targets);
    return {
      version:TARGET_MARKET_CHECK_VERSION,
      rated:true,...verdict,delivered,
      median:Number(live.median),
      low:Number(live.low),
      high:Number(live.high),
      used,
      confidence,
      confidenceScore:Number(live.confidenceScore||0),
      greatBuy:targets?.greatBuy??null,
      buyCeiling:targets?.buyCeiling??null,
      walkAway:targets?.walkAway??null,
      provider:live.provider||"",
      pricingIdentity:{year,set,player,cardNum},
      pricingEvidence,
      checkedAt:live.checkedAt||new Date().toISOString(),
      reason:verdict.message
    };
  }catch(err){
    const safeError=sanitizePricingDiagnosticText(err?.message||err||"Live sold sources were unavailable.");
    return {
      version:TARGET_MARKET_CHECK_VERSION,
      rated:false,tier:"market_check",label:"MARKET CHECK",delivered,
      pricingIdentity:{year,set,player,cardNum},
      pricingEvidence:targetPricingEvidenceDetails({
        notes:[safeError||"Live sold sources were unavailable."]
      },true),
      reason:"Scout found a target, but the sold-comps price check could not be completed for this listing.",
      error:safeError
    };
  }
}

function validateDealTargets(t) {
  const supplied = t && typeof t === "object" &&
    ["greatBuy","buyCeiling","walkAway"].some(k => t[k] !== undefined && t[k] !== null && t[k] !== "");
  if (!supplied) {
    return { ok: true, targets: null, rated: false };
  }

  const greatBuy = Number(t?.greatBuy);
  const buyCeiling = Number(t?.buyCeiling);
  const walkAway = Number(t?.walkAway);
  if (![greatBuy, buyCeiling, walkAway].every(v => Number.isFinite(v) && v > 0)) {
    return { ok: false, message: "Deal Finder received incomplete Smart Buy Targets." };
  }
  if (!(greatBuy < buyCeiling && buyCeiling <= walkAway)) {
    return { ok: false, message: "Deal Finder target prices must be ordered Great Buy < Buy Ceiling ≤ Walk-Away." };
  }
  return { ok: true, targets: { greatBuy, buyCeiling, walkAway }, rated: true };
}

function extractActiveShipping(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object") {
    if (Number.isFinite(Number(value.extracted))) return Number(value.extracted);
    if (value.raw != null) return extractActiveShipping(value.raw);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/\bfree\b/i.test(text)) return 0;
  const parsed = parseMoney(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function activeBuyingFormat(r) {
  const pieces = [
    r?.buying_format,
    r?.buying_format_text,
    r?.buying_options?.text,
    r?.format
  ].flat().filter(Boolean).map(String).join(" ").toLowerCase();

  if (/auction/.test(pieces) || r?.bids) return "auction";
  if (/offer/.test(pieces)) return "buy_it_now_offer";
  return "buy_it_now";
}

function normalizeActiveEbayResult(r) {
  if (!r || !r.title) return null;
  const price = extractPrice(r.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const shipping = extractActiveShipping(r.shipping);
  const seller = r.seller && typeof r.seller === "object" ? r.seller : {};
  const format = activeBuyingFormat(r);
  const bids = r.bids && typeof r.bids === "object" ? r.bids : {};

  return {
    id: String(r.product_id || r.epid || r.link || r.title),
    productId: String(r.product_id || ""),
    title: String(r.title),
    price,
    shipping,
    delivered: Number.isFinite(shipping) ? price + shipping : null,
    condition: String(r.condition || ""),
    link: String(r.link || ""),
    thumbnail: String(r.thumbnail || ""),
    seller: {
      username: String(seller.username || ""),
      reviews: Number.isFinite(Number(seller.reviews)) ? Number(seller.reviews) : null,
      positivePct: Number.isFinite(Number(seller.positive_feedback_in_percentage))
        ? Number(seller.positive_feedback_in_percentage)
        : null,
    },
    format,
    acceptsOffers: format === "buy_it_now_offer" || /offer/i.test(String(r.buying_format_text || "")),
    bidCount: Number.isFinite(Number(bids.count)) ? Number(bids.count) : null,
    timeLeft: String(bids.time_left || bids.timeLeft || r.time_left || ""),
    sponsored: Boolean(r.sponsored),
    source: "SerpApi",
  };
}

function activeDealMismatchReason(item, card) {
  const title = normalizeText(item.title);
  const rawTitle = String(item.title || "").toLowerCase();
  const year = String(card.year);

  if (!title.includes(year)) return "Wrong or missing card year.";

  const names = normalizeText(card.player).split(" ").filter(Boolean);
  const last = names[names.length - 1];
  if (last && !title.includes(last)) return "Player name does not match the target.";

  const setTokens = meaningfulTokens(card.set);
  if (setTokens.length && setTokens.filter(t => title.includes(t)).length < Math.min(setTokens.length, 2)) {
    return "Set does not match the target closely enough.";
  }

  if (card.cardNum && !cardNumberMatches(rawTitle, String(card.cardNum), false)) {
    return "Card number does not match the target.";
  }

  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  const gradingWords = /\b(psa|sgc|bgs|beckett|cgc|csg|bccg|gma|tag)\b/i;
  if (grader && grader !== "Raw") {
    if (!graderRegex(grader).test(rawTitle)) return `Wrong grading company — target is ${grader}.`;
    if (grade && !gradeMatches(rawTitle, grade, grader, false)) return `Grade does not match target ${grader} ${grade}.`;
  } else if (grader === "Raw" && gradingWords.test(rawTitle)) {
    return "Graded listing does not match a Raw target.";
  }

  const autoRx = /\b(auto(?:graph)?|autographed|signed)\b/i;
  if (card.autograph ? !autoRx.test(rawTitle) : autoRx.test(rawTitle)) {
    return card.autograph ? "Target is autographed but listing does not say autograph." : "Autographed version does not match the target.";
  }

  const relicRx = /\b(relic|memorabilia|jersey|patch|game[ -]?used|bat piece|piece of bat)\b/i;
  if (card.relic ? !relicRx.test(rawTitle) : relicRx.test(rawTitle)) {
    return card.relic ? "Target is a relic but listing does not say relic/memorabilia." : "Relic/memorabilia version does not match the target.";
  }

  const denom = serialDenominator(card.serial);
  if (denom && !new RegExp(`\\/\\s*${escapeRegExp(denom)}\\b`).test(rawTitle)) {
    return `Serial-number denominator does not match /${denom}.`;
  }

  if (/\bbonus\s+cards?\b|\+\s*(?:bonus\s+)?cards?\b|\bwith\s+extra\s+cards?\b/i.test(rawTitle)) {
    return "Multi-card / bonus-card listing — Scout is hunting one exact card.";
  }
  if (looksLikeLot(rawTitle)) return "Multi-card lot / set / You Pick listing.";
  if (isObviousNonTradingCardListing(rawTitle)) {
    return "Listing is not the single physical card Scout is hunting.";
  }

  const setText = String(card.set || "").toLowerCase();
  const allowReprint = /archives|reprint/.test(setText) || /reprint/i.test(String(card.notes || ""));
  if (!allowReprint && /\b(reprint|replica|facsimile|custom card)\b/i.test(rawTitle)) {
    return "Reprint / replica / custom card does not match the original target.";
  }

  if (!Number.isFinite(item.shipping)) {
    return "Shipping cost is unclear, so Scout cannot calculate a trustworthy delivered price.";
  }

  return "";
}


function monthlyPickYear(title) {
  const years = String(title || "").match(/\b(?:18|19|20)\d{2}\b/g) || [];
  const currentYear = new Date().getUTCFullYear() + 1;
  for (const y of years) {
    const n = Number(y);
    if (n >= 1860 && n <= currentYear) return n;
  }
  return null;
}

function monthlyPickPlayerMatches(title, player) {
  const titleTokens = normalizeText(title).split(" ").filter(Boolean);
  const playerTokens = normalizeText(player).split(" ").filter(Boolean)
    .filter(t => !["jr", "sr", "ii", "iii", "iv"].includes(t));
  if (!playerTokens.length) return false;
  const required = playerTokens.length === 1
    ? playerTokens
    : [playerTokens[0], playerTokens[playerTokens.length - 1]];
  return required.every(t => titleTokens.includes(t));
}

const SCOUT_VERIFIED_ROOKIE_KNOWLEDGE = {
  "buster posey": {
    rookieYear: 2010,
    cards: [
      {
        year: 2010,
        cardNum: "294",
        set: "Topps Allen & Ginter",
        titlePattern: /\ballen\s*(?:&|and)\s*ginter\b/i,
        label: "2010 Topps Allen & Ginter #294",
        verification: "PSA CardFacts + Beckett"
      },
      {
        year: 2010,
        cardNum: "2",
        set: "Topps",
        titlePattern: /\btopps\b/i,
        rejectPattern: /\b(opening day|heritage|chrome|206|national chicle|allen\s*(?:&|and)\s*ginter)\b/i,
        label: "2010 Topps #2",
        verification: "PSA CardFacts + Beckett"
      }
    ]
  }
};

function monthlyPickVerifiedRookieKnowledge(player, title, year, cardNum) {
  const playerKey = normalizeText(player);
  const knowledge = SCOUT_VERIFIED_ROOKIE_KNOWLEDGE[playerKey];
  if (!knowledge) return { verified: false, rookieYear: null, card: null };

  const raw = String(title || "");
  const number = normalizeText(cardNum).replace(/\s+/g, "");
  const card = knowledge.cards.find(rule => {
    if (Number(rule.year) !== Number(year)) return false;
    if (rule.cardNum && normalizeText(rule.cardNum).replace(/\s+/g, "") !== number) return false;
    if (rule.titlePattern && !rule.titlePattern.test(raw)) return false;
    if (rule.rejectPattern && rule.rejectPattern.test(raw)) return false;
    return true;
  }) || null;

  return {
    verified: !!card,
    rookieYear: Number(knowledge.rookieYear) || null,
    card
  };
}

function monthlyPickApplyCardKnowledge(player, title, year, cardNum, traits) {
  const knowledge = monthlyPickVerifiedRookieKnowledge(player, title, year, cardNum);
  const raw = String(title || "");
  const prospectClaimed = /\b(prospect|draft(?:ed|\s+pick)?|minor\s+league|pre[-\s]?rookie)\b/i.test(raw);

  return {
    ...traits,
    rookieVerified: knowledge.verified,
    rookie: knowledge.verified,
    rookieVerification: knowledge.card ? {
      label: knowledge.card.label,
      source: knowledge.card.verification,
      set: knowledge.card.set || ""
    } : null,
    knownRookieYear: knowledge.rookieYear,
    prospectClaimed
  };
}

function monthlyPickEraInfo(year, traits, futureHof = false) {
  if (traits?.rookieVerified) {
    return {
      type: "verified_rookie",
      label: "VERIFIED ROOKIE",
      rookieYear: traits.knownRookieYear || year,
      verified: true
    };
  }

  const knownRookieYear = Number(traits?.knownRookieYear);
  if (futureHof && Number.isFinite(knownRookieYear) && Number(year) < knownRookieYear) {
    return {
      type: "pre_rookie_era",
      label: "EARLIER PRE-ROOKIE ERA",
      rookieYear: knownRookieYear,
      verified: true
    };
  }

  if (futureHof && traits?.prospectClaimed) {
    return {
      type: "prospect_claim",
      label: "PROSPECT / PRE-ROOKIE CLAIM",
      rookieYear: Number.isFinite(knownRookieYear) ? knownRookieYear : null,
      verified: false
    };
  }

  return null;
}

function monthlyPickTraits(title) {
  const raw = String(title || "");
  const graded = /\b(PSA|SGC|CGC|BGS|BVG|CSG|GMA|HGA|ISA)\s*(?:\d+(?:\.\d+)?|AUTHENTIC)\b|\bgraded\b|\bslab\b/i.test(raw);
  const autograph = /\b(auto(?:graph(?:ed)?)?|signed)\b/i.test(raw);
  const shortPrint = /\b(?:SP|SSP|short\s*print|super\s*short\s*print)\b|(?:^|\s)\d{1,4}\s*\/\s*\d{1,4}(?:\s|$)/i.test(raw);

  // Seller wording such as "Rookie" or "RC" is a discovery clue, not proof.
  // Until Scout has independent rookie-card metadata for a player/card,
  // never award a rookie badge or ranking/upgrade bonus from title claims alone.
  const rookieClaimed = /\brookie\b|\bRC\b/i.test(raw);
  const rookieVerified = false;
  const rookie = rookieVerified;

  return { graded, autograph, shortPrint, rookie, rookieClaimed, rookieVerified };
}

function monthlyPickCardNumber(title) {
  const m = String(title || "").match(/#\s*([A-Z0-9-]{1,12})\b/i);
  return m ? m[1] : "";
}


function monthlyPickSet(title) {
  const raw = String(title || "");

  // Specific products first. Seller titles often insert punctuation
  // ("Topps - Allen & Ginter's"), so do not depend on whitespace-only matches.
  const specific = [
    { rx: /\btopps\b[\s\-–—:]*\ballen\s*(?:&|and)\s*ginter(?:'s)?\b/i, set: "Topps Allen & Ginter" },
    { rx: /\ballen\s*(?:&|and)\s*ginter(?:'s)?\b/i, set: "Topps Allen & Ginter" },
    { rx: /\btopps\b[\s\-–—:]*\bopening\s+day\b/i, set: "Topps Opening Day" },
    { rx: /\btopps\b[\s\-–—:]*\bheritage\b/i, set: "Topps Heritage" },
    { rx: /\btopps\b[\s\-–—:]*\bchrome\b/i, set: "Topps Chrome" },
    { rx: /\btopps\b[\s\-–—:]*\bupdate\b/i, set: "Topps Update" },
    { rx: /\bbowman\b[\s\-–—:]*\bchrome\b[\s\-–—:]*\bdraft\b/i, set: "Bowman Chrome Draft" },
    { rx: /\bbowman\b[\s\-–—:]*\bdraft\b/i, set: "Bowman Draft" },
    { rx: /\bbowman\b[\s\-–—:]*\bchrome\b/i, set: "Bowman Chrome" },
    { rx: /\bbowman\b[\s\-–—:]*\bplatinum\b/i, set: "Bowman Platinum" },
    { rx: /\btristar\b[\s\-–—:]*\bprospects?\s+plus\b/i, set: "TriStar Prospects Plus" },
    { rx: /\btopps\b[\s\-–—:]*\b206\b/i, set: "Topps 206" },
    { rx: /\btopps\b[\s\-–—:]*\bnational\s+chicle\b/i, set: "Topps National Chicle" },
  ];
  const hit = specific.find(x => x.rx.test(raw));
  if (hit) return hit.set;

  const known = [
    "Topps", "Fleer", "Bowman", "Donruss", "Upper Deck", "Score", "Leaf",
    "Panini", "Goudey", "Play Ball", "Finest", "Heritage", "Chrome", "TriStar"
  ];
  return known.find(x => new RegExp(`\\b${x.replace(/\s+/g, "\\s+")}\\b`, "i").test(raw)) || "";
}

function monthlyPickGradeInfo(title) {
  const raw = String(title || "");
  const m = raw.match(/\b(PSA|SGC|CGC|BGS|BVG|CSG|GMA|HGA|ISA)\s*(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1|AUTHENTIC)\b/i);
  if (!m) return { grader: "Raw", grade: null, label: "Raw" };
  const grader = m[1].toUpperCase();
  const grade = m[2].toUpperCase() === "AUTHENTIC" ? null : Number(m[2]);
  return { grader, grade, label: `${grader}${grade !== null ? " " + grade : " AUTHENTIC"}` };
}

function monthlyPickNumericGrade(v) {
  if (v === null || v === undefined || v === "") return null;
  const direct = Number(v);
  if (Number.isFinite(direct) && direct >= 1 && direct <= 10) return direct;
  const m = String(v).match(/(?:^|\s)(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1)(?:\s|$)/);
  return m ? Number(m[1]) : null;
}


function monthlyPickNormalizeCardNum(v) {
  return String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function monthlyPickSameCard(candidate, currentCard) {
  const currentSet = normalizeText(currentCard?.set || "");
  const candidateSet = normalizeText(candidate?.set || "");
  const currentNum = monthlyPickNormalizeCardNum(currentCard?.cardNum);
  const candidateNum = monthlyPickNormalizeCardNum(candidate?.cardNum);

  const sameSet = currentSet && candidateSet && (
    currentSet === candidateSet ||
    currentSet.includes(candidateSet) ||
    candidateSet.includes(currentSet)
  );
  const sameNum = currentNum && candidateNum && currentNum === candidateNum;

  return !!(sameSet && sameNum);
}

function monthlyPickCurrentLikelyRookie(currentCard) {
  // Reserved hook for future independently verified rookie metadata.
  // Do not infer rookie status from collection notes, set names, or seller language.
  return false;
}

function monthlyPickCurrentTraits(currentCard) {
  const grader = String(currentCard?.grader || "Raw").trim();
  const grade = monthlyPickNumericGrade(currentCard?.grade) ?? monthlyPickNumericGrade(currentCard?.gradeCondition);
  const raw = `${currentCard?.description || ""} ${currentCard?.notes || ""}`;
  return {
    graded: !!grader && grader.toLowerCase() !== "raw",
    grader: grader || "Raw",
    grade,
    autograph: !!currentCard?.autograph || /\b(auto(?:graph(?:ed)?)?|signed)\b/i.test(raw),
    shortPrint: !!String(currentCard?.serial || "").trim() || /\b(?:SP|SSP|short\s*print|super\s*short\s*print)\b/i.test(raw),
    rookie: monthlyPickCurrentLikelyRookie(currentCard),
  };
}

function monthlyPickUpgradeAssessment({ raw, year, cardNum, set, traits, gradeInfo, currentCard }) {
  const currentYear = Number(currentCard?.cardYear || currentCard?.year);
  if (!Number.isFinite(currentYear) || currentYear <= 0) {
    return { qualifies: true, strength: 1, reason: "Scout could not determine your current card year, so this candidate needs your review." };
  }

  if (year < currentYear) {
    return {
      qualifies: true,
      strength: 1000 + Math.min(100, currentYear - year),
      reason: `${year} is older than your current ${currentYear} representative — Scout's strongest upgrade signal.`
    };
  }

  if (year > currentYear) {
    return { qualifies: false, strength: 0, reason: `Newer than your current ${currentYear} representative.` };
  }

  const cur = monthlyPickCurrentTraits(currentCard);
  const candidate = { set, cardNum };
  const sameCard = monthlyPickSameCard(candidate, currentCard);
  const reasons = [];
  let strength = 0;

  // Same exact card: higher numerical grade is a direct, unambiguous upgrade.
  if (sameCard && traits.graded && cur.graded &&
      gradeInfo.grade !== null && cur.grade !== null &&
      gradeInfo.grade > cur.grade) {
    const delta = gradeInfo.grade - cur.grade;
    strength += 180 + Math.round(delta * 25);
    reasons.push(`same card at a higher grade: ${cur.grader}${cur.grade !== null ? " " + cur.grade : ""} → ${gradeInfo.label}`);
  }

  // Same exact card: raw -> graded is also a meaningful upgrade.
  if (sameCard && !cur.graded && traits.graded) {
    strength += 130;
    reasons.push(`same card upgraded from raw to ${gradeInfo.label}`);
  }

  // A different card from the same year must be materially better, not merely different.
  // Do not let a raw alternate rookie beat an already graded current card.
  if (!sameCard) {
    if (!cur.graded && traits.graded) {
      strength += 70;
      reasons.push(`graded ${gradeInfo.label} versus your raw current card`);
    }

    if (traits.autograph && !cur.autograph) {
      strength += 50;
      reasons.push("autograph");
    }
    if (traits.shortPrint && !cur.shortPrint) {
      strength += 45;
      reasons.push("short print / numbered scarcity");
    }
  }

  if (!strength) {
    return {
      qualifies: false,
      strength: 0,
      reason: sameCard
        ? `Same card and year, but Scout did not find a higher grade or other meaningful improvement.`
        : `Same year as your current ${currentYear} card, but Scout did not find a meaningful improvement strong enough to replace your current representative.`
    };
  }

  return {
    qualifies: true,
    strength,
    sameCard,
    reason: `Same-year upgrade: ${reasons.join("; ")}.`
  };
}

function monthlyPickConditionInfo(item) {
  const title = String(item?.title || "");
  const listed = String(item?.condition || "");
  const text = `${title} ${listed}`;
  const slab = monthlyPickGradeInfo(title);

  const hardPassPatterns = [
    /\bpoor\s+(?:condition|shape)\b/i,
    /\bcondition\s*:\s*poor\b/i,
    /\bdamaged\b/i,
    /\bheav(?:y|ily)\s+creas(?:e|ed|ing)\b/i,
    /\bmultiple\s+creases\b/i,
    /\baltered\b/i,
    /\btrimmed\b/i,
    /\bwater\s+damage\b/i,
    /\btorn\b/i,
    /\bpaper\s+loss\b/i
  ];
  for (const rx of hardPassPatterns) {
    if (rx.test(text)) {
      return { ok: false, score: 0, label: "PASS", reason: "Condition is too compromised for a Scout recommendation." };
    }
  }

  if (/^\s*poor\s*$/i.test(listed) || /\b(?:condition|cond)\s*[-:]\s*poor\b/i.test(title) || /\bpoor\s*$/i.test(title)) {
    return { ok: false, score: 0, label: "PASS", reason: "Listing is described as Poor condition." };
  }

  let score = 50;
  let label = listed || "Condition not stated";

  const titleConditionChecks = [
    { rx: /\bgem[\s-]*(?:mint|mt)\b/i, label: "Gem Mint", score: 100 },
    { rx: /\bnm[\s\/-]*mt\b|\bnear[\s-]*mint\b/i, label: "NM-MT", score: 94 },
    { rx: /\bnm\b/i, label: "NM", score: 90 },
    { rx: /\bex[\s\/-]*mt\b|\bexcellent[\s-]*mint\b/i, label: "EX-MT", score: 84 },
    { rx: /\bvg[\s\/-]*ex\b|\bvery[\s-]*good[\s-]*excellent\b/i, label: "VG-EX", score: 68 },
    { rx: /\bgd[\s\/-]*vg\b|\bgood[\s-]*very[\s-]*good\b/i, label: "GD-VG", score: 52 },
    { rx: /\bfr[\s\/-]*gd\b|\bfair[\s-]*good\b/i, label: "FR-GD", score: 36 },
    { rx: /\bex\b|\bexcellent\b/i, label: "EX", score: 76 },
    { rx: /\bvg\b|\bvery[\s-]*good\b/i, label: "VG", score: 60 },
    { rx: /\bgd\b|\bgood\b/i, label: "GD", score: 45 },
    { rx: /\bfr\b|\bfair\b/i, label: "FR", score: 30 },
    { rx: /\bmint\b/i, label: "Mint", score: 98 },
  ];

  if (/\blow[-\s]*grade\b/i.test(title)) {
    score = 12;
    label = "Low grade";
  } else {
    const titleCondition = titleConditionChecks.find(x => x.rx.test(title));

    // For graded cards, slab grade is the primary condition display.
    // Collector wording in the title is appended when useful.
    if (slab.grader && slab.grader !== "Raw") {
      const slabScore = slab.grade !== null
        ? Math.max(55, Math.min(100, 50 + slab.grade * 5))
        : 70;
      score = titleCondition ? Math.max(slabScore, titleCondition.score) : slabScore;
      label = slab.label;
      if (titleCondition && !normalizeText(label).includes(normalizeText(titleCondition.label))) {
        label += ` · ${titleCondition.label}`;
      }
    } else if (titleCondition) {
      score = titleCondition.score;
      label = titleCondition.label;
    } else if (/\b(?:gem mint|mint)\b/i.test(listed)) { score = 100; label = listed || "Mint"; }
    else if (/\bnear mint\b|\bnm-mt\b|\bnm\b/i.test(listed)) { score = 92; label = listed || "Near Mint"; }
    else if (/\bexcellent[- ]mint\b|\bex-mt\b/i.test(listed)) { score = 84; label = listed || "EX-MT"; }
    else if (/\bexcellent\b|\bex\b/i.test(listed)) { score = 76; label = listed || "Excellent"; }
    else if (/\bvery good[- ]excellent\b|\bvg-ex\b|\bvgex\b/i.test(listed)) { score = 68; label = listed || "VG-EX"; }
    else if (/\bvery good\b|\bvg\b/i.test(listed)) { score = 60; label = listed || "Very Good"; }
    else if (/\bgood\b/i.test(listed)) { score = 45; label = listed || "Good"; }
    else if (/\bfair\b/i.test(listed)) { score = 30; label = listed || "Fair"; }
  }

  if (/\bcrease\b|\bcreased\b|\bcorner wear\b|\bsoft corners?\b|\bsurface wear\b/i.test(text)) {
    score = Math.min(score, 35);
    if (!/\blow[-\s]*grade\b/i.test(text) && !listed) label = "Visible wear";
  }

  let reason;
  if (/\blow[-\s]*grade\b/i.test(title)) {
    reason = "Listing is explicitly described as low grade; Scout keeps it eligible only as a lower-priority vintage option.";
  } else if (slab.grader && slab.grader !== "Raw") {
    reason = `Graded condition: ${label}.`;
  } else if (label && label !== listed && label !== "Condition not stated") {
    reason = `Collector condition found in listing title: ${label}.`;
  } else {
    reason = listed ? `Listed condition: ${listed}.` : "Condition was not clearly stated.";
  }

  return { ok: true, score, label, reason };
}

function monthlyPickSellerTrust(item, preferredSellers = []) {
  const seller = item?.seller || {};
  const username = String(seller.username || "").trim();
  const reviews = Number.isFinite(Number(seller.reviews)) ? Number(seller.reviews) : null;
  const positivePct = Number.isFinite(Number(seller.positivePct)) ? Number(seller.positivePct) : null;
  const preferredSet = new Set((preferredSellers || []).map(x => normalizeText(x)).filter(Boolean));
  const previousSeller = username && preferredSet.has(normalizeText(username));

  // A prior successful seller gets flexibility on feedback count, but not a truly bad rating.
  if (previousSeller) {
    if (positivePct !== null && positivePct < 95) {
      return {
        ok: false,
        reason: "Previously used seller, but current positive rating is below 95%.",
        previousSeller,
        username,
        reviews,
        positivePct,
        score: 0,
        label: "PASS"
      };
    }
    return {
      ok: true,
      reason: "You have bought from this seller before.",
      previousSeller,
      username,
      reviews,
      positivePct,
      score: 110 + Math.min(20, Math.log10(Math.max(1, reviews || 1)) * 5),
      label: "PREFERRED"
    };
  }

  // For an unfamiliar seller, Scout requires both a rating and a meaningful history.
  if (!username) {
    return { ok: false, reason: "Seller identity unavailable.", previousSeller: false, username, reviews, positivePct, score: 0, label: "PASS" };
  }
  if (reviews === null || reviews < 100) {
    return { ok: false, reason: "Seller has too little feedback history for a Scout recommendation.", previousSeller: false, username, reviews, positivePct, score: 0, label: "PASS" };
  }
  if (positivePct === null) {
    return { ok: false, reason: "Seller positive-feedback rating is unavailable.", previousSeller: false, username, reviews, positivePct, score: 0, label: "PASS" };
  }
  if (positivePct < 98) {
    return { ok: false, reason: "Seller positive-feedback rating is below Scout's 98% trust floor.", previousSeller: false, username, reviews, positivePct, score: 0, label: "PASS" };
  }

  let score = 60;
  let label = "GOOD";
  if (positivePct >= 99.8 && reviews >= 1000) { score = 100; label = "HIGH"; }
  else if (positivePct >= 99.5 && reviews >= 500) { score = 92; label = "HIGH"; }
  else if (positivePct >= 99.0 && reviews >= 250) { score = 82; label = "STRONG"; }
  else if (positivePct >= 98.5 && reviews >= 150) { score = 72; label = "GOOD"; }

  // Add a small volume bonus without letting volume overwhelm rating.
  score += Math.min(8, Math.max(0, Math.log10(Math.max(100, reviews)) - 2) * 4);

  return {
    ok: true,
    reason: `${positivePct.toFixed(1)}% positive with ${reviews.toLocaleString()} feedback.`,
    previousSeller: false,
    username,
    reviews,
    positivePct,
    score,
    label
  };
}

function monthlyPickRejectReason(item, player, budget, mode, currentCard, preferredSellers) {
  const raw = String(item.title || "");
  if (!monthlyPickPlayerMatches(raw, player)) return { reason: "Player name did not match." };
  if (item.format === "auction") return { reason: "Scout recommendations use directly buyable listings, not auctions." };
  if (!Number.isFinite(item.shipping) || !Number.isFinite(item.delivered)) return { reason: "Shipping was unclear." };
  if (item.delivered > budget) return { reason: "Over budget." };
  if (looksLikeLot(raw) || /\b(set|team set|complete set|you pick|choose|lot of|collection)\b/i.test(raw)) return { reason: "Multi-card / set listing." };
  if (isExplicitTeamCardListing(raw)) return { reason: "Team card / checklist listing." };
  if (isObviousNonTradingCardListing(raw)) return { reason: "Not a single physical card." };
  if (/\b(reprint|replica|facsimile|custom card|reissue|archives)\b/i.test(raw)) return { reason: "Reprint / replica / archive issue." };

  const year = monthlyPickYear(raw);
  if (!year) return { reason: "Card year could not be identified." };
  const cardNum = monthlyPickCardNumber(raw);
  const set = monthlyPickSet(raw);
  const traits = monthlyPickApplyCardKnowledge(player, raw, year, cardNum, monthlyPickTraits(raw));
  const gradeInfo = monthlyPickGradeInfo(raw);

  let upgrade = null;
  if (mode === "upgrade") {
    upgrade = monthlyPickUpgradeAssessment({
      raw,
      year,
      set,
      cardNum,
      traits,
      gradeInfo,
      currentCard
    });
    if (!upgrade.qualifies) return { reason: upgrade.reason, upgrade };
  }

  const conditionInfo = monthlyPickConditionInfo(item);
  if (!conditionInfo.ok) return { reason: conditionInfo.reason, conditionInfo, upgrade };

  const sellerTrust = monthlyPickSellerTrust(item, preferredSellers);
  if (!sellerTrust.ok) return { reason: sellerTrust.reason, sellerTrust, conditionInfo, upgrade };
  return { reason: "", sellerTrust, conditionInfo, upgrade, year, set, traits, gradeInfo, cardNum };
}

function monthlyPickTraitScore(traits) {
  // Age remains the primary collectible rule. These rank cards within the same year.
  // Only independently verified rookie status earns the rookie bonus.
  return (traits.rookieVerified ? 4 : 0) +
    (traits.graded ? 3 : 0) +
    (traits.autograph ? 2 : 0) +
    (traits.shortPrint ? 2 : 0);
}

function monthlyPickWhy(suggestion, mode, currentCard, budget, purpose = "monthly") {
  const traits = suggestion.traits || {};
  const extras = [];
  if (traits.rookieVerified) extras.push("verified rookie");
  if (traits.graded) extras.push(suggestion.gradeInfo?.label || "graded");
  if (traits.autograph) extras.push("autograph");
  if (traits.shortPrint) extras.push("short print / numbered");

  let line;
  if (mode === "upgrade") {
    line = suggestion.upgrade?.reason || `Scout found a meaningful upgrade from your current ${currentCard?.cardYear || currentCard?.year || ""} representative.`;
  } else {
    line = purpose === "target"
      ? "Scout prioritized the oldest trustworthy directly buyable target it found for this player."
      : "Scout prioritized the oldest trustworthy directly buyable card it found for this player.";
  }

  if (suggestion.sellerTrust?.previousSeller) {
    line += " This is a seller you have successfully bought from before.";
  } else if (suggestion.sellerTrust?.reason) {
    line += ` Seller check: ${suggestion.sellerTrust.reason}`;
  }
  if (extras.length && mode !== "upgrade") line += ` Bonus traits: ${extras.join(", ")}.`;
  if (suggestion.eraInfo?.type === "pre_rookie_era") {
    line += ` This card predates Scout's verified ${suggestion.eraInfo.rookieYear} rookie-year cards, so Scout treats it as an earlier pre-rookie-era issue rather than an MLB rookie card.`;
  } else if (suggestion.eraInfo?.type === "verified_rookie" && suggestion.traits?.rookieVerification?.source) {
    line += ` Rookie status independently verified by ${suggestion.traits.rookieVerification.source}.`;
  }
  line += ` Delivered price is within your $${Number(budget).toFixed(2)} ${purpose === "target" ? "target" : "monthly"} budget.`;
  return line;
}

async function searchMonthlyPickListing({ player, budget, mode, currentCard, excludeIds, preferredSellers, apiKey, purpose = "monthly", searchHint = "", futureHof = false }) {
  // Monthly Pick intentionally remains one active-market search.
  // Find a Target may use a more focused discovery query so popular players
  // are not overwhelmed by modern cards that cannot qualify as upgrades.
  const currentYear = Number(currentCard?.cardYear || currentCard?.year);
  const cleanedHint = String(searchHint || "")
    .replace(new RegExp(escapeRegExp(player), "ig"), " ")
    .replace(/\s+/g, " ")
    .trim();

  let queries;
  if (purpose === "target" && mode === "upgrade") {
    const curGrade = monthlyPickCurrentTraits(currentCard);
    const sameCardQuery = [player, currentYear, currentCard?.set, currentCard?.cardNum ? `#${currentCard.cardNum}` : "", curGrade.graded ? "graded" : "", "baseball card"]
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    if (cleanedHint) {
      queries = [
        `${player} ${cleanedHint} baseball card`,
        sameCardQuery
      ];
    } else if (curGrade.graded) {
      queries = [
        sameCardQuery,
        `${player} rookie baseball card`
      ];
    } else {
      queries = [
        `${player} rookie baseball card`,
        `${player} vintage baseball card`
      ];
    }
  } else if (purpose === "target" && mode === "need" && futureHof) {
    // Future HOF candidates can have meaningful prospect/pre-rookie issues that
    // predate their recognized MLB rookie cards. Search that era first.
    if (cleanedHint) {
      queries = [
        `${player} ${cleanedHint} baseball card`,
        `${player} prospect baseball card`
      ];
    } else {
      queries = [
        `${player} prospect baseball card`,
        `${player} rookie baseball card`
      ];
    }
  } else if (purpose === "target" && mode === "need") {
    // Need-player discovery should not drown in cheap modern/reprint-era listings.
    // Start with a saved target clue when present; otherwise search rookie-era first,
    // then broader vintage listings. Age-first ranking happens after these searches.
    if (cleanedHint) {
      queries = [
        `${player} ${cleanedHint} baseball card`,
        `${player} rookie baseball card`
      ];
    } else {
      queries = [
        `${player} rookie baseball card`,
        `${player} vintage baseball card`
      ];
    }
  } else {
    queries = [`${player} baseball card`];
  }

  queries = uniqueStrings(queries.map(q => q.replace(/\s+/g, " ").trim()).filter(Boolean)).slice(0, purpose === "target" ? 2 : 1);

  const excluded = new Set((excludeIds || []).map(String));
  const accepted = [];
  const rejected = [];
  let rawCount = 0;
  const usedQueries = [];

  for (const query of queries) {
    const data = await runActiveEbaySearch(query, apiKey);
    usedQueries.push(query);
    const raw = Array.isArray(data.organic_results) ? data.organic_results : [];
    rawCount += raw.length;
    const normalized = dedupe(raw.map(normalizeActiveEbayResult).filter(Boolean));

    for (const item of normalized) {
      if (excluded.has(String(item.id)) || (item.productId && excluded.has(String(item.productId)))) continue;

      const screening = monthlyPickRejectReason(item, player, budget, mode, currentCard, preferredSellers);
      if (screening.reason) {
        rejected.push({
          id: item.id,
          title: item.title,
          reason: screening.reason,
          seller: item.seller || null
        });
        continue;
      }

      const year = screening.year || monthlyPickYear(item.title);
      const cardNum = screening.cardNum || monthlyPickCardNumber(item.title);
      const traits = screening.traits || monthlyPickApplyCardKnowledge(player, item.title, year, cardNum, monthlyPickTraits(item.title));
      const gradeInfo = screening.gradeInfo || monthlyPickGradeInfo(item.title);
      accepted.push({
        ...item,
        year,
        set: screening.set || monthlyPickSet(item.title),
        cardNum,
        traits,
        eraInfo: monthlyPickEraInfo(year, traits, futureHof),
        gradeInfo,
        traitScore: monthlyPickTraitScore(traits),
        sellerTrust: screening.sellerTrust,
        conditionInfo: screening.conditionInfo || monthlyPickConditionInfo(item),
        upgrade: screening.upgrade || null,
        discoveryQuery: query,
      });
    }

    // If a saved-target hint produced good-condition qualifying choices, do not
    // burn a second provider search. But a rough/low-grade result is only a
    // fallback, so keep searching for a cleaner qualifying copy.
    if (accepted.length && cleanedHint) {
      const bestConditionScore = Math.max(...accepted.map(x => Number(x.conditionInfo?.score) || 0));
      if (bestConditionScore >= 45) break;
    }
  }

  // Dedupe across multiple discovery queries.
  const uniqueAccepted = dedupe(accepted);

  // Condition and seller risk are gates first. Among eligible listings:
  // 1) oldest year, 2) upgrade strength for owned players,
  // 3) better condition, 4) seller quality/history, 5) collectible traits, 6) delivered price.
  uniqueAccepted.sort((a, b) =>
    (a.year - b.year) ||
    (mode === "upgrade" ? ((b.upgrade?.strength || 0) - (a.upgrade?.strength || 0)) : 0) ||
    ((b.conditionInfo?.score || 0) - (a.conditionInfo?.score || 0)) ||
    ((b.sellerTrust?.score || 0) - (a.sellerTrust?.score || 0)) ||
    (b.traitScore - a.traitScore) ||
    (a.delivered - b.delivered)
  );

  const best = uniqueAccepted[0] || null;
  if (!best) {
    return {
      query: usedQueries.join(" | "),
      queries: usedQueries,
      searched: rawCount,
      eligible: 0,
      suggestion: null,
      alternatesAvailable: 0,
      checkedAt: new Date().toISOString(),
      message: `Scout did not find a trustworthy directly buyable ${mode === "upgrade" ? "upgrade for " : ""}${player} under $${Number(budget).toFixed(2)} in this search.`
    };
  }

  const lowConditionFallback = (Number(best.conditionInfo?.score) || 0) < 45;
  const suggestion = {
    id: best.id,
    productId: best.productId,
    title: best.title,
    year: best.year,
    set: best.set,
    cardNum: best.cardNum,
    gradeInfo: best.gradeInfo,
    upgrade: best.upgrade,
    price: best.price,
    shipping: best.shipping,
    delivered: best.delivered,
    condition: best.condition,
    link: best.link,
    thumbnail: best.thumbnail,
    seller: best.seller,
    sellerTrust: best.sellerTrust,
    conditionInfo: best.conditionInfo,
    acceptsOffers: best.acceptsOffers,
    traits: best.traits,
    eraInfo: best.eraInfo || null,
    discoveryQuery: best.discoveryQuery,
    lowConditionFallback,
  };
  suggestion.why = monthlyPickWhy(suggestion, mode, currentCard, budget, purpose);
  if (lowConditionFallback) {
    suggestion.why += " Condition warning: this is a lower-condition fallback. Scout checked its available focused searches and did not find a cleaner qualifying option within the current budget.";
  }

  return {
    query: usedQueries.join(" | "),
    queries: usedQueries,
    searched: rawCount,
    eligible: uniqueAccepted.length,
    suggestion,
    alternatesAvailable: Math.max(0, uniqueAccepted.length - 1),
    checkedAt: new Date().toISOString(),
    notes: [
      purpose === "target" ? "Find a Target uses focused active eBay discovery queries for upgrade hunts." : "Monthly Pick uses one active eBay search per recommendation attempt.",
      purpose === "target" && cleanedHint ? "Scout used your existing saved target as a discovery clue before falling back to rookie-era listings." : "",
      purpose === "target" && !cleanedHint && mode === "upgrade" ? "Without a saved target clue, Scout searches rookie-era and vintage listings instead of a generic modern-heavy result pool." : "",
      purpose === "target" && mode === "need" && futureHof ? "Future HOF target searches check prospect/pre-rookie listings before recognized rookie-era listings." : "",
      purpose === "target" && mode === "need" && !futureHof ? "Need-player searches use rookie-era and vintage discovery instead of a generic modern-heavy result pool." : "",
      "The word Rookie/RC in an eBay title is only a discovery clue unless Scout's independent card knowledge verifies the exact card.",
      "Independently verified rookie cards may earn a verified-rookie badge and same-year trait bonus; an earlier issue still ranks ahead because age remains primary.",
      "Listings described as Poor, Damaged, heavily creased, altered, trimmed, torn, water-damaged, or with paper loss are rejected.",
      "Listings explicitly described as Low Grade remain eligible for vintage collecting, but receive a major condition penalty so cleaner same-year copies rank ahead of them.",
      "A low-grade result does not stop Find a Target's focused discovery early; Scout checks its fallback search for a cleaner qualifying copy before settling for rough condition.",
      "Unfamiliar sellers normally need at least 100 feedback and 98% positive feedback.",
      "A seller you have successfully bought from before is treated as preferred, unless the current rating is materially poor.",
      "Collector-style title conditions such as GD-VG, VG-EX, EX-MT, and NM override generic marketplace labels such as Pre-Owned.",
      "For graded cards, Scout displays the slab company and numerical grade first, with collector condition wording appended when present.",
      "After the condition and seller trust gates, age is ranked first; condition only breaks otherwise comparable choices.",
      "For an owned player, an older card qualifies automatically.",
      "For same-year upgrades, the same card at a higher numerical grade is a direct upgrade; seller rookie claims do not count as upgrade evidence.",
      purpose === "target" ? "Try Another keeps the same player and excludes the prior listing." : "Try Another keeps the same monthly Hall of Famer and excludes the prior listing."
    ].filter(Boolean)
  };
}

function activeDealVerdict(total, targets) {
  if (total <= targets.greatBuy) return { tier: "great", label: "GREAT BUY", rank: 4 };
  if (total <= targets.buyCeiling) return { tier: "buy", label: "BUY", rank: 3 };
  if (total <= targets.walkAway) return { tier: "fair", label: "FAIR / NEGOTIATE", rank: 2 };
  return { tier: "pass", label: "PASS", rank: 1 };
}

async function runActiveEbaySearch(query, apiKey) {
  const params = new URLSearchParams({
    engine: "ebay",
    ebay_domain: "ebay.com",
    _nkw: query,
    _ipg: String(DEALS_SEARCH_COUNT),
    _sop: "15",
    _salic: "1",
    api_key: apiKey,
  });

  const endpoint = `https://serpapi.com/search.json?${params.toString()}`;
  const res = await fetchWithTimeout(
    endpoint,
    { headers: { "Accept": "application/json" } },
    DEALS_TIMEOUT_MS,
    "Active eBay search timed out"
  );
  const data = await res.json().catch(() => ({}));
  const status = data?.search_metadata?.status;
  const providerError = String(data?.error || "");
  const noResults = /hasn['’]?t returned any results|no results|did not return any results/i.test(providerError);

  // SerpApi sometimes expresses a legitimate zero-result eBay search in the
  // "error" field. That is not a provider outage and should not fail Scout.
  if (noResults) {
    return {
      ...data,
      error: undefined,
      organic_results: [],
      scout_no_results: true
    };
  }

  if (!res.ok || status === "Error" || data.error) {
    const err = new Error(data.error || `Active eBay provider returned HTTP ${res.status}.`);
    err.status = res.status >= 400 ? res.status : 502;
    throw err;
  }
  return data;
}


function buildActiveFallbackQuery(card) {
  // Broaden discovery only. Scout's identity filter below still requires the
  // correct player/year/set/card number before a listing can be accepted.
  return [card.player, card.year, card.set].filter(Boolean).join(" ");
}

async function searchActiveEbayDeals(card, targets, apiKey) {
  const query = buildQuery(card);
  let data = await runActiveEbaySearch(query, apiKey);
  let raw = Array.isArray(data.organic_results) ? data.organic_results : [];
  let fallbackQuery = "";
  let usedFallback = false;

  if (!raw.length) {
    fallbackQuery = buildActiveFallbackQuery(card);
    if (fallbackQuery && normalizeText(fallbackQuery) !== normalizeText(query)) {
      const fallbackData = await runActiveEbaySearch(fallbackQuery, apiKey);
      const fallbackRaw = Array.isArray(fallbackData.organic_results) ? fallbackData.organic_results : [];
      if (fallbackRaw.length) {
        data = fallbackData;
        raw = fallbackRaw;
        usedFallback = true;
      }
    }
  }

  const normalized = dedupe(raw.map(normalizeActiveEbayResult).filter(Boolean));

  const accepted = [];
  const rejected = [];

  for (const item of normalized) {
    const reason = activeDealMismatchReason(item, card);
    if (reason) {
      rejected.push({
        id: item.id,
        title: item.title,
        price: item.price,
        shipping: item.shipping,
        delivered: item.delivered,
        link: item.link,
        seller: item.seller,
        reason,
      });
      continue;
    }

    if (item.format === "auction") {
      if (targets) {
        const maxBid = Math.max(0, targets.buyCeiling - item.shipping);
        const biddingRoom = maxBid - item.price;
        accepted.push({
          ...item,
          maxBid,
          biddingRoom,
          watch: biddingRoom >= 0,
          dealTier: biddingRoom >= 0 ? "watch" : "pass",
          dealLabel: biddingRoom >= 0 ? "WATCH AUCTION" : "PASS",
        });
      } else {
        accepted.push({
          ...item,
          maxBid: null,
          biddingRoom: null,
          watch: false,
          dealTier: "unrated",
          dealLabel: "UNRATED",
        });
      }
    } else {
      if (targets) {
        const v = activeDealVerdict(item.delivered, targets);
        accepted.push({
          ...item,
          dealTier: v.tier,
          dealLabel: v.label,
          dealRank: v.rank,
        });
      } else {
        accepted.push({
          ...item,
          dealTier: "unrated",
          dealLabel: "UNRATED",
          dealRank: 0,
        });
      }
    }
  }

  const bins = accepted
    .filter(x => x.format !== "auction")
    .sort((a, b) => targets
      ? ((b.dealRank - a.dealRank) || (a.delivered - b.delivered))
      : (a.delivered - b.delivered))
    .slice(0, DEALS_BIN_LIMIT);

  const auctions = accepted
    .filter(x => x.format === "auction")
    .sort((a, b) => targets
      ? ((Number(b.watch) - Number(a.watch)) || (b.biddingRoom - a.biddingRoom) || (a.delivered - b.delivered))
      : (a.delivered - b.delivered))
    .slice(0, DEALS_AUCTION_LIMIT);

  return {
    query,
    fallbackQuery: usedFallback ? fallbackQuery : "",
    usedFallback,
    searched: raw.length,
    normalized: normalized.length,
    matched: accepted.length,
    rated: Boolean(targets),
    targets,
    buyItNow: bins,
    auctions,
    rejected: rejected.slice(0, DEALS_REJECT_LIMIT),
    rejectedCount: rejected.length,
    checkedAt: new Date().toISOString(),
    notes: [
      "Deal Finder uses active eBay search results and includes visible shipping in delivered price.",
      usedFallback
        ? "The strict active search returned no results, so Scout retried with a broader discovery query and still applied the full exact-card identity filter."
        : "The strict active search returned usable discovery results.",
      "Tax is not included because the final tax depends on the buyer's checkout location.",
      "Scout rejects title mismatches, lots, wrong grading state, reprints, and listings with unclear shipping before ranking.",
      targets
        ? "Auction MAX BID equals Buy Ceiling minus visible shipping; the current bid is never treated as a guaranteed purchase price."
        : "Sold evidence was insufficient for Smart Buy Targets, so Scout sorted active listings by delivered price without assigning Buy/Pass or MAX BID labels."
    ]
  };
}


async function searchSerpApi(card, query, apiKey, fastMode=false, options={}) {
  const profile = normalizeValuationProfile(options);
  const broadQuery = buildBroadSoldQuery(card);
  const attempts = [];
  let data = null;
  let emptyData = null;
  let searchMode = "";
  let usedQuery = query;
  let targetBroadAttempted = false;
  let targetBroadAdded = false;

  async function syncAttempt(q, mode, timeoutMs, label) {
    try {
      const result = await runEbaySearch(q, apiKey, mode, false, timeoutMs);
      const count = Array.isArray(result?.organic_results) ? result.organic_results.length : 0;
      attempts.push(`${label}: ${count} result${count === 1 ? "" : "s"}`);
      return { ok: true, data: result, count };
    } catch (err) {
      attempts.push(`${label}: ${err?.message || "failed"}`);
      return { ok: false, error: err };
    }
  }

  async function asyncAttempt(q, mode, label, maxWaitMs=SERP_ASYNC_MAX_WAIT_MS, totalBudget=false) {
    try {
      const result = await runEbaySearchAsync(q, apiKey, mode, maxWaitMs, totalBudget);
      const count = Array.isArray(result?.organic_results) ? result.organic_results.length : 0;
      attempts.push(`${label}: ${count} result${count === 1 ? "" : "s"} (async)`);
      return { ok: true, data: result, count };
    } catch (err) {
      attempts.push(`${label}: ${err?.message || "failed"}`);
      return { ok: false, error: err };
    }
  }

  // 1) Exact search stays synchronous so cache hits / quick responses return fast.
  const strictSold = await syncAttempt(
    query,
    "Sold",
    SERP_SOLD_STRICT_TIMEOUT_MS,
    "Strict Sold"
  );

  if (profile.targetEnrichment) {
    const strictRaw = strictSold.ok && Array.isArray(strictSold.data?.organic_results)
      ? strictSold.data.organic_results
      : [];
    const strictEvaluation = evaluateComparableResults(strictRaw.map(normalizeResult).filter(Boolean), card);
    let combinedRaw = [...strictRaw];
    let broadSold = null;

    if (strictEvaluation.cleaned.length < profile.evidenceGoal) {
      targetBroadAttempted = true;
      broadSold = await asyncAttempt(
        broadQuery,
        "Sold",
        "Bounded Broad Sold",
        profile.extraWaitMs,
        true
      );
      if (broadSold.ok) {
        combinedRaw.push(...(Array.isArray(broadSold.data?.organic_results) ? broadSold.data.organic_results : []));
        targetBroadAdded = broadSold.count > 0;
      }
    }

    if (strictSold.ok || broadSold?.ok) {
      data = {
        ...(strictSold.ok ? strictSold.data : broadSold.data),
        organic_results: combinedRaw,
      };
      searchMode = targetBroadAdded ? "Sold-target-bounded-broad" : "Sold-target-strict";
      usedQuery = targetBroadAdded ? `${query} | ${broadQuery}` : query;
    }
  } else if (strictSold.ok) {
    if (strictSold.count > 0) {
      data = strictSold.data;
      searchMode = "Sold";
      usedQuery = query;
    } else {
      emptyData = strictSold.data;
    }
  }

  // Fast Mode never starts the slow 30-second broad poll. The parallel Card API
  // primary can answer from two clean exact-card comps while SerpApi stays quick.
  if (!data && fastMode) {
    if (emptyData) {
      data = emptyData;
      searchMode = "Sold-fast-no-results";
      usedQuery = query;
    } else {
      throw new Error(`Fast sold search failed. ${attempts.join(" | ")}`);
    }
  }

  // 2) Deep Mode broad discovery uses SerpApi's async mode. Sold and Completed
  // are submitted together, then each is polled through Search Archive.
  if (!data) {
    const [broadSold, broadCompleted] = await Promise.all([
      asyncAttempt(broadQuery, "Sold", "Broad Sold"),
      asyncAttempt(broadQuery, "Complete", "Broad Completed")
    ]);

    if (broadSold.ok && broadSold.count > 0) {
      data = broadSold.data;
      searchMode = "Sold-broad-async";
      usedQuery = broadQuery;
    } else if (broadCompleted.ok && broadCompleted.count > 0) {
      data = broadCompleted.data;
      searchMode = "Complete-broad-async-sold-only";
      usedQuery = broadQuery;
    } else {
      if (!emptyData && broadSold.ok) emptyData = broadSold.data;
      if (!emptyData && broadCompleted.ok) emptyData = broadCompleted.data;
    }
  }

  if (!data && emptyData) {
    data = emptyData;
    searchMode = "Sold-no-results";
    usedQuery = broadQuery;
  }

  if (!data) {
    throw new Error(`Sold search attempts failed. ${attempts.join(" | ")}`);
  }

  let raw = Array.isArray(data.organic_results) ? data.organic_results : [];
  if (searchMode === "Complete-broad-async-sold-only") {
    raw = raw.filter(r => Boolean(r && r.sold_date));
  }

  const normalized = raw.map(normalizeResult).filter(Boolean);
  const evaluation = evaluateComparableResults(normalized, card);

  const notes = buildNotes(card, raw.length, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);
  notes.unshift(`Sold discovery: ${attempts.join(" | ")}`);

  if (usedQuery !== query) {
    notes.unshift("The strict sold search did not produce usable discovery, so Scout broadened the eBay query and then reapplied the full exact-card identity filter.");
  }
  if (searchMode === "Sold-broad-async" || searchMode === "Complete-broad-async-sold-only") {
    notes.unshift("Scout used SerpApi asynchronous eBay discovery and Search Archive polling so slow sold searches could finish without timing out the individual provider connection.");
  }
  if (searchMode === "Complete-broad-async-sold-only") {
    notes.unshift("Scout kept only Completed entries explicitly marked sold.");
  }
  if (searchMode === "Sold-no-results" || searchMode === "Sold-fast-no-results") {
    notes.unshift("SerpApi returned no sold listings for the available searches; Scout preserved that as a thin-market result instead of reporting a provider outage.");
  }
  if (evaluation.matchMode === "relaxed") {
    notes.push("Scout used a controlled relaxed title match because eBay sellers format grades/card numbers inconsistently.");
  }
  if (targetBroadAttempted) {
    notes.unshift(targetBroadAdded
      ? "The strict sold response remained below four clean exact-card comps, so Scout added one bounded broad Sold-only search and reapplied every matching and outlier rule."
      : "The bounded broad Sold-only enrichment did not finish with additional evidence; Scout kept the verified strict-search comps.");
  }

  return {
    ...evaluation,
    searched: raw.length,
    matched: evaluation.matchedItems.length,
    searchMode,
    discoveryQuery: usedQuery,
    notes,
  };
}

async function searchApify(card, query, token, fastMode=false, cardApiKey="") {
  const count = fastMode ? APIFY_FAST_COUNT : APIFY_DEEP_COUNT;
  const timeoutSeconds = fastMode ? APIFY_FAST_TIMEOUT_SECONDS : APIFY_DEEP_TIMEOUT_SECONDS;
  const input = {
    keywords: [buildApifyQuery(card)],
    categoryId: "212",
    daysToScrape: 90,
    count,
    ebaySite: "ebay.com",
    sortOrder: "endedRecently",
    itemLocation: "default",
    itemCondition: "any",
    includeCompletedListings: true,
  };

  const endpoint = new URL("https://api.apify.com/v2/acts/caffein.dev~ebay-sold-listings/run-sync-get-dataset-items");
  endpoint.searchParams.set("timeout", String(timeoutSeconds));
  endpoint.searchParams.set("maxItems", String(count));
  endpoint.searchParams.set("maxTotalChargeUsd", "0.25");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("clean", "true");

  const res = await fetch(endpoint.toString(), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Apify returned HTTP ${res.status}.`;
    throw new Error(msg);
  }
  if (!Array.isArray(data)) throw new Error("Apify returned an unexpected response.");

  const normalized = data.map(normalizeApifyResult).filter(Boolean);

  let recovery = { attempted: 0, recovered: [], misses: [] };
  if (cardApiKey) {
    recovery = await recoverBestOffersFromExistingApifyRows(card, data, cardApiKey, fastMode);
  }

  const normalizedWithRecovered = [...normalized, ...recovery.recovered];
  const evaluation = evaluateComparableResults(normalizedWithRecovered, card);
  const rejectedBeforeMatching = data.length - normalized.length;
  const notes = buildNotes(card, data.length, evaluation.matchedItems.length, evaluation.cleaned.length, evaluation.confidence);

  if (rejectedBeforeMatching > 0) {
    notes.push(`${rejectedBeforeMatching} Apify result${rejectedBeforeMatching === 1 ? " was" : "s were"} rejected before card matching (for example Best Offer, unknown price range, non-USD, or invalid/future sale date).`);
  }
  if (recovery.recovered.length > 0) {
    notes.push(`${recovery.recovered.length} Best Offer accepted price${recovery.recovered.length === 1 ? " was" : "s were"} recovered from The Card API and included as confirmed sold comps.`);
    notes.push("Because this valuation contains The Card API transaction data, Scout will not persist it in the six-hour Cloudflare valuation cache.");
  } else if (recovery.attempted > 0) {
    notes.push(`Scout tried to recover ${recovery.attempted} Best Offer accepted price${recovery.attempted === 1 ? "" : "s"}, but no exact confirmed Card API match was available; the valuation continues without them.`);
  }

  if (evaluation.matchMode === "relaxed") {
    notes.push("Scout used a controlled relaxed title match on the Apify results because eBay sellers format card numbers inconsistently.");
  }

  return {
    ...evaluation,
    searched: data.length,
    matched: evaluation.matchedItems.length,
    searchMode: recovery.recovered.length > 0 ? "Apify sold + completed + Best Offer recovery" : "Apify sold + completed",
    notes,
    bestOfferRecovered: recovery.recovered.length,
    bestOfferRecoveryAttempted: recovery.attempted,
  };
}

function evaluateComparableResults(normalized, card, comparable=isComparable) {
  let matchedItems = dedupe(
    normalized.filter(item => isReasonableSoldDate(item.soldDate, false) && comparable(item, card, false))
  );
  let matchMode = "strict";

  if (matchedItems.length < 2 && normalized.length) {
    const relaxed = dedupe(
      normalized.filter(item => isReasonableSoldDate(item.soldDate, false) && comparable(item, card, true))
    );
    if (relaxed.length > matchedItems.length) {
      matchedItems = relaxed;
      matchMode = "relaxed";
    }
  }

  const priced = matchedItems.filter(x => Number.isFinite(x.price) && x.price > 0);
  const cleaned = removePriceOutliers(priced);
  const stats = summarize(cleaned.map(x => x.price).sort((a,b)=>a-b));
  const confidence = confidenceFor(cleaned, stats, card);

  return { matchedItems, cleaned, stats, confidence, matchMode };
}

function finalizeValuation(card, query, items, meta) {
  const cleaned = removePriceOutliers(dedupe(items).filter(x => Number.isFinite(x.price) && x.price > 0));
  const prices = cleaned.map(x => x.price).sort((a,b)=>a-b);
  const stats = summarize(prices);
  const confidence = confidenceFor(cleaned, stats, card);
  const tier = verdictTier(Number(card.shopPrice), stats.median, stats.low, stats.high, confidence);
  const newestFirst = [...cleaned].sort((a,b) => dateValue(b.soldDate)-dateValue(a.soldDate));

  return {
    provider: meta.provider,
    query,
    searchMode: meta.searchMode,
    matchMode: meta.matchMode,
    searched: meta.searched,
    matched: meta.matched,
    used: cleaned.length,
    median: stats.median,
    low: stats.low,
    high: stats.high,
    min: stats.min,
    max: stats.max,
    confidence,
    verdictTier: tier,
    notes: uniqueStrings(meta.notes || []),
    comps: newestFirst.slice(0, 12),
    checkedAt: new Date().toISOString(),
    mode: meta.mode || "deep",
    bestOfferRecovered: Number(meta.bestOfferRecovered || 0),
    bestOfferRecoveryAttempted: Number(meta.bestOfferRecoveryAttempted || 0),
    cachePolicy: Number(meta.bestOfferRecovered || 0) > 0
      ? "not persisted — contains Card API negotiated-price data"
      : "fresh for 6 hours; retained up to 48 hours for provider-outage fallback",
    cacheHit: false,
  };
}

async function runEbaySearchAsync(query, apiKey, showOnly, maxWaitMs=SERP_ASYNC_MAX_WAIT_MS, totalBudget=false) {
  const budgetStarted = Date.now();
  const params = new URLSearchParams({
    engine: "ebay",
    ebay_domain: "ebay.com",
    _nkw: query,
    show_only: showOnly,
    _ipg: "50",
    async: "true",
    api_key: apiKey,
  });

  // SerpApi documents async and no_cache as mutually exclusive, so async
  // broad-discovery requests intentionally use normal cache behavior.
  const submitUrl = `https://serpapi.com/search.json?${params.toString()}`;
  const submitRes = await fetchWithTimeout(
    submitUrl,
    { headers: { "Accept": "application/json" } },
    totalBudget ? Math.max(1, Math.min(8000, maxWaitMs)) : 8000,
    "SerpApi async submission timed out"
  );
  const submitData = await submitRes.json().catch(() => ({}));
  if (!submitRes.ok || submitData?.error) {
    throw new Error(submitData?.error || `SerpApi async submission returned ${submitRes.status}.`);
  }

  const searchId = String(submitData?.search_metadata?.id || "").trim();
  if (!searchId) {
    // A cache hit may occasionally return a completed payload immediately.
    if (Array.isArray(submitData?.organic_results)) return submitData;
    throw new Error("SerpApi async submission did not return a search ID.");
  }

  const pollStarted = Date.now();
  const deadlineStarted = totalBudget ? budgetStarted : pollStarted;
  let lastStatus = String(submitData?.search_metadata?.status || "Queued");

  while ((Date.now() - deadlineStarted) < maxWaitMs) {
    const beforeWaitRemaining = maxWaitMs - (Date.now() - deadlineStarted);
    await new Promise(resolve => setTimeout(resolve, Math.min(SERP_ASYNC_POLL_INTERVAL_MS, beforeWaitRemaining)));
    const pollRemaining = maxWaitMs - (Date.now() - deadlineStarted);
    if (pollRemaining <= 0) break;

    const archiveUrl = `https://serpapi.com/searches/${encodeURIComponent(searchId)}.json?api_key=${encodeURIComponent(apiKey)}`;
    const pollRes = await fetchWithTimeout(
      archiveUrl,
      { headers: { "Accept": "application/json" } },
      totalBudget ? Math.max(1, Math.min(7000, pollRemaining)) : 7000,
      "SerpApi Search Archive poll timed out"
    );
    const data = await pollRes.json().catch(() => ({}));

    if (!pollRes.ok) {
      throw new Error(data?.error || `SerpApi Search Archive returned ${pollRes.status}.`);
    }

    lastStatus = String(data?.search_metadata?.status || lastStatus);
    const providerError = String(data?.error || "");
    const noResults = /hasn['’]?t returned any results|no results|did not return any results/i.test(providerError);

    if (noResults) {
      return {
        ...data,
        error: undefined,
        organic_results: [],
        scout_no_results: true,
        scout_async: true,
      };
    }

    if (lastStatus === "Success") {
      return { ...data, scout_async: true };
    }

    if (lastStatus === "Error" || data?.error) {
      throw new Error(data?.error || `SerpApi async search ended with status ${lastStatus}.`);
    }
    if (lastStatus === "Queued" || lastStatus === "Processing") {
      continue;
    }
    // Unknown nonterminal statuses are allowed one more poll rather than
    // being mistaken for success or failure.
  }

  throw new Error(`SerpApi async search was still ${lastStatus} after ${Math.round(maxWaitMs/1000)}s.`);
}

async function runEbaySearch(query, apiKey, showOnly, noCache, timeoutMs=SERP_TIMEOUT_MS) {
  const params = new URLSearchParams({
    engine: "ebay",
    ebay_domain: "ebay.com",
    _nkw: query,
    show_only: showOnly,
    _ipg: "50",
    api_key: apiKey,
  });
  if (noCache) params.set("no_cache", "true");
  const endpoint = `https://serpapi.com/search.json?${params.toString()}`;
  const res = await fetchWithTimeout(endpoint, { headers: { "Accept": "application/json" } }, timeoutMs, "SerpApi search timed out");
  const data = await res.json().catch(() => ({}));
  const status = data?.search_metadata?.status;
  const providerError = String(data?.error || "");
  const noResults = /hasn['’]?t returned any results|no results|did not return any results/i.test(providerError);

  // eBay/SerpApi often reports a legitimate zero-result search in the error field.
  // Treat that as an empty search, not a provider outage, so Scout can broaden discovery.
  if (noResults) {
    return {
      ...data,
      error: undefined,
      organic_results: [],
      scout_no_results: true
    };
  }

  if (!res.ok || status === "Error" || data.error) {
    throw new Error(data.error || `Sold-comps provider returned ${res.status}.`);
  }
  return data;
}

async function fetchWithTimeout(url, options={}, timeoutMs=8000, label="Request timed out") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && (err.name === "AbortError" || String(err.message || "").toLowerCase().includes("abort"))) {
      throw new Error(`${label} after ${Math.round(timeoutMs/1000)}s.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function cacheKeyFor(card, fastMode) {
  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  const bits = [
    VALUATION_CACHE_VERSION,
    fastMode ? "fast" : "deep",
    Number(card.year) || "",
    normalizeText(card.set),
    normalizeText(card.player),
    normalizeCardNum(card.cardNum),
    grader,
    grade,
    serialDenominator(card.serial),
    card.autograph ? "auto" : "noauto",
    card.relic ? "relic" : "norelic",
  ];
  return new Request(`https://hof-card-scout-cache.invalid/value?key=${encodeURIComponent(bits.join("|"))}`, { method: "GET" });
}

async function readValuationCache(card, fastMode) {
  try {
    if (typeof caches === "undefined" || !caches.default) return null;
    const hit = await caches.default.match(cacheKeyFor(card, fastMode));
    if (!hit) return null;
    const data = await hit.json().catch(() => null);
    return valuationCacheEntry(data);
  } catch {
    return null;
  }
}

function valuationCacheEntry(data, nowMs=Date.now()) {
  if (!data || typeof data !== "object") return null;
  if (Number(data.schemaVersion) !== VALUATION_CACHE_VERSION) return null;
  if (!data.result || typeof data.result !== "object") return null;
  const cachedAtMs = Date.parse(data.cachedAt || "");
  if (!Number.isFinite(cachedAtMs)) return null;
  const ageSeconds = Math.max(0, (nowMs - cachedAtMs) / 1000);
  if (ageSeconds > VALUATION_CACHE_RETENTION_SECONDS) return null;
  return {
    result: data.result,
    ageSeconds,
    fresh: ageSeconds <= VALUATION_CACHE_FRESH_SECONDS,
    stale: ageSeconds > VALUATION_CACHE_FRESH_SECONDS,
  };
}

async function writeValuationCache(card, fastMode, result) {
  try {
    if (typeof caches === "undefined" || !caches.default) return;
    const response = new Response(JSON.stringify({
      schemaVersion: VALUATION_CACHE_VERSION,
      cachedAt: new Date().toISOString(),
      result,
    }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${VALUATION_CACHE_RETENTION_SECONDS}`,
      }
    });
    await caches.default.put(cacheKeyFor(card, fastMode), response);
  } catch (err) {
    console.warn("Scout cache write skipped:", err?.message || err);
  }
}

function cacheableValuationResult(result) {
  const cacheable = { ...result };
  delete cacheable.verdictTier;
  delete cacheable.cacheHit;
  delete cacheable.staleCacheFallback;
  delete cacheable.cacheAgeHours;
  delete cacheable.liveProviderError;
  return cacheable;
}

function valuationEvidenceCount(result) {
  const used = Number(result?.used);
  return Number.isFinite(used) && used >= 0 ? used : 0;
}

function valuationConfidenceRank(result) {
  const level = String(result?.confidence || result?.legacyConfidence || "insufficient").toLowerCase();
  return ({ insufficient: 0, low: 1, medium: 2, high: 3 })[level] || 0;
}

function isValuationEvidenceStronger(candidate, baseline) {
  const candidateUsed = valuationEvidenceCount(candidate);
  const baselineUsed = valuationEvidenceCount(baseline);
  if (candidateUsed !== baselineUsed) return candidateUsed > baselineUsed;
  return valuationConfidenceRank(candidate) > valuationConfidenceRank(baseline);
}

function targetEnrichmentCacheFallback(cacheEntry, liveError=null) {
  const detail = liveError?.message || String(liveError || "Live enrichment did not improve the verified evidence.");
  return {
    ...cacheEntry.result,
    notes: uniqueStrings([
      ...(cacheEntry.result.notes || []),
      "Target enrichment did not produce stronger verified evidence, so Scout kept the existing fresh sold-comps valuation."
    ]),
    targetEnrichmentFallback: true,
    liveProviderError: detail,
  };
}

function staleValuationFallback(cacheEntry, liveError) {
  const ageHours = Math.max(0.1, Math.round((cacheEntry.ageSeconds / 3600) * 10) / 10);
  const note = `Live sold sources were temporarily unavailable. Scout is using previously verified sold comps from ${ageHours} hours ago; recheck before buying.`;
  return {
    ...cacheEntry.result,
    notes: uniqueStrings([...(cacheEntry.result.notes || []), note]),
    cachePolicy: "stale cache fallback from the 6–48-hour retention window",
    staleCacheFallback: true,
    cacheAgeHours: ageHours,
    liveProviderError: liveError?.message || String(liveError || "Live sold sources unavailable."),
  };
}

async function getValuationWithCache(card, env, fastMode=false, ctx=null, options={}) {
  const profile = normalizeValuationProfile(options);
  const cached = await readValuationCache(card, fastMode);
  if (cached?.fresh && (
    !profile.targetEnrichment ||
    valuationEvidenceCount(cached.result) >= profile.evidenceGoal
  )) {
    return withCurrentShopVerdict(cached.result, card, true);
  }

  try {
    const raw = await valueCard(card, env, fastMode, {
      ...profile,
      fallbackEvidenceCount: cached?.fresh ? valuationEvidenceCount(cached.result) : 0,
    });
    if (cached?.fresh && profile.targetEnrichment && !isValuationEvidenceStronger(raw, cached.result)) {
      return withCurrentShopVerdict(targetEnrichmentCacheFallback(cached), card, true);
    }
    const cacheable = cacheableValuationResult(raw);
    if (Number(cacheable.used) > 0 && Number(cacheable.bestOfferRecovered || 0) === 0) {
      const put = writeValuationCache(card, fastMode, cacheable);
      if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(put);
      else await put;
    }
    return withCurrentShopVerdict(cacheable, card, false);
  } catch (err) {
    if (cached?.fresh && profile.targetEnrichment) {
      return withCurrentShopVerdict(targetEnrichmentCacheFallback(cached, err), card, true);
    }
    if (cached?.stale) {
      return withCurrentShopVerdict(staleValuationFallback(cached, err), card, true);
    }
    throw err;
  }
}

function withCurrentShopVerdict(result, card, cacheHit=false) {
  const legacyConfidence = String(result.confidence || "insufficient");
  const base = {
    ...result,
    cachePolicy: result.cachePolicy || (cacheHit
      ? "fresh valuation cache (6 hours)"
      : "fresh for 6 hours; retained up to 48 hours for provider-outage fallback"),
    cacheHit,
  };

  // Insufficient evidence remains insufficient. Otherwise Phase 2C becomes
  // Scout's official Low/Medium/High label. Verdict price thresholds are unchanged.
  const confidenceLab = explainExperimentalConfidence(base, card);
  const confidence =
    legacyConfidence === "insufficient"
      ? "insufficient"
      : String(confidenceLab?.market?.proposedLevel || legacyConfidence);

  return {
    ...base,
    legacyConfidence,
    confidence,
    confidenceModel: "Phase 2C evidence score",
    confidenceScore: Number(confidenceLab?.market?.score || 0),
    confidenceLab,
    verdictTier: verdictTier(Number(card.shopPrice), Number(result.median), Number(result.low), Number(result.high), confidence),
  };
}

function buildQuery(card) {
  const parts = [
    card.year,
    card.set,
    card.player,
    card.cardNum ? `#${card.cardNum}` : "",
    "baseball card",
  ];
  const grader = canonicalGrader(card.grader);
  const grade = String(card.grade || "").trim();
  if (grader && grader !== "Raw") parts.push(grader, grade.replace(new RegExp(`^${escapeRegExp(grader)}\\s*`, "i"), ""));
  if (card.autograph) parts.push("autograph");
  if (card.relic) parts.push("relic");
  const denom = serialDenominator(card.serial);
  if (denom) parts.push(`/${denom}`);
  if (grader === "Raw") parts.push("-PSA", "-SGC", "-BGS", "-CGC", "-CSG", "-graded");
  return parts.filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}

function buildBroadSoldQuery(card) {
  const parts = [
    card.year,
    card.set,
    card.player,
    card.cardNum ? String(card.cardNum).replace(/^#/, "") : "",
  ];
  const grader = canonicalGrader(card.grader);
  const grade = String(card.grade || "").trim();
  if (grader && grader !== "Raw") {
    parts.push(grader, grade.replace(new RegExp(`^${escapeRegExp(grader)}\\s*`, "i"), ""));
  }
  if (card.autograph) parts.push("autograph");
  if (card.relic) parts.push("relic");
  const denom = serialDenominator(card.serial);
  if (denom) parts.push(`/${denom}`);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function buildApifyQuery(card) {
  const parts = [
    card.year,
    card.set,
    card.player,
    card.cardNum ? String(card.cardNum).replace(/^#/, "") : "",
    "baseball card",
  ];
  const grader = canonicalGrader(card.grader);
  const grade = String(card.grade || "").trim();
  if (grader && grader !== "Raw") parts.push(grader, grade.replace(new RegExp(`^${escapeRegExp(grader)}\\s*`, "i"), ""));
  if (card.autograph) parts.push("autograph");
  if (card.relic) parts.push("relic");
  const denom = serialDenominator(card.serial);
  if (denom) parts.push(`/${denom}`);
  return parts.filter(Boolean).join(" ").replace(/\s+/g," ").trim();
}

function normalizeResult(r) {
  if (!r || !r.title) return null;
  const price = extractPrice(r.price);
  const soldDate = r.sold_date || r.ended_date || null;
  if (!isReasonableSoldDate(soldDate, true)) return null;
  return {
    id: r.product_id || r.epid || r.link || r.title,
    title: String(r.title),
    price,
    soldDate,
    condition: r.condition || "",
    link: r.link || "",
    thumbnail: r.thumbnail || "",
    source: "SerpApi",
  };
}

function normalizeApifyResult(r) {
  if (!r || !r.title) return null;

  // eBay hides the actual accepted price for Best Offer sales; Apify correctly
  // exposes that fact, so Scout excludes those asking-price placeholders.
  if (r.isBestOfferAccepted === true || r.listingType === "best_offer_accepted") return null;

  // A multi-variant range is not an exact transaction price.
  if (r.soldPriceMax != null && String(r.soldPriceMax).trim() !== "" &&
      Number(extractPrice(r.soldPriceMax)) !== Number(extractPrice(r.soldPrice))) return null;

  const currency = String(r.soldCurrency || "USD").toUpperCase();
  if (currency && currency !== "USD") return null;

  const soldDate = r.endedAt || null;
  if (!isReasonableSoldDate(soldDate, true)) return null;

  const price = extractPrice(r.soldPrice);
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    id: r.itemId || r.itemNumber || r.url || r.title,
    title: String(r.title),
    price,
    soldDate,
    condition: r.condition || "",
    link: r.url || "",
    thumbnail: r.thumbnailUrl || r.fullResThumbnailUrl || "",
    source: "Apify",
    listingType: r.listingType || "",
  };
}

function extractPrice(p) {
  if (p == null) return null;
  if (typeof p === "number") return p;
  if (typeof p === "object") {
    if (Number.isFinite(Number(p.extracted))) return Number(p.extracted);
    if (p.raw) return parseMoney(p.raw);
  }
  return parseMoney(String(p));
}
function parseMoney(s) {
  const text = String(s || "").replace(/,/g,"").trim();
  const money = text.match(/(?:US\s*)?\$\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  if (money) return Number(money[1]);
  const plain = text.match(/^([0-9]+(?:\.[0-9]{1,4})?)$/);
  return plain ? Number(plain[1]) : null;
}

function isComparable(item, card, relaxed=false) {
  const title = normalizeText(item.title);
  const rawTitle = item.title.toLowerCase();
  const year = String(card.year);
  if (!title.includes(year)) return false;

  const names = normalizeText(card.player).split(" ").filter(Boolean);
  const last = names[names.length-1];
  if (last && !title.includes(last)) return false;

  const setTokens = meaningfulTokens(card.set);
  if (setTokens.length && setTokens.filter(t=>title.includes(t)).length < Math.min(setTokens.length, 2)) return false;

  if (card.cardNum && !cardNumberMatches(rawTitle, String(card.cardNum), relaxed)) return false;

  const grader = canonicalGrader(card.grader);
  const grade = normalizeGrade(card.grade, grader);
  const gradingWords = /\b(psa|sgc|bgs|beckett|cgc|csg|bccg|gma|tag)\b/i;
  if (grader && grader !== "Raw") {
    const graderRx = graderRegex(grader);
    if (!graderRx.test(rawTitle)) return false;
    if (grade && !gradeMatches(rawTitle, grade, grader, relaxed)) return false;
  } else if (grader === "Raw" && gradingWords.test(rawTitle)) return false;

  const autoRx = /\b(auto(?:graph)?|autographed|signed)\b/i;
  if (card.autograph ? !autoRx.test(rawTitle) : autoRx.test(rawTitle)) return false;

  const relicRx = /\b(relic|memorabilia|jersey|patch|game[ -]?used|bat piece|piece of bat)\b/i;
  if (card.relic ? !relicRx.test(rawTitle) : relicRx.test(rawTitle)) return false;

  const denom = serialDenominator(card.serial);
  if (denom && !new RegExp(`\\/\\s*${escapeRegExp(denom)}\\b`).test(rawTitle)) return false;

  if (looksLikeLot(rawTitle)) return false;
  if (isExplicitTeamCardListing(rawTitle)) return false;
  if (isObviousNonTradingCardListing(rawTitle)) return false;

  const setText = String(card.set||"").toLowerCase();
  const allowReprint = /archives|reprint/.test(setText) || /reprint/i.test(String(card.notes||""));
  if (!allowReprint && /\b(reprint|replica|facsimile|custom card)\b/i.test(rawTitle)) return false;

  return true;
}

function meaningfulTokens(s) {
  const stop = new Set(["the","and","baseball","card","cards","series"]);
  return normalizeText(s).split(" ").filter(t=>t.length>1&&!stop.has(t));
}
function normalizeText(s) { return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
function normalizeCardNum(s){ return String(s||"").toLowerCase().replace(/^#/,'').replace(/\s+/g,'').replace(/[^a-z0-9-]/g,''); }
function cardNumberMatches(title, num, relaxed=false) {
  const n = normalizeCardNum(num);
  if (!n) return true;
  const lower = title.toLowerCase();
  const compact = lower.replace(/\s+/g,'');
  const escaped = escapeRegExp(n);
  const strict = new RegExp(`(?:#|no\\.?\\s*|card\\s*#?\\s*)${escaped}(?![a-z0-9])`,"i");
  if (strict.test(lower) || compact.includes(`#${n}`) || compact.includes(`no.${n}`)) return true;
  if (!relaxed) return false;
  // Relaxed pass: allow a standalone card number even when the seller omitted #/No.
  const loose = new RegExp(`(^|[^a-z0-9])${escaped}(?![a-z0-9])`,"i");
  return loose.test(lower);
}
function canonicalGrader(g){
  const s=String(g||"").trim().toUpperCase();
  if(!s||s==="RAW")return "Raw";
  if(s.startsWith("BGS")||s.includes("BECKETT"))return "BGS";
  if(s.startsWith("PSA"))return "PSA";
  if(s.startsWith("SGC"))return "SGC";
  if(s.startsWith("CGC"))return "CGC";
  if(s.startsWith("CSG"))return "CSG";
  return s.replace(/\s*\/.*$/,'');
}
function graderRegex(g){
  if(g==="BGS") return /\b(bgs|beckett)\b/i;
  return new RegExp(`\\b${escapeRegExp(g)}\\b`,"i");
}
function normalizeGrade(g, grader){
  let s=String(g||"").trim();
  if(!s)return "";
  if(grader&&grader!=="Raw")s=s.replace(new RegExp(`^${escapeRegExp(grader)}\\s*`,"i"),"");
  const m=s.match(/\b(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1)\b/);
  return m?m[1]:"";
}
function gradeMatches(title, grade, grader, relaxed=false){
  const g=escapeRegExp(grade);
  const gr=grader==="BGS"?"(?:bgs|beckett)":escapeRegExp(grader);
  // Common seller formats include “PSA 9”, “PSA MINT 9”, “PSA NM-MT 8”, etc.
  const nearGrader = new RegExp(`\\b${gr}\\b(?:\\s+[a-z-]+){0,4}\\s*${g}(?![0-9.])`,"i");
  if (nearGrader.test(title)) return true;
  if (!relaxed) return false;
  // Relax only to a standalone grade token when the correct grader is already present.
  const standalone = new RegExp(`(^|[^0-9.])${g}(?![0-9.])`,"i");
  return graderRegex(grader).test(title) && standalone.test(title);
}
function serialDenominator(s){ const m=String(s||"").match(/\/\s*(\d+)/); return m?m[1]:""; }
function looksLikeLot(t){
  return /\blot\s+of\s+\d+\b|\b\d+\s*card\s+lot\b|\bcard\s+lot\b|\bcomplete\s+(?:baseball\s+)?set\b|\bteam\s+set\b|\byou\s+pick\b|\bpick\s+your\s+card\b|\bmultiple\s+cards?\b/i.test(t);
}
function isExplicitTeamCardListing(title) {
  const text = String(title || "");
  const labeledTeamCard = /\bteam\b[\s:./\-–—]+(?:photo[\s:./\-–—]+)?(?:cards?|checklists?)\b/i;
  const numberedTeamCard = /\bteam\b[\s:./\-–—]*(?:#\s*)?\d{1,3}\b/i;
  return labeledTeamCard.test(text) || numberedTeamCard.test(text);
}
function isObviousNonTradingCardListing(title) {
  const text = String(title || "");
  const nonCardTerms = /\b(?:digital|nfts?|photos?|photographs?|photographic|pictures?|portraits?|postcards?|lithographs?|posters?|magazines?|wrappers?|empty\s+box(?:es)?|unopened\s+packs?|wax\s+packs?)\b/i;
  const photoPrintWording = /\b(?:glossy|matte)\s+(?:photo\s+)?(?:re)?prints?\b|\b(?:re)?prints?\s+on\s+(?:photo|photographic)\s+paper\b/i;
  const displayDimensions = /(?:^|[^\d.])(?:4\s*[x×]\s*6|5\s*[x×]\s*7|8\s*[x×]\s*10|8\s*\.\s*5\s*[x×]\s*11|11\s*[x×]\s*14|16\s*[x×]\s*20)(?:[^\d]|$)/i;
  return nonCardTerms.test(text) || photoPrintWording.test(text) || displayDimensions.test(text);
}
function isReasonableSoldDate(v, requireDate=false){
  if(!v)return !requireDate;
  const n=Date.parse(v);
  if(!Number.isFinite(n))return !requireDate;
  // Allow a little clock/time-zone slop, but never accept a sale dated in the future.
  return n <= Date.now() + 36*60*60*1000;
}
function uniqueStrings(items){
  const seen=new Set();
  return items.filter(Boolean).filter(x=>{const k=String(x);if(seen.has(k))return false;seen.add(k);return true;});
}
function dedupe(items){
  const seen=new Set();return items.filter(x=>{const k=x.id||`${x.title}|${x.price}`;if(seen.has(k))return false;seen.add(k);return true;});
}
function dedupeSoldComps(items){
  const seen=new Set();
  const out=[];
  for(const item of items){
    const ebayId=extractEbayItemId(item?.id)||extractEbayItemId(item?.link);
    const date=String(item?.soldDate||"").slice(0,10);
    const fallback=`${normalizeText(item?.title)}|${Number(item?.price)||""}|${date}`;
    const key=ebayId?`ebay:${ebayId}`:fallback;
    if(!key||seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
function removePriceOutliers(items){
  if(items.length<6)return items;
  const prices=items.map(x=>x.price).sort((a,b)=>a-b);
  const q1=quantile(prices,.25), q3=quantile(prices,.75), iqr=q3-q1;
  if(!Number.isFinite(iqr)||iqr<=0)return items;
  const lo=Math.max(0,q1-1.5*iqr), hi=q3+1.5*iqr;
  const kept=items.filter(x=>x.price>=lo&&x.price<=hi);
  return kept.length>=3?kept:items;
}
function summarize(prices){
  if(!prices.length)return {median:null,low:null,high:null,min:null,max:null};
  return {median:round2(quantile(prices,.5)),low:round2(quantile(prices,.25)),high:round2(quantile(prices,.75)),min:round2(prices[0]),max:round2(prices[prices.length-1])};
}
function quantile(arr,q){
  if(!arr.length)return null; const pos=(arr.length-1)*q,base=Math.floor(pos),rest=pos-base;
  return arr[base+1]!==undefined?arr[base]+rest*(arr[base+1]-arr[base]):arr[base];
}

function sourceBucket(source) {
  const s = String(source || "").toLowerCase();
  if (s.includes("serp")) return "SerpApi";
  if (s.includes("apify")) return "Apify";
  if (s.includes("best offer")) return "Best Offer recovery";
  if (s.includes("card api")) return "The Card API";
  return source ? String(source) : "Unknown";
}

function medianOfNumbers(values) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  return nums.length ? round2(quantile(nums, .5)) : null;
}

function explainExperimentalConfidence(result, card) {
  const comps = Array.isArray(result?.comps) ? result.comps : [];
  const n = Number(result?.used || comps.length || 0);
  const median = Number(result?.median);
  const low = Number(result?.low);
  const high = Number(result?.high);
  const spread = Number.isFinite(median) && median > 0 && Number.isFinite(low) && Number.isFinite(high)
    ? (high - low) / median
    : Infinity;

  // Market evidence score: 100 points total. PSA verification is deliberately
  // excluded; it establishes identity, not the strength of sold-price evidence.
  let countScore = 0;
  if (n >= 8) countScore = 35;
  else if (n >= 6) countScore = 31;
  else if (n >= 4) countScore = 26;
  else if (n === 3) countScore = 20;
  else if (n === 2) countScore = 12;

  let consistencyScore = 0;
  if (spread <= .25) consistencyScore = 35;
  else if (spread <= .50) consistencyScore = 30;
  else if (spread <= .75) consistencyScore = 23;
  else if (spread <= 1.00) consistencyScore = 16;
  else if (spread <= 1.50) consistencyScore = 8;
  else if (Number.isFinite(spread)) consistencyScore = 3;

  const groups = {};
  for (const comp of comps) {
    const bucket = sourceBucket(comp?.source);
    if (bucket === "Best Offer recovery" || bucket === "Unknown") continue;
    if (!groups[bucket]) groups[bucket] = [];
    if (Number.isFinite(Number(comp?.price))) groups[bucket].push(Number(comp.price));
  }
  const sourceMedians = Object.fromEntries(
    Object.entries(groups).map(([name, prices]) => [name, { count: prices.length, median: medianOfNumbers(prices) }])
  );
  const corroborating = Object.entries(sourceMedians).filter(([,v]) => v.count >= 1 && Number.isFinite(v.median));

  let agreementScore = 0;
  let agreementText = "No usable retrieval-source comparison.";
  let agreementGapPct = null;
  if (corroborating.length >= 2) {
    const a = corroborating[0][1].median;
    const b = corroborating[1][1].median;
    const midpoint = (a + b) / 2;
    const gap = midpoint > 0 ? Math.abs(a - b) / midpoint : Infinity;
    agreementGapPct = Number.isFinite(gap) ? Math.round(gap * 1000) / 10 : null;
    if (gap <= .10) agreementScore = 20;
    else if (gap <= .20) agreementScore = 16;
    else if (gap <= .35) agreementScore = 10;
    else if (gap <= .50) agreementScore = 5;
    else agreementScore = 0;
    agreementText = `The first two retrieval-source medians differ by ${agreementGapPct ?? "?"}%.`;
  } else if (corroborating.length === 1) {
    agreementScore = 8;
    agreementText = "Only one retrieval source contributed usable comps, so cross-source agreement is unknown.";
  }

  const recovered = Number(result?.bestOfferRecovered || 0);
  const attempted = Number(result?.bestOfferRecoveryAttempted || 0);
  const transactionScore = recovered >= 2 ? 10 : recovered === 1 ? 6 : 0;

  const marketScore = Math.max(0, Math.min(100, countScore + consistencyScore + agreementScore + transactionScore));

  // High confidence must be earned, not merely crossed numerically.
  // Route A: 8+ comps with solid price consistency.
  // Route B: 6+ comps with solid consistency AND strong cross-source corroboration.
  const highGateA = n >= 8 && consistencyScore >= 23;
  const highGateB = n >= 6 && consistencyScore >= 23 && agreementScore >= 16;
  const highGatePassed = highGateA || highGateB;
  const proposedMarketLevel =
    marketScore >= 78 && highGatePassed ? "high" :
    marketScore >= 45 ? "medium" :
    "low";

  let highGateReason = "";
  if (highGatePassed) {
    highGateReason = highGateA
      ? "High-confidence safeguard passed: 8+ comps with solid price consistency."
      : "High-confidence safeguard passed: 6+ comps with solid price consistency and strong retrieval-source agreement.";
  } else if (marketScore >= 78) {
    highGateReason = "Score reached the High range, but Scout held it at Medium because the High-confidence evidence safeguard was not met.";
  }

  // Identity is scored separately so a verified PSA cert never inflates the
  // market-price evidence score.
  let identityScore = 0;
  const identityReasons = [];
  if (String(card?.player || "").trim()) { identityScore += 15; identityReasons.push("player supplied"); }
  if (Number.isInteger(Number(card?.year))) { identityScore += 15; identityReasons.push("year supplied"); }
  if (String(card?.set || "").trim()) { identityScore += 15; identityReasons.push("set supplied"); }
  if (String(card?.cardNum || "").trim()) { identityScore += 15; identityReasons.push("card number supplied"); }
  if (String(card?.grader || "").trim()) { identityScore += 10; identityReasons.push("grader/raw state supplied"); }
  if (result?.matchMode === "strict") { identityScore += 20; identityReasons.push("strict title/card match"); }
  else if (result?.matchMode === "relaxed") { identityScore += 8; identityReasons.push("relaxed title/card match"); }
  if (card?.psaVerified === true) { identityScore += 10; identityReasons.push("PSA cert verified"); }
  identityScore = Math.min(100, identityScore);
  const identityLevel = identityScore >= 85 ? "high" : identityScore >= 65 ? "medium" : "low";

  const reasons = [
    `${n} clean sold comp${n === 1 ? "" : "s"}.`,
    Number.isFinite(spread) ? `Middle-50% price spread is ${Math.round(spread * 100)}% of the median.` : "Price spread could not be calculated.",
    agreementText,
    recovered > 0
      ? `${recovered} negotiated Best Offer price${recovered === 1 ? "" : "s"} recovered and confirmed.`
      : attempted > 0
        ? `${attempted} Best Offer recovery attempt${attempted === 1 ? "" : "s"}; none confirmed.`
        : "No Best Offer recovery evidence in this valuation.",
    ...(highGateReason ? [highGateReason] : []),
  ];

  return {
    market: {
      score: marketScore,
      proposedLevel: proposedMarketLevel,
      currentLevel: result?.confidence || "unknown",
      components: {
        compCount: { score: countScore, max: 35, count: n },
        priceConsistency: { score: consistencyScore, max: 35, iqrToMedian: Number.isFinite(spread) ? Math.round(spread * 1000) / 1000 : null },
        retrievalSourceAgreement: { score: agreementScore, max: 20, medianGapPct: agreementGapPct, sources: sourceMedians },
        confirmedBestOfferPricing: { score: transactionScore, max: 10, attempted, recovered },
      },
      highConfidenceSafeguard: {
        passed: highGatePassed,
        route: highGateA ? "8+ solid comps" : highGateB ? "6+ solid comps + strong source agreement" : null,
        reason: highGateReason || "Not applicable below the High score range.",
      },
      reasons,
    },
    identity: {
      score: identityScore,
      level: identityLevel,
      psaVerified: card?.psaVerified === true,
      reasons: identityReasons,
      note: "Identity confidence is intentionally separate and does not raise the market-price score.",
    },
    verdictImpact: "Official confidence label only — BUY/NEGOTIATE/PASS pricing thresholds are unchanged.",
  };
}

function confidenceFor(items,stats,card){
  const n=items.length;if(n<2)return "insufficient";
  const spread=stats.median?((stats.high-stats.low)/stats.median):Infinity;
  const core=Boolean(card.cardNum)&&Boolean(card.year)&&Boolean(card.set);
  if(n>=8&&spread<=.55&&core)return "high";
  // Four clean comps qualify for Medium only when the middle 50% of prices
  // are reasonably consistent. A very wide spread stays Low so Deep Mode
  // can ask the Apify/Best-Offer backup for more evidence.
  if(n>=4&&spread<=1.0)return "medium";
  return "low";
}
function verdictTier(shop,median,low,high,confidence){
  if(!Number.isFinite(shop)||shop<=0||!Number.isFinite(median)||confidence==="insufficient")return "value_only";
  const ratio=shop/median;
  if(ratio<=.65 || (low&&shop<=low*.82))return "steal";
  if(ratio<=.82)return "great_buy";
  if(ratio<=.98)return "good_buy";
  if(ratio<=1.10)return "fair";
  if(ratio<=1.25)return "high";
  return "walk";
}
function buildNotes(card,searched,matched,used,confidence){
  const notes=[];
  if(searched&&!matched)notes.push("Sold results were found, but none passed Scout’s card-matching rules.");
  if(used<4)notes.push("Few close comps were available, so treat the estimate cautiously.");
  if(confidence==="low"&&used>=4)notes.push("Scout found enough comps by count, but their prices are too spread out for Medium confidence. Deep Mode can check the backup source for more evidence.");
  if(canonicalGrader(card.grader)==="Raw"&&String(card.grade||"").trim())notes.push("Raw-card condition is hard to normalize from listing titles; condition can move the real value materially.");
  if(confidence==="insufficient")notes.push("Scout needs at least two usable sold comps before calling a median trustworthy.");
  return notes;
}
function dateValue(v){const n=Date.parse(v||"");return Number.isFinite(n)?n:0;}
function round2(n){return Number.isFinite(n)?Math.round((n+Number.EPSILON)*100)/100:null;}
function escapeRegExp(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");}
