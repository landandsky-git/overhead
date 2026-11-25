// Automatic checks of the app's astronomy and data handling against reference values.
// Runs in a browser (tests/index.html) and with Node (tests/run-node.js), which the GitHub workflow
// uses before publishing: if a check fails, the site isn't updated.
// Needs lib/satellite.min.js, codes.js, sky-data.js, js/state.js, js/data.js and js/astro.js loaded first.
(function (root) {
  "use strict";
  // NASA JPL Horizons (ssd.jpl.nasa.gov): geocentric apparent RA and Dec in degrees, and visual magnitude.
  const REF = {
    "2026-10-31T00:00:00Z": {
      Sun: [215.22144, -14.03771], Moon: [104.73946, 26.26214],
      Mercury: [224.70302, -18.86828, 2.581], Venus: [202.91903, -15.06966, -4.095], Mars: [141.06139, 16.90225, 0.802],
      Jupiter: [146.74208, 14.10186, -1.998], Saturn: [9.64717, 1.23405, 0.457],
    },
    "2027-06-15T00:00:00Z": {
      Sun: [83.14885, 23.28766], Moon: [213.27206, -18.78771],
      Mercury: [96.13017, 21.38174, 3.392], Venus: [66.26078, 20.85334, -3.874], Mars: [165.43902, 7.26379, 0.838],
      Jupiter: [145.0996, 14.91697, -1.86], Saturn: [24.35774, 7.60895, 0.653],
    },
  };
  // Angle between two sky positions, in arcminutes.
  function sepArcmin(ra1, dec1, ra2, dec2) {
    const r = Math.PI / 180;
    const c = Math.sin(dec1 * r) * Math.sin(dec2 * r) + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.cos((ra1 - ra2) * r);
    return Math.acos(Math.min(1, Math.max(-1, c))) / r * 60;
  }
  const deg = rad => ((rad * 180 / Math.PI) + 360) % 360;

  function runChecks() {
    const results = [], check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail || "" });

    // --- Sun, Moon and planets against NASA ---
    for (const [when, ref] of Object.entries(REF)) {
      const date = new Date(when), day = when.slice(0, 10);
      const sun = sunPos(date), sSep = sepArcmin(deg(sun.ra), sun.dec * 180 / Math.PI, ref.Sun[0], ref.Sun[1]);
      check(`Sun position ${day}`, sSep < 3, `${sSep.toFixed(1)}′ off`);
      const moon = moonPos(date), mSep = sepArcmin(deg(moon.ra), moon.dec * 180 / Math.PI, ref.Moon[0], ref.Moon[1]);
      check(`Moon position ${day}`, mSep < 2, `${mSep.toFixed(2)}′ off`);   // eclipses need it within an arcminute or two
      for (const p of planetPositions(date)) {
        const [ra, dec, mag] = ref[p.name], sep = sepArcmin(deg(p.ra), p.dec * 180 / Math.PI, ra, dec);
        check(`${p.name} position ${day}`, sep < 10, `${sep.toFixed(1)}′ off`);
        // Saturn's rings, which the simple formula leaves out, add up to about half a magnitude
        check(`${p.name} brightness ${day}`, Math.abs(p.mag - mag) < (p.name === "Saturn" ? 0.6 : 0.35), `${p.mag.toFixed(2)} vs ${mag}`);
      }
    }

    // --- CelesTrak CSV to two-line orbit text: must match CelesTrak's own text exactly ---
    const csv = "OBJECT_NAME,OBJECT_ID,EPOCH,MEAN_MOTION,ECCENTRICITY,INCLINATION,RA_OF_ASC_NODE,ARG_OF_PERICENTER,MEAN_ANOMALY,EPHEMERIS_TYPE,CLASSIFICATION_TYPE,NORAD_CAT_ID,ELEMENT_SET_NO,REV_AT_EPOCH,BSTAR,MEAN_MOTION_DOT,MEAN_MOTION_DDOT\n" +
      "ISS (ZARYA),1998-067A,2026-10-30T11:12:14.281344,15.49116094,.00070603,51.6332,350.6604,327.9433,32.1125,0,U,25544,999,59272,.136016E-3,.7083E-4,0\n" +
      '"TEST, WITH COMMA",2026-204AA,2026-10-30T18:56:42.743040,15.79121022,.0001064,53.1600,349.0643,329.1654,30.8918,0,U,100639,12,58,-.1413E-4,-.7378E-5,0';
    const sats = parseOrbits(csv);
    check("CSV detected as CelesTrak format", isOMM(csv));
    check("CSV row with a comma in the name", sats.length === 2 && sats[1].name === "TEST, WITH COMMA", sats[1] && sats[1].name);
    check("ISS line 1 matches CelesTrak", sats[0].l1 === "1 25544U 98067A   26303.46683196  .00007083  00000+0  13602-3 0  9999", sats[0].l1);
    check("ISS line 2 matches CelesTrak", sats[0].l2 === "2 25544  51.6332 350.6604 0007060 327.9433  32.1125 15.49116094592729", sats[0].l2);
    const rec = satellite.twoline2satrec(sats[1].l1, sats[1].l2), pv = satellite.propagate(rec, new Date("2026-10-31T00:00:00Z"));
    const alt = pv.position && Math.hypot(pv.position.x, pv.position.y, pv.position.z) - 6378;
    check("Satellite numbered above 99999 can be tracked", rec.error === 0 && alt > 300 && alt < 500, alt && `${alt.toFixed(0)} km up`);

    // --- catalog numbers above 99999 ("Alpha-5") ---
    check("Catalog number 100639 written as A0639", toAlpha5(100639) === "A0639");
    check("A0639 read back as 100639", fromAlpha5("A0639") === 100639);
    check("Letters I and O are skipped", toAlpha5(180000) === "J0000" && fromAlpha5("J8000") === 188000 && toAlpha5(339999) === "Z9999");
    check("Small numbers stay as digits", toAlpha5(5) === "00005" && fromAlpha5("25544") === 25544);

    // --- brightness ---
    // ISS (standard magnitude -1.3) 420 km straight up, half lit: -1.3 + 5*log10(0.42) = -3.18
    const m = magnitude(-1.3, { x: 6791, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 6371, y: 0, z: 0 }, 420, 90);
    check("ISS overhead, half lit, is magnitude -3.2", Math.abs(m + 3.18) < 0.05, m.toFixed(2));
    const full = magnitude(-1.3, { x: 6791, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 6371, y: 0, z: 0 }, 420, 90);
    check("Fully lit is brighter than half lit", full < m, `${full.toFixed(2)} vs ${m.toFixed(2)}`);
    const low = magnitude(-1.3, { x: 6791, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 6371, y: 0, z: 0 }, 420, 5);
    check("Haze near the horizon dims it", low > m, `${low.toFixed(2)} vs ${m.toFixed(2)}`);

    // --- how faint you can see ---
    const keep = S.limit;
    S.limit = 4.5;
    check("Dark moonless sky gives your sky setting", skyLimitAt(-30, -10, 1) === 4.5);
    check("Twilight lowers the limit", skyLimitAt(-10, -10, 0) < skyLimitAt(-16, -10, 0) && skyLimitAt(-16, -10, 0) < 4.5);
    check("A full Moon high up lowers it", skyLimitAt(-30, 50, 1) < 4.5);
    check("A Moon below the horizon doesn't", skyLimitAt(-30, -5, 1) === 4.5);
    S.limit = keep;

    // --- star catalog ---
    const sirius = CATALOG.stars.find(s => s.name === "Sirius");
    check("Star catalog loaded", CATALOG.stars.length >= 500, `${CATALOG.stars.length} stars`);
    check("Sirius is the brightest star", sirius && sirius.mag < -1 && CATALOG.stars.every(s => s.mag >= sirius.mag));
    check("Constellation outlines loaded", CATALOG.lines.length >= 80, `${CATALOG.lines.length} segments`);

    // --- satellite passes against Skyfield, an independent astronomy library (tests/pass-reference.js) ---
    // The app looks every 30 seconds and works out the exact moments in between: rise, highest point
    // and setting should be within 5 seconds of Skyfield's, and the highest point within 0.1°.
    if (typeof PASS_REFERENCE !== "undefined") {
      const ref = PASS_REFERENCE, keepLoc = S.loc;
      S.loc = { lat: ref.place.lat, lon: ref.place.lon, h: ref.place.h };
      const app = passesFor({ id: "25544", l1: ref.l1, l2: ref.l2, m0: -1.3 }, Date.parse(ref.start));
      S.loc = keepLoc;
      const want = ref.passes.slice(0, app.length >= 8 ? 8 : ref.passes.length);
      let worst = { rise: 0, set: 0, max: 0, el: 0 }, matched = 0;
      for (const r of want) {
        const p = app.find(a => Math.abs(a.start - r.rise) < 120e3);
        if (!p) continue;
        const rise = (p.start - r.rise) / 1000, set = (r.set - p.end) / 1000, max = Math.abs(p.maxTime - r.max) / 1000, el = Math.abs(p.maxEl - r.maxEl);
        if (Math.abs(rise) <= 5 && Math.abs(set) <= 5 && max <= 5 && el <= 0.1) matched++;
        worst = { rise: Math.max(worst.rise, Math.abs(rise)), set: Math.max(worst.set, Math.abs(set)), max: Math.max(worst.max, max), el: Math.max(worst.el, el) };
      }
      check("ISS passes match Skyfield", app.length >= 8 && matched === want.length,
        `${matched} of ${want.length} passes; worst: rise ${worst.rise.toFixed(0)} s, set ${worst.set.toFixed(0)} s, peak ${worst.max.toFixed(0)} s and ${worst.el.toFixed(2)}°`);
    }

    // --- the night-sky guide (js/skyguide.js) ---
    if (typeof cometAt === "function") {
      // C/2023 A3 (Tsuchinshan-ATLAS) on 2024-10-14 00:00 UT; NASA JPL Horizons: RA 219.3349°, Dec -0.2690° (J2000),
      // 0.5807 AU from the Sun and 0.4771 AU from Earth. Orbit from JPL's Small-Body Database.
      const d = new Date("2024-10-14T00:00:00Z"), c = { e: 1.0001, q: 0.391, i: 139.11, om: 21.56, w: 308.49, tp: 2460581.24, M1: 8.9, K1: 5.5 };
      const p = cometAt(c, d), e = eqToEcl(p.ra, p.dec), j = eclToEq(e.lon - precession(d), e.lat), rad = Math.PI / 180;
      const off = Math.acos(Math.sin(j.dec) * Math.sin(-0.2690 * rad) + Math.cos(j.dec) * Math.cos(-0.2690 * rad) * Math.cos(j.ra - 219.3349 * rad)) / rad * 60;
      check("Comet position matches NASA Horizons", off < 12 && Math.abs(p.r - 0.5807) < 0.002 && Math.abs(p.delta - 0.4771) < 0.002,
        `${off.toFixed(1)}′ off, ${p.r.toFixed(4)} and ${p.delta.toFixed(4)} AU`);
      const gem = SHOWERS.find(s => s[0] === "Geminids"), qua = SHOWERS.find(s => s[0] === "Quadrantids");
      const g = showerAt(gem, Date.UTC(2026, 11, 14, 22)), q1 = showerAt(qua, Date.UTC(2026, 11, 30, 22)), q2 = showerAt(qua, Date.UTC(2027, 0, 3, 22));
      check("Meteor showers: Geminids peak on 14 December", g.active && Math.abs(g.days) < 1 && g.zhr > 100, `${g.days.toFixed(1)} days, rate ${g.zhr.toFixed(0)}`);
      check("Meteor showers: Quadrantids across New Year", q1.active && q1.days < 0 && q2.active && Math.abs(q2.days) < 1);
      check("Meteor showers: none of them active in mid-June", SHOWERS.every(s => !showerAt(s, Date.UTC(2027, 5, 15, 22)).active));
      // The partial solar eclipse of 12 August 2026 seen from Rastatt: about 85-90% of the Sun covered
      // a little after 20:00 local time, with the Sun low in the west.
      const keepLoc = S.loc;
      S.loc = { lat: 48.8585, lon: 8.2033, h: 120 };
      const ecl = eclipseHere({ kind: "S", type: "T", t: Date.parse("2026-08-12T17:46:06Z") - 70e3 });
      S.loc = keepLoc;
      check("Solar eclipse of 12 Aug 2026 from Rastatt", ecl && ecl.cov > 0.8 && ecl.cov < 0.95 && Math.abs(ecl.t - Date.parse("2026-08-12T18:15:00Z")) < 20 * 60e3,
        ecl ? `${Math.round(ecl.cov * 100)}% covered at ${new Date(ecl.t).toISOString().slice(11, 16)} UT` : "not seen");
    }

    return results;
  }
  root.runChecks = runChecks;
})(typeof window !== "undefined" ? window : globalThis);
