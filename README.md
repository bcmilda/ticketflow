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

## Co zatím chybí (další fáze)
- Scoring systém — automatické skóre atraktivity 0–100 z výše uvedených dat
- Manuální historie cen na Viagogo (graf vývoje v čase)
- Hromadný přehled/export (Excel, podobně jako TradeFlow daně)
