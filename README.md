# Münster Transit

Persönliche ÖPNV-App für Münster.

## Ziel

Eine ruhige, mobile-first Oberfläche für:

- Live-Abfahrten
- Live-Fahrzeugpositionen
- komplette Fahrtverläufe
- Haltestellen in der Nähe und Favoriten
- Verspätungsstatistiken
- historische Zuverlässigkeit
- Anschlusswahrscheinlichkeiten
- später: schnellste vs. sicherste Verbindung
- später: installierbare PWA / mögliche native iOS-App

## Designrichtung

Inspiriert von der Informationshierarchie von chuuchuu: große Karten, wenig visuelle Unruhe, klare Statusfarben, Statistik direkt an der Fahrt und eine starke Kartenansicht. Keine 1:1-Kopie.

## V0.1

Die erste Version enthält zunächst Mock-Daten, damit wir die UI festziehen können.

### Screens

1. Jetzt
2. Karte
3. Statistik

### Als Nächstes

1. Datenadapter für `https://rest.busradar.conterra.de/prod`
2. echte Haltestellen + Abfahrten
3. echte Karte mit Leaflet
4. Detailansicht einer Fahrt
5. Speicherung von Favoriten
6. PWA Service Worker + Icons
7. historische Datensammlung
8. Anschlusslogik und Zuverlässigkeitsmodell

## Lokal starten

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
