/**
 * Oslo Børs coverage list: large and well-known companies on the Oslo
 * Stock Exchange (Yahoo Finance ".OL" symbols, all verified against Yahoo
 * when this list was written). The daily trending-worker onboards the ones
 * that aren't on the watchlist yet, a few per run, so Norwegian investors
 * find their home market on Sievoo - not just US trending names.
 *
 * Override without a deploy by setting OSLO_TICKERS to a comma-separated
 * list (e.g. "EQNR.OL,DNB.OL").
 */
const DEFAULT_OSLO_TICKERS = [
  "EQNR.OL", // Equinor
  "DNB.OL", // DNB Bank
  "NHY.OL", // Norsk Hydro
  "MOWI.OL", // Mowi
  "TEL.OL", // Telenor
  "ORK.OL", // Orkla
  "YAR.OL", // Yara International
  "AKRBP.OL", // Aker BP
  "SALM.OL", // SalMar
  "KOG.OL", // Kongsberg Gruppen
  "STB.OL", // Storebrand
  "GJF.OL", // Gjensidige Forsikring
  "SUBC.OL", // Subsea 7
  "TOM.OL", // Tomra Systems
  "NOD.OL", // Nordic Semiconductor
  "FRO.OL", // Frontline
  "AKER.OL", // Aker
  "VAR.OL", // Vår Energi
  "BAKKA.OL", // Bakkafrost
  "AUTO.OL", // AutoStore
  "HAFNI.OL", // Hafnia
  "VEI.OL", // Veidekke
  "KIT.OL", // Kitron
  "ENTRA.OL", // Entra
  "ELK.OL", // Elkem
  "NAS.OL", // Norwegian Air Shuttle
  "MPCC.OL", // MPC Container Ships
  "AKSO.OL", // Aker Solutions
  "BWLPG.OL", // BW LPG
  "WAWI.OL", // Wallenius Wilhelmsen
  "TGS.OL", // TGS
  "PROT.OL", // Protector Forsikring
  "LSG.OL", // Lerøy Seafood
  "EPR.OL", // Europris
  "AFG.OL", // AF Gruppen
  "BRG.OL", // Borregaard
  "ATEA.OL", // Atea
];

export function getOsloTickers(): string[] {
  const override = process.env.OSLO_TICKERS;
  if (override?.trim()) {
    return override
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => /^[A-Z0-9-]{1,10}\.OL$/.test(t));
  }
  return DEFAULT_OSLO_TICKERS;
}
