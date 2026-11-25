// Lookup tables for the satellite details panel.
// OWNERS and SITES are CelesTrak SATCAT codes (celestrak.org/satcat/sources.php, launchsites.php).
// OPERATORS maps satellite-name patterns to the company or agency that runs them.
window.SAT_CODES = {
  OWNERS: {"AB":"Arab Satellite Communications Organization","ABS":"Asia Broadcast Satellite","AC":"Asia Satellite Telecommunications Company (ASIASAT)","ALG":"Algeria","ANG":"Angola","ARGN":"Argentina","ARM":"Republic of Armenia","ASRA":"Austria","AUS":"Australia","AZER":"Azerbaijan","BEL":"Belgium","BELA":"Belarus","BERM":"Bermuda","BGD":"Peoples Republic of Bangladesh","BHR":"The Kingdom of Bahrain","BHUT":"The Kingdom of Bhutan","BOL":"Bolivia","BRAZ":"Brazil","BUL":"Bulgaria","BWA":"Republic of Botswana","CA":"Canada","CHBZ":"China/Brazil","CHTU":"China/Türkiye","CHLE":"Chile","CIS":"Commonwealth of Independent States (former USSR)","COL":"Colombia","CRI":"Republic of Costa Rica","CZCH":"Czech Republic (former Czechoslovakia)","DEN":"Denmark","DJI":"Republic of Djibouti","ECU":"Ecuador","EGYP":"Egypt","ESA":"European Space Agency","ESRO":"European Space Research Organization","EST":"Estonia","ETH":"Ethiopia","EUME":"European Organization for the Exploitation of Meteorological Satellites (EUMETSAT)","EUTE":"European Telecommunications Satellite Organization (EUTELSAT)","FGER":"France/Germany","FIN":"Finland","FR":"France","FRIT":"France/Italy","GER":"Germany","GHA":"Republic of Ghana","GLOB":"Globalstar","GREC":"Greece","GRSA":"Greece/Saudi Arabia","GUAT":"Guatemala","HRV":"Republic of Croatia","HUN":"Hungary","IM":"International Mobile Satellite Organization (INMARSAT)","IND":"India","INDO":"Indonesia","IRAN":"Iran","IRAQ":"Iraq","IRID":"Iridium","IRL":"Ireland","ISRA":"Israel","ISRO":"Indian Space Research Organisation","ISS":"International Space Station","IT":"Italy","ITSO":"International Telecommunications Satellite Organization (INTELSAT)","JPN":"Japan","KAZ":"Kazakhstan","KEN":"Republic of Kenya","LAOS":"Laos","LKA":"Democratic Socialist Republic of Sri Lanka","LTU":"Lithuania","LUXE":"Luxembourg","MA":"Morocco","MALA":"Malaysia","MCO":"Principality of Monaco","MDA":"Republic of Moldova","MEX":"Mexico","MMR":"Republic of the Union of Myanmar","MNE":"Montenegro","MNG":"Mongolia","MUS":"Mauritius","NATO":"North Atlantic Treaty Organization","NETH":"Netherlands","NICO":"New ICO","NIG":"Nigeria","NKOR":"Democratic People's Republic of Korea","NOR":"Norway","NPL":"Federal Democratic Republic of Nepal","NZ":"New Zealand","O3B":"O3b Networks","ORB":"ORBCOMM","PAKI":"Pakistan","PERU":"Peru","POL":"Poland","POR":"Portugal","PRC":"People's Republic of China","PRY":"Republic of Paraguay","PRES":"People's Republic of China/European Space Agency","QAT":"State of Qatar","RASC":"RascomStar-QAF","ROC":"Taiwan (Republic of China)","ROM":"Romania","RP":"Philippines (Republic of the Philippines)","RWA":"Republic of Rwanda","SAFR":"South Africa","SAUD":"Saudi Arabia","SDN":"Republic of Sudan","SEAL":"Sea Launch","SEN":"Republic of Senegal","SES":"SES","SGJP":"Singapore/Japan","SING":"Singapore","SKOR":"Republic of Korea","SLB":"Solomon Islands","SPN":"Spain","STCT":"Singapore/Taiwan","SVN":"Slovenia","SWED":"Sweden","SWTZ":"Switzerland","TBD":"To Be Determined","THAI":"Thailand","TMMC":"Turkmenistan/Monaco","TUN":"Republic of Tunisia","TURK":"Türkiye","UAE":"United Arab Emirates","UK":"United Kingdom","UKR":"Ukraine","UNK":"Unknown","URY":"Uruguay","US":"United States","USBZ":"United States/Brazil","VAT":"Vatican City State","VENZ":"Venezuela","VTNM":"Vietnam","ZWE":"Republic of Zimbabwe"},

  SITES: {"AFETR":"Cape Canaveral, Florida, USA","AFWTR":"Vandenberg, California, USA","ANDSP":"Andøya Spaceport, Norway","ALCLC":"Alcântara Launch Center, Brazil","BOS":"Bowen Orbital Spaceport, Australia","CAS":"Canaries Airspace (air launch)","DLS":"Dombarovskiy, Russia","ERAS":"Eastern Range Airspace (air launch), USA","FRGUI":"Europe's Spaceport, Kourou, French Guiana","HGSTR":"Hammaguira, Algeria","JJSLA":"Jeju Island Sea Launch Area, South Korea","JSC":"Jiuquan Satellite Launch Center, China","KODAK":"Kodiak, Alaska, USA","KSCUT":"Uchinoura Space Center, Japan","KWAJ":"Kwajalein Atoll, Marshall Islands","KYMSC":"Kapustin Yar, Russia","NSC":"Naro Space Center, South Korea","PLMSC":"Plesetsk Cosmodrome, Russia","RLLB":"Rocket Lab Launch Complex, Mahia, New Zealand","SCSLA":"South China Sea Launch Area, China","SEAL":"Sea Launch platform, Pacific Ocean","SEMLS":"Semnan, Iran","SMTS":"Shahrud, Iran","SNMLP":"San Marco Platform, Kenya","SPKII":"Spaceport Kii, Japan","SRILR":"Satish Dhawan Space Centre, Sriharikota, India","STARB":"Starbase, Texas, USA","SUBL":"Submarine launch","SVOBO":"Svobodny, Russia","TAISC":"Taiyuan Satellite Launch Center, China","TANSC":"Tanegashima Space Center, Japan","TYMSC":"Baikonur Cosmodrome, Kazakhstan","UNK":"Unknown","VOSTO":"Vostochny Cosmodrome, Russia","WLPIS":"Wallops Island, Virginia, USA","WOMRA":"Woomera, Australia","WRAS":"Western Range Airspace (air launch), USA","WSC":"Wenchang Space Launch Site, China","XICLF":"Xichang Satellite Launch Center, China","YAVNE":"Palmachim / Yavne, Israel","YSLA":"Yellow Sea Launch Area, China","YUN":"Sohae Satellite Launching Station, North Korea"},

  TYPES: { PAY: "Payload (working spacecraft)", "R/B": "Rocket stage", DEB: "Debris", UNK: "Unknown" },

  // Typical ("standard") brightness: the magnitude a satellite would have 1,000 km away and half lit.
  // Lower is brighter. Used when data/mags.json has no measured value for a satellite.
  // [pattern, magnitude, sure]: "sure" entries come from published measurements of that satellite
  // family and also win over the rougher estimate from radar size. First match wins.
  // Starlink is handled separately by generation and orbit (starlinkMag in js/data.js).
  STD_MAG: [
    [/^ISS( \(|$)/, -1.3, true],
    [/^(CSS \(|TIANHE|TIANGONG)/, -0.5, true],
    [/^ISS OBJECT/, 8.0, true],   // small satellites released from the station
    [/^(BLUEBIRD|BLUEWALKER|SPACEMOBILE)/, 2.5, true],
    [/^KUIPER/, 5.5, true],
    [/^ONEWEB/, 7.0, true],
    [/^(FLOCK|DOVE|SUPERDOVE|LEMUR|SPACEBEE|TIANQI)/, 8.0, true],
    [/^SL-16 R\/B/, 3.2],
    [/^(SL-14|SL-3) R\/B/, 4.5],
    [/^(H-2A|H-IIA|ARIANE|FALCON 9)/, 4.5],
    [/R\/B/, 5.0],
    [/ DEB/, 7.0],
    [/^ORBCOMM/, 6.5],
    [/^(YAOGAN|NOAA|METOP|FENGYUN|FY-)/, 4.5],
    [/^(COSMOS|IRIDIUM|GLOBALSTAR)/, 5.0],
    [/^(NAVSTAR|GPS |GSAT0|GALILEO|BEIDOU)|GLONASS/, 4.0],
  ],

  // [pattern, operator, what it does]. First match wins.
  OPERATORS: [
    [/^STARLINK/, "SpaceX", "Starlink satellite internet"],
    [/^ONEWEB/, "Eutelsat OneWeb", "Satellite internet"],
    [/^KUIPER/, "Amazon (Project Kuiper)", "Satellite internet"],
    [/^(QIANFAN|SPACESAIL)/, "Spacesail (Shanghai)", "Satellite internet"],
    [/^(GUOWANG|SATNET|HULIANWANG)/, "China SatNet", "Satellite internet"],
    [/^IRIDIUM/, "Iridium Communications", "Satellite phones and data"],
    [/^GLOBALSTAR/, "Globalstar", "Satellite phones and data"],
    [/^ORBCOMM/, "ORBCOMM", "Machine-to-machine messaging"],
    [/^SPACEBEE/, "Swarm Technologies (SpaceX)", "Low-cost IoT messaging"],
    [/^(BLUEBIRD|BLUEWALKER|SPACEMOBILE)/, "AST SpaceMobile", "Direct-to-phone broadband"],
    [/^LYNK/, "Lynk Global", "Direct-to-phone messaging"],
    [/^TIANQI/, "Guodian Gaoke", "IoT messaging"],
    [/^(FLOCK|DOVE|SUPERDOVE|SKYSAT|PELICAN|TANAGER)/, "Planet Labs", "Earth imaging"],
    [/^LEMUR/, "Spire Global", "Weather and ship/aircraft tracking"],
    [/^ICEYE/, "ICEYE", "Radar imaging"],
    [/^CAPELLA/, "Capella Space", "Radar imaging"],
    [/^(WORLDVIEW|GEOEYE|WV LEGION|LEGION)/, "Maxar (Vantor)", "High-resolution imaging"],
    [/^JILIN/, "Chang Guang Satellite Technology", "Earth imaging"],
    [/^HAWK/, "HawkEye 360", "Radio-signal mapping"],
    [/^(NAVSTAR|GPS )/, "U.S. Space Force", "GPS navigation"],
    [/GLONASS/, "Roscosmos (Russia)", "GLONASS navigation"],
    [/^(GSAT0|GALILEO)/, "European Union (EUSPA)", "Galileo navigation"],
    [/^BEIDOU/, "China Satellite Navigation Office", "BeiDou navigation"],
    [/^(QZS|MICHIBIKI)/, "Japan Cabinet Office", "QZSS navigation"],
    [/^(IRNSS|NVS)/, "ISRO (India)", "NavIC navigation"],
    [/^ISS( \(|$)/, "NASA, Roscosmos, ESA, JAXA, CSA", "Crewed space station"],
    [/^ISS OBJECT/, null, "Small satellite released from the space station"],
    [/^(CSS \(|TIANHE|TIANGONG|WENTIAN|MENGTIAN)/, "China Manned Space Agency", "Crewed space station"],
    [/^(SHENZHOU|TIANZHOU)/, "China Manned Space Agency", "Crew or cargo spacecraft"],
    [/^(PROGRESS|SOYUZ)/, "Roscosmos (Russia)", "Space station crew or cargo"],
    [/^(DRAGON|CREW DRAGON|CRS-)/, "SpaceX", "Space station crew or cargo"],
    [/^CYGNUS/, "Northrop Grumman", "Space station cargo"],
    [/^(HST|HUBBLE)/, "NASA / ESA", "Hubble Space Telescope"],
    [/^(TERRA|AQUA|AURA|SMAP|ICESAT|OCO|GRACE|SWOT|JASON|SENTINEL-6|PACE|TESS|SWIFT|FERMI|NUSTAR|TIMED|LANDSAT)/, "NASA", "Science and Earth observation"],
    [/^(NOAA|GOES|JPSS|SUOMI)/, "NOAA", "Weather"],
    [/^DMSP/, "U.S. Space Force", "Military weather"],
    [/^METOP/, "EUMETSAT", "Weather"],
    [/^(FENGYUN|FY-)/, "China Meteorological Administration", "Weather"],
    [/^(METEOR|RESURS|KANOPUS)/, "Roscosmos (Russia)", "Weather and Earth observation"],
    [/^SENTINEL/, "ESA / EU Copernicus", "Earth observation"],
    [/^(ALOS|HIMAWARI|GCOM|IBUKI)/, "JAXA (Japan)", "Earth observation"],
    [/^(CARTOSAT|RISAT|OCEANSAT|RESOURCESAT|EOS-)/, "ISRO (India)", "Earth observation"],
    [/^SAOCOM/, "CONAE (Argentina)", "Radar imaging"],
    [/^YAOGAN/, "People's Liberation Army (China)", "Military reconnaissance"],
    [/^COSMOS/, "Russian government", "Mostly military"],
    [/^SKYNET/, "UK Ministry of Defence", "Military communications"],
    [/^(INTELSAT|IS-)/, "Intelsat (SES)", "Communications"],
    [/^(SES|ASTRA|O3B)/, "SES", "Communications and TV"],
    [/^EUTELSAT/, "Eutelsat", "Communications and TV"],
    [/^(TELSTAR|ANIK|NIMIQ|TELESAT)/, "Telesat", "Communications"],
    [/^(INMARSAT|I-[0-9])/, "Viasat (Inmarsat)", "Maritime and aviation communications"],
    [/^VIASAT/, "Viasat", "Satellite internet"],
    [/^(ECHOSTAR|JUPITER)/, "EchoStar / Hughes", "Satellite TV and internet"],
    [/^(DIRECTV|SIRIUS|XM-)/, "DirecTV / SiriusXM", "Satellite TV and radio"],
    [/^TDRS/, "NASA", "Data relay"],
    [/^FALCON 9/, "SpaceX", "Falcon 9 rocket stage"],
    [/^(CZ-|LONG MARCH)/, "CASC (China)", "Long March rocket stage"],
    [/^SL-/, "Soviet / Russian space program", "Rocket stage"],
    [/^(ATLAS|CENTAUR)/, "United Launch Alliance / U.S.", "Atlas / Centaur rocket stage"],
    [/^DELTA/, "United Launch Alliance / U.S.", "Delta rocket stage"],
    [/^THOR/, "U.S. Air Force", "Thor-Agena rocket stage"],
    [/^(H-2A|H-IIA|H-2B|H-3|H3)/, "Mitsubishi Heavy Industries (Japan)", "H-II / H3 rocket stage"],
    [/^(ARIANE|VEGA)/, "Arianespace (Europe)", "Rocket stage"],
    [/^(PSLV|GSLV|LVM3)/, "ISRO (India)", "Rocket stage"],
    [/^ELECTRON/, "Rocket Lab", "Electron rocket stage"],
    [/^(MINOTAUR|PEGASUS|TAURUS)/, "Northrop Grumman", "Rocket stage"],
  ],
};

// German names, used when the app runs in German (js/i18n.js loads first and sets LANG).
// Companies and agencies keep their own names; only countries, places and descriptions change.
if (typeof LANG !== "undefined" && LANG === "de") (() => {
  const C = window.SAT_CODES;
  Object.assign(C.OWNERS, {"ALG":"Algerien","ARGN":"Argentinien","ARM":"Republik Armenien","ASRA":"Österreich","AUS":"Australien","AZER":"Aserbaidschan","BEL":"Belgien","BGD":"Volksrepublik Bangladesch","BHR":"Königreich Bahrain","BHUT":"Königreich Bhutan","BOL":"Bolivien","BRAZ":"Brasilien","BUL":"Bulgarien","BWA":"Republik Botsuana","CA":"Kanada","CHBZ":"China/Brasilien","CHTU":"China/Türkei","CIS":"GUS (ehemalige Sowjetunion)","COL":"Kolumbien","CRI":"Republik Costa Rica","CZCH":"Tschechien (ehemals Tschechoslowakei)","DEN":"Dänemark","DJI":"Republik Dschibuti","EGYP":"Ägypten","ESA":"Europäische Weltraumorganisation (ESA)","ESRO":"Europäische Weltraumforschungsorganisation (ESRO)","EST":"Estland","ETH":"Äthiopien","FGER":"Frankreich/Deutschland","FIN":"Finnland","FR":"Frankreich","FRIT":"Frankreich/Italien","GER":"Deutschland","GHA":"Republik Ghana","GREC":"Griechenland","GRSA":"Griechenland/Saudi-Arabien","HRV":"Republik Kroatien","HUN":"Ungarn","IND":"Indien","INDO":"Indonesien","IRAQ":"Irak","IRL":"Irland","ISRO":"Indische Weltraumforschungsorganisation (ISRO)","ISS":"Internationale Raumstation","IT":"Italien","KAZ":"Kasachstan","KEN":"Republik Kenia","LKA":"Demokratische Sozialistische Republik Sri Lanka","LTU":"Litauen","LUXE":"Luxemburg","MA":"Marokko","MCO":"Fürstentum Monaco","MDA":"Republik Moldau","MEX":"Mexiko","MMR":"Republik der Union Myanmar","MNG":"Mongolei","NETH":"Niederlande","NKOR":"Demokratische Volksrepublik Korea (Nordkorea)","NOR":"Norwegen","NPL":"Demokratische Bundesrepublik Nepal","NZ":"Neuseeland","POL":"Polen","PRC":"Volksrepublik China","PRY":"Republik Paraguay","PRES":"Volksrepublik China/Europäische Weltraumorganisation","QAT":"Staat Katar","ROC":"Taiwan (Republik China)","ROM":"Rumänien","RP":"Philippinen","RWA":"Republik Ruanda","SAFR":"Südafrika","SAUD":"Saudi-Arabien","SDN":"Republik Sudan","SEN":"Republik Senegal","SGJP":"Singapur/Japan","SING":"Singapur","SKOR":"Republik Korea (Südkorea)","SLB":"Salomonen","SPN":"Spanien","STCT":"Singapur/Taiwan","SVN":"Slowenien","SWED":"Schweden","SWTZ":"Schweiz","TBD":"Noch offen","TMMC":"Turkmenistan/Monaco","TUN":"Republik Tunesien","TURK":"Türkei","UAE":"Vereinigte Arabische Emirate","UK":"Vereinigtes Königreich","UNK":"Unbekannt","US":"Vereinigte Staaten","USBZ":"Vereinigte Staaten/Brasilien","VAT":"Staat Vatikanstadt","ZWE":"Republik Simbabwe"});
  Object.assign(C.SITES, {"AFWTR":"Vandenberg, Kalifornien, USA","ANDSP":"Andøya Spaceport, Norwegen","ALCLC":"Raketenstartplatz Alcântara, Brasilien","BOS":"Bowen Orbital Spaceport, Australien","CAS":"Luftraum der Kanaren (Luftstart)","DLS":"Dombarowski, Russland","ERAS":"Luftraum Eastern Range (Luftstart), USA","FRGUI":"Europas Weltraumbahnhof, Kourou, Französisch-Guayana","HGSTR":"Hammaguir, Algerien","JJSLA":"Seestartgebiet Jeju, Südkorea","JSC":"Kosmodrom Jiuquan, China","KSCUT":"Raumfahrtzentrum Uchinoura, Japan","KWAJ":"Kwajalein-Atoll, Marshallinseln","KYMSC":"Kapustin Jar, Russland","NSC":"Raumfahrtzentrum Naro, Südkorea","PLMSC":"Kosmodrom Plessezk, Russland","RLLB":"Startkomplex von Rocket Lab, Mahia, Neuseeland","SCSLA":"Seestartgebiet Südchinesisches Meer, China","SEAL":"Sea-Launch-Plattform, Pazifik","SMTS":"Schahrud, Iran","SNMLP":"San-Marco-Plattform, Kenia","SPKII":"Spaceport Kii, Japan","SRILR":"Satish Dhawan Space Centre, Sriharikota, Indien","SUBL":"Start von einem U-Boot","SVOBO":"Swobodny, Russland","TAISC":"Kosmodrom Taiyuan, China","TANSC":"Raumfahrtzentrum Tanegashima, Japan","TYMSC":"Kosmodrom Baikonur, Kasachstan","UNK":"Unbekannt","VOSTO":"Kosmodrom Wostotschny, Russland","WOMRA":"Woomera, Australien","WRAS":"Luftraum Western Range (Luftstart), USA","WSC":"Kosmodrom Wenchang, China","XICLF":"Kosmodrom Xichang, China","YSLA":"Seestartgebiet Gelbes Meer, China","YUN":"Satellitenstartplatz Sohae, Nordkorea"});
  C.TYPES = { PAY: "Nutzlast (Raumfahrzeug)", "R/B": "Raketenstufe", DEB: "Trümmerteil", UNK: "Unbekannt" };
  const OP = {"U.S. Space Force":"US Space Force","Roscosmos (Russia)":"Roscosmos (Russland)","European Union (EUSPA)":"Europäische Union (EUSPA)","Japan Cabinet Office":"Kabinettsbüro Japan","ISRO (India)":"ISRO (Indien)","CONAE (Argentina)":"CONAE (Argentinien)","People's Liberation Army (China)":"Volksbefreiungsarmee (China)","Russian government":"Russische Regierung","UK Ministry of Defence":"Britisches Verteidigungsministerium","Soviet / Russian space program":"Sowjetisches / russisches Raumfahrtprogramm","United Launch Alliance / U.S.":"United Launch Alliance / USA","U.S. Air Force":"US Air Force","Arianespace (Europe)":"Arianespace (Europa)"};
  const ROLE = {"Starlink satellite internet":"Starlink-Satelliteninternet","Satellite internet":"Satelliteninternet","Satellite phones and data":"Satellitentelefonie und Daten","Machine-to-machine messaging":"Datenfunk zwischen Maschinen","Low-cost IoT messaging":"Günstiger IoT-Datenfunk","Direct-to-phone broadband":"Breitband direkt aufs Handy","Direct-to-phone messaging":"Nachrichten direkt aufs Handy","IoT messaging":"IoT-Datenfunk","Earth imaging":"Erdbilder","Weather and ship/aircraft tracking":"Wetter und Verfolgung von Schiffen und Flugzeugen","Radar imaging":"Radarbilder","High-resolution imaging":"Hochaufgelöste Bilder","Radio-signal mapping":"Kartierung von Funksignalen","GPS navigation":"GPS-Navigation","GLONASS navigation":"GLONASS-Navigation","Galileo navigation":"Galileo-Navigation","BeiDou navigation":"BeiDou-Navigation","QZSS navigation":"QZSS-Navigation","NavIC navigation":"NavIC-Navigation","Crewed space station":"Bemannte Raumstation","Small satellite released from the space station":"Von der Raumstation ausgesetzter Kleinsatellit","Crew or cargo spacecraft":"Raumschiff für Besatzung oder Fracht","Space station crew or cargo":"Besatzung oder Fracht zur Raumstation","Space station cargo":"Fracht zur Raumstation","Hubble Space Telescope":"Hubble-Weltraumteleskop","Science and Earth observation":"Forschung und Erdbeobachtung","Weather":"Wetter","Military weather":"Militärische Wetterbeobachtung","Weather and Earth observation":"Wetter und Erdbeobachtung","Earth observation":"Erdbeobachtung","Military reconnaissance":"Militärische Aufklärung","Mostly military":"Überwiegend militärisch","Military communications":"Militärische Kommunikation","Communications":"Kommunikation","Communications and TV":"Kommunikation und Fernsehen","Maritime and aviation communications":"Kommunikation für Schiff- und Luftfahrt","Satellite TV and internet":"Satellitenfernsehen und Internet","Satellite TV and radio":"Satellitenfernsehen und -radio","Data relay":"Datenrelais","Falcon 9 rocket stage":"Falcon-9-Raketenstufe","Long March rocket stage":"Langer-Marsch-Raketenstufe","Rocket stage":"Raketenstufe","Atlas / Centaur rocket stage":"Atlas-/Centaur-Raketenstufe","Delta rocket stage":"Delta-Raketenstufe","Thor-Agena rocket stage":"Thor-Agena-Raketenstufe","H-II / H3 rocket stage":"H-II-/H3-Raketenstufe","Electron rocket stage":"Electron-Raketenstufe"};
  C.OPERATORS = C.OPERATORS.map(([re, op, role]) => [re, OP[op] || op, ROLE[role] || role]);
})();
