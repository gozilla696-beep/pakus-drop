# Pakus Drop – iPhone/TestFlight Build

Stand: v0.10.0, iOS Build 10
Bundle ID: `com.pakus.drop`

## Vor dem ersten Cloud-Build
1. Node.js installieren/öffnen.
2. Im Projektordner: `npm install`
3. Prüfen: `npm run typecheck`
4. Expo prüfen: `npm run doctor`
5. Bei Expo/EAS anmelden: `npx eas login`
6. Falls noch nicht geschehen: `npx eas build:configure`

## Interner iPhone-Test
`npm run build:ios:preview`

EAS fragt beim ersten iOS-Build nach dem Apple-Developer-Login bzw. nach der Verwaltung der Signierungsdaten. Keine Zertifikate oder Provisioning Profiles manuell erzeugen, solange EAS sie automatisch verwalten kann.

## TestFlight / Produktion
`npm run build:ios:production`

Danach:
`npm run submit:ios`

## Vor Upload prüfen
- App startet ohne Absturz.
- Ton an/aus funktioniert.
- Safe Area passt auf iPhones mit Dynamic Island.
- Hold, Next, Ghost, Pakus Pulse, Pakus Mode und Spezialblöcke funktionieren.
- Game Over + Rescue testen.
- Shop ist aktuell nur Demo. Für öffentliche Veröffentlichung echte StoreKit-IAP anschließen oder Demo-Shop entfernen/deaktivieren.
