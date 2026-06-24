# FM-Audio DSP Integration für Unfolded Circle Remote 3

## Ziel

Diese Integration steuert FM-Audio-DSP-/AllDSP-Geräte direkt von der Unfolded Circle Remote 3 aus per Telnet. Der Kunde benötigt dafür nur **eine einzelne eigene Integration**: **FM-Audio DSP**.

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

Falls eine Kundenanlage bereits 10 Custom-Driver hat, muss dort ein ungenutzter Custom-Driver entfernt oder Funktionalität zusammengelegt werden. Für FM-Audio DSP selbst braucht der Kunde aber nur diese eine eigene Integration; die generische Requests-Integration wird dafür nicht benötigt.

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
- DSP-PIN-Code: leer, nur ausfüllen, wenn das Gerät PIN-geschützt ist

Die Preset-Anzahl ist in Version 0.2.0 von **2 bis 100** auswählbar. Standard bleibt **4**.

Hinweis zur Referenzanlage von Nils: Obwohl der Treiber bis 100 Presets unterstützt, ist Nils' eigene Remote-3-Oberfläche absichtlich nur auf **4 Presets** eingestellt.

## Verfügbare Befehle

Standardmäßig sind diese Preset-Befehle verfügbar:

- `PRESET_1`
- `PRESET_2`
- `PRESET_3`
- `PRESET_4`

Bei höherer Preset-Anzahl werden die Befehle dynamisch nach dem Muster `PRESET_N` erzeugt, z. B.:

```text
PRESET_1 ... PRESET_100
```

Zusätzliche sichere DSP-Befehle aus der AllDSP-Telnet-Anleitung:

- `STANDBY` — Standby aktivieren
- `WAKE` — Standby verlassen
- `LOCATE` — Locate/Wink

Gain und Mute sind in der AllDSP-Telnet-Anleitung ebenfalls beschrieben, werden aber in dieser Version bewusst nicht in die Kundenoberfläche integriert. Preset-Wechsel, Standby, Wake, Locate und optionale PIN-Eingabe sind eindeutige Einzelaktionen. Gain/Mute brauchen dagegen ein eigenes UX-/Statuskonzept, damit keine unbeabsichtigten Audioänderungen entstehen.

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

Das entspricht der AllDSP-Telnet-Anleitung:

- Select Preset: Item `4`, Sub-item `4`, Value `N`
- Command: Item `3`, Sub-item `3`
- Load Preset: Command-Index `1`, Value `1`

Falls ein DSP-PIN-Code konfiguriert ist, wird er vor den eigentlichen Befehlen gesendet:

```text
c0
i0
m5
n5
v<PIN>
e
```

Zusatzbefehle verwenden Item `3`, Sub-item `3`, Value `1` mit folgenden Index-Werten:

- `i4` = Standby
- `i5` = Wake / Standby verlassen
- `i6` = Locate / Wink

Jede Zeile wird mit CRLF abgeschlossen. Zwischen den Befehlen ist eine kurze Verzögerung eingebaut.

## Automatische Preset-Seiten

Die Integration erzeugt die Preset-Seiten dynamisch:

- 8 Preset-Buttons pro Seite
- 4 Presets = 1 Preset-Seite
- 100 Presets = 13 Preset-Seiten

Die konkrete Kundenoberfläche kann trotzdem weniger Presets anzeigen. Auf Nils' Referenz-Remote bleibt die Integration auf vier Presets eingestellt; die Activity **FM-Audio Presets** zeigt zusätzlich die Werkzeugbefehle Standby, Wake und Locate.

## Activity / Whiteline Four Seite

Die Activity **FM-Audio Presets** nutzt die native Entity:

```text
fmaudiodsp.main.fmaudiodsp.remote
```

Touchscreen-Buttons auf Nils' Referenz-Remote, Seite **Presets + Tools**:

- Preset 1 → `remote.send_cmd`, Parameter `command=PRESET_1`
- Preset 2 → `remote.send_cmd`, Parameter `command=PRESET_2`
- Preset 3 → `remote.send_cmd`, Parameter `command=PRESET_3`
- Preset 4 → `remote.send_cmd`, Parameter `command=PRESET_4`
- Standby → `remote.send_cmd`, Parameter `command=STANDBY`
- Wake → `remote.send_cmd`, Parameter `command=WAKE`
- Locate → `remote.send_cmd`, Parameter `command=LOCATE`

Hardbutton-Mapping der Activity:

- `PREV` → `PRESET_1`
- `STOP` → `PRESET_2`
- `PLAY` → `PRESET_3`
- `NEXT` → `PRESET_4`

## Installation für Kunden

1. Remote-3-Webconfigurator öffnen.
2. Custom Integration hochladen:

   ```text
   dist-fmaudiodsp-node-0.2.0.tar.gz
   ```

3. Integration **FM-Audio DSP** hinzufügen/einrichten.
4. DSP-IP, Telnet-Port, Preset-Anzahl und optionalen DSP-PIN-Code eingeben.
5. Verfügbare Entity **FM-Audio DSP** konfigurieren.
6. Activity oder Seite erstellen und die gewünschten Preset-Kommandos auf die Entity legen.

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

Für weitere Presets entsprechend `PRESET_2`, `PRESET_50` oder `PRESET_100` verwenden, sofern diese Preset-Anzahl in der Integration eingerichtet ist.

## Verifikation auf Referenzanlage

- Driver-Version: `0.2.0`
- Instance state: `CONNECTED`
- Setup-Daten der Referenzanlage: `preset_count=4`
- Entity enabled: `true`
- Entity-Befehle auf der Referenzanlage: `PRESET_1`, `PRESET_2`, `PRESET_3`, `PRESET_4`, `STANDBY`, `WAKE`, `LOCATE`
- Activity enthält keine alten `requests.main.remote-custom-fm_preset_*` Referenzen mehr.
- Activity-Seite **Presets + Tools** enthält `PRESET_1` bis `PRESET_4` sowie `STANDBY`, `WAKE` und `LOCATE`.
- Kein `PRESET_5` und kein `PRESET_100` in Nils' Activity-Oberfläche.
- Whiteline-Four-Profil enthält die Seite **FM-Audio** mit der Activity **FM-Audio Presets**.
- Lokaler Treibertest mit `presetCount=100`: 100 Preset-Befehle und 13 Preset-Seiten werden generiert.

## Release-Artefakt

```text
Datei:  dist-fmaudiodsp-node-0.2.0.tar.gz
Größe:  72K
SHA256: e89b30012591b62add8fa0590921591f64908d975a369d0ea669b55430367a02
```

## Robustheit

Die Integration nutzt konservative Telnet-Timings und einen automatischen Retry bei transienten DSP/Telnet-Timeouts. Das ist hilfreich, wenn Presets sehr schnell hintereinander geschaltet werden.
