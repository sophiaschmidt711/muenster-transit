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

## Aktueller Stand

Die App nutzt jetzt echte Münster-Livedaten aus dem Busradar-Feed.

### Fertig

- Haltestellen aus der Münster-API
- echte Live-Abfahrten
- Verspätungen und prognostizierte Abfahrtszeit
- Haltestellensuche
- nächste Haltestelle per Geräte-Standort
- Speicherung der zuletzt gewählten Haltestelle
- automatische Aktualisierung alle 20 Sekunden
- mobile chuuchuu-inspirierte Startansicht
- GitHub-Actions-Buildprüfung

### Als Nächstes

1. Fahrt antippen und Fahrtverlauf öffnen
2. echte Live-Karte mit Fahrzeugpositionen
3. Favoriten
4. installierbare PWA mit Service Worker und Icons
5. historische Datensammlung
6. Verspätungsstatistiken
7. Anschlusslogik und Zuverlässigkeitsmodell
8. schnellste vs. sicherste Verbindung

## Lokal starten

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
