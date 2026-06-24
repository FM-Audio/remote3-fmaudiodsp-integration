# FM-Audio DSP Integration für Unfolded Circle Remote 3

## Ziel

Diese Integration schaltet FM-Audio-DSP-Presets direkt von der Unfolded Circle Remote 3 aus. Der Kunde benötigt dafür nur **eine einzelne eigene Integration**: **FM-Audio DSP**.

Es wird keine zusätzliche Requests-Integration, kein externer Server, kein Raspberry Pi, kein Node-RED und keine Home-Assistant-Automation benötigt.

## 10er-Limit: Pagination vs. Custom-Integrationen

Es gibt zwei unterschiedliche Punkte, die leicht verwechselt werden:

1. Manche Remote-3-API-Listen sind standardmäßig auf 10 Einträge pro Seite paginiert.

   ```text
   GET /api/intg/instances
   ```

   kann deshalb nur 10 Einträge anzeigen. Mit größerem Limit sieht man alle Instanzen:

   ```text
   GET /api/intg/instances?limit=100
   ```

2. Für installierte **Custom-Integration-Driver** gibt es ein hartes Limit von 10. Built-in/local Integrationen und Activities sind davon getrennt zu betrachten.

Die FM-Audio-DSP-Integration verbraucht genau **einen** Custom-Integration-Slot:

```text
fmaudiodsp
```

Auf der Referenzanlage sind nach Installation genau 10 Custom-Driver installiert. Falls eine Kundenanlage bereits 10 Custom-Driver hat, muss dort ein ungenutzter Custom-Driver entfernt oder Funktionalität zusammengelegt werden. Für FM-Audio DSP selbst braucht der Kunde aber nur diese eine eigene Integration; die generische Requests-Integration wird dafür nicht benötigt.

Wichtig: Auf der Referenzanlage wurde `requests.main` nicht gelöscht, weil sie noch von der Activity **Musik Vorraum** referenziert wird.

## Integration

- Name: `FM-Audio DSP`
- Driver-ID: `fmaudiodsp`
- Instanz nach Einrichtung: `fmaudiodsp.main`
- konfigurierte Entity: `fmaudiodsp.main.fmaudiodsp.remote`
- Entity-Typ: `remote`
- Feature: `send_cmd`

## Setup-Werte

Beispielwerte der Referenzinstallation:

- DSP IP-Adresse: `192.168.178.192`
- DSP Telnet-Port: `23`
- Anzahl Presets: `4`

## Verfügbare Preset-Befehle

- `PRESET_1`
- `PRESET_2`
- `PRESET_3`
- `PRESET_4`

## DSP-Protokoll

Für Preset `N` sendet die Integration per Telnet:

```text
c0
i0
m4
n4
vN
e
c0
i1
m3
n3
v1
e
```

Jede Zeile wird mit CRLF abgeschlossen. Zwischen den Befehlen ist eine kurze Verzögerung eingebaut.

## Activity / Whiteline Four Seite

Die Activity **FM-Audio Presets** nutzt die native Entity:

```text
fmaudiodsp.main.fmaudiodsp.remote
```

Touchscreen-Buttons:

- Preset 1 → `remote.send_cmd`, Parameter `command=PRESET_1`
- Preset 2 → `remote.send_cmd`, Parameter `command=PRESET_2`
- Preset 3 → `remote.send_cmd`, Parameter `command=PRESET_3`
- Preset 4 → `remote.send_cmd`, Parameter `command=PRESET_4`

Hardbutton-Mapping der Activity:

- `PREV` → `PRESET_1`
- `STOP` → `PRESET_2`
- `PLAY` → `PRESET_3`
- `NEXT` → `PRESET_4`

## Installation für Kunden

1. Remote-3-Webconfigurator öffnen.
2. Custom Integration hochladen:

   ```text
   dist-fmaudiodsp-node-0.1.0.tar.gz
   ```

3. Integration **FM-Audio DSP** hinzufügen/einrichten.
4. DSP-IP, Telnet-Port und Preset-Anzahl eingeben.
5. Verfügbare Entity **FM-Audio DSP** konfigurieren.
6. Activity oder Seite erstellen und die Preset-Kommandos auf die Entity legen.

## Beispiel-Command für Remote-3-API

```json
{
  "entity_id": "fmaudiodsp.main.fmaudiodsp.remote",
  "cmd_id": "remote.send_cmd",
  "params": {
    "command": "PRESET_1"
  }
}
```

## Verifikation auf Referenzanlage

- Driver state: `ACTIVE`
- Instance state: `CONNECTED`
- Entity enabled: `true`
- Activity enthält keine alten `requests.main.remote-custom-fm_preset_*` Referenzen mehr.
- Whiteline-Four-Profil enthält die Seite **FM-Audio** mit der Activity **FM-Audio Presets**.
- Testbefehle `PRESET_1`, `PRESET_2`, `PRESET_3`, `PRESET_4` wurden über die native Entity ausgeführt.
- API-Antwort für alle vier Presets: `Command executed`
- Driver-Logs: `Switched FM-Audio DSP to preset 1..4`

## Release-Artefakt

```text
Datei:  dist-fmaudiodsp-node-0.1.0.tar.gz
Größe:  68K
SHA256: 6b62b19032667f83959f60ef639402334d379b1f34f835884c44a01e428cbd9f
```

## Robustheit

Die Integration nutzt konservative Telnet-Timings und einen automatischen Retry bei transienten DSP/Telnet-Timeouts. Das ist hilfreich, wenn Presets sehr schnell hintereinander geschaltet werden.
