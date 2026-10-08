/** Archived eCourts relay Worker. Deliberately disabled; never forwards requests. */
export default {
  async fetch() {
    return new Response(JSON.stringify({
      error: "legacy_ecourts_relay_disabled",
      message: "Use the eCourtsIndia Partner API integration in LitigaForge AI.",
    }), {
      status: 410,
      headers: { "Content-Type": "application/json" },
    });
  },
};
