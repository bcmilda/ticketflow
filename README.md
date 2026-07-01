# TicketFlow

Dashboard pro datově podložené rozhodování při resellingu vstupenek (koncerty, sport).

## Stack
- Firebase Hosting + Firestore + Google Auth
- Vanilla JS (ES moduly), bez buildu/bundleru
- Spotify Web API (Client Credentials Flow) — automatické načtení popularity interpreta

## Struktura
```
ticketflow/
├── index.html
├── css/style.css
├── js/
│   ├── firebase-config.js
│   ├── auth.js
│   ├── events.js
│   ├── spotify.js
│   ├── ui.js
│   └── main.js
├── firebase.json
└── .firebaserc
```

## Nasazení
1. Zkopíruj celou složku `ticketflow/` do `C:\Users\Milan\Desktop\...`
2. V terminálu ve složce projektu: `firebase deploy --only hosting`
3. Otevři `https://ticketflow-8e17a.web.app` a přihlas se přes Google

## Spotify API klíče
Klíče se **nezadávají do kódu** — po přihlášení klikni v aplikaci na ⚙ (Nastavení) a vlož tam:
- Client ID
- Client Secret

Uloží se do `users/{uid}/settings/spotify` ve Firestore (stejný princip jako FMP klíč v TradeFlow). Až je vyplníš, psaní jména interpreta do formuláře spustí automatické vyhledávání a zobrazí popularitu, followers a žánry.

> Pozn.: Client Credentials Flow běží přímo z prohlížeče, takže secret je viditelný v network requestech tvého vlastního prohlížeče (ne v kódu repozitáře). Pro osobní jednouživatelskou appku je to stejný kompromis jako u FMP klíče.

## Datový model (Firestore)
`users/{uid}/events/{eventId}` — jeden dokument = jedna sledovaná událost, pole pokrývají:
- základní info (interpret, datum, místo, kapacita)
- Spotify data (auto: popularity, followers, genres)
- oblíbenost interpreta (ruční: předchozí vyprodání, nové album, věk, cílovka)
- místo a trh (počet obyvatel, bohatství země, konkurenční akce)
- vstupenky (typ, nákupní/cílová cena)
- skutečný zájem (předprodej, fronta, mizení lístků na mapě)
- Viagogo (sledující, trend ceny, nejlevnější lístek)
- status: `watching` / `bought` / `sold` / `expired`

## Skóre atraktivity

Dvě vrstvy hodnocení, viditelné na kartách i ve formuláři události:

**1. Algoritmické skóre (0–100, okamžité, zdarma)**
Počítá se v `js/scoring.js` z strukturovaných/výběrových polí (Spotify popularity, vyprodání
minulého turné, lokální oblíbenost, bohatství země, předprodej, poměr fronty ke kapacitě, mizení
lístků, trend ceny na Viagogo, realističnost cílové ceny vůči aktuální nejlevnější nabídce).
Váhy: Oblíbenost interpreta 35 % · Místo a trh 20 % · Skutečný zájem 30 % · Sekundární trh 15 %.
Chybějící pole se z výpočtu vynechají a zbytek se přepočítá poměrově — u každého skóre proto vidíš
i „spolehlivost dat" (kolik % váhy mělo k dispozici reálná data).

**2. AI analýza (tlačítko „🤖 Analyzovat pomocí AI" ve formuláři)**
Volá Claude přes vlastní Cloudflare Worker proxy (`cloudflare-worker/ticketflow-ai-proxy.js`).
Na rozdíl od algoritmického skóre umí číst i volné textové poznámky (poznámky k žebříčkům, ke
konkurenčním akcím, k dění na sekundárním trhu) a navrhnout vlastní skóre, rizika a doplňková
kritéria, která nejsou v datovém modelu — přesně to, cos chtěl doplnit navíc. Výsledek se uloží
k události, takže se nemusí počítat znovu při každém otevření.

### Nasazení AI proxy (Cloudflare Worker)

Stejný princip jako AI proxy u FinanceFlow — API klíč nikdy neopouští server.

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Create Worker**
2. Název např. `ticketflow-ai-proxy` → Deploy (zatím s výchozím obsahem)
3. **Edit code** → smaž vše, vlož obsah `cloudflare-worker/ticketflow-ai-proxy.js` → **Deploy**
4. **Settings → Variables and Secrets** → přidej 2 secrets:
   - `ANTHROPIC_API_KEY` — tvůj klíč z [console.anthropic.com](https://console.anthropic.com)
   - `PROXY_SECRET` — libovolný vlastní dlouhý řetězec (heslo mezi appkou a Workerem)
5. Zkopíruj URL Workeru (např. `https://ticketflow-ai-proxy.tvuj-subdomain.workers.dev`)
6. V appce → ⚙ Nastavení → sekce **AI analýza (Claude)** → vlož Worker URL a stejný `PROXY_SECRET`
7. Pokud appku nasazuješ i jinam než na `ticketflow-8e17a.web.app`, uprav `ALLOWED_ORIGINS`
   na začátku Worker souboru

Model je nastavený na `claude-sonnet-5`. Zaškrtávátko „web search" ve Nastavení appky nechává
Claudovi možnost si dohledat aktuální info o interpretovi — přesnější, ale dražší a pomalejší, tak
je defaultně vypnuté.

## Co zatím chybí (další fáze)
- Manuální historie cen na Viagogo (graf vývoje v čase)
- Hromadný přehled/export (Excel, podobně jako TradeFlow daně)
