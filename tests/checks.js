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
      check(`Moon position ${day}`, mSep < 25, `${mSep.toFixed(1)}′ off`);
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

    return results;
  }
  root.runChecks = runChecks;
})(typeof window !== "undefined" ? window : globalThis);
