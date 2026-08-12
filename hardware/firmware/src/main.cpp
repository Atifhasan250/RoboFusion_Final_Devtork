#include <Arduino.h>
#include <DHTesp.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <time.h>

// Wokwi logical pins only. Do not copy these to the unidentified real camera board.
constexpr uint8_t HEARTBEAT_PIN = 2;
constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t IR_TRIGGER_PIN = 5;
constexpr uint8_t PRESENCE_PIN = 6;
constexpr uint8_t MARKER_BIT_0_PIN = 7;
constexpr uint8_t MARKER_BIT_1_PIN = 8;
constexpr uint8_t MARKER_BIT_2_PIN = 9;
constexpr uint8_t NETWORK_PIN = 10;
constexpr uint8_t USER_BUTTON_PIN = 11;
constexpr uint8_t RELAY_PIN = 12;
constexpr uint8_t BUZZER_PIN = 13;
constexpr uint8_t IR_FAULT_PIN = 14;
constexpr uint8_t DHT_FAULT_PIN = 15;

constexpr uint32_t HEARTBEAT_MS = 100;
constexpr uint32_t IR_SAMPLE_MS = 1000;
constexpr uint32_t DHT_SAMPLE_MS = 5000;
constexpr uint32_t PRESENCE_HOLD_MS = 1000;
constexpr uint32_t RECORD_MS = 2000;
constexpr uint32_t SAFETY_HOLD_MS = 1500;
constexpr uint32_t WIFI_RESET_HOLD_MS = 5000;
constexpr uint32_t BUTTON_DEBOUNCE_MS = 35;
constexpr uint32_t STORAGE_LIMIT_BYTES = 170 * 1024;
constexpr size_t RAM_RECORD_CAPACITY = 256;

enum class Presence : uint8_t { UNKNOWN, EMPTY, OCCUPIED };
enum class Marker : uint8_t { UNKNOWN, RED, BLUE, YELLOW, GREEN };
enum class Safety : uint8_t { SAFE, WARNING, DANGER };
enum class Trend : uint8_t { UP, FLAT, DOWN };
enum class Connection : uint8_t { LIVE, OFFLINE, CATCHING_UP };

struct PersistedRecord {
  uint32_t version;
  uint64_t seq;
  uint64_t occurredAt;
  float temperatureC;
  float humidityPct;
  uint32_t clearedRecords;
  uint8_t flags;
  uint8_t presence;
  uint8_t marker;
  uint8_t safety;
  uint8_t trend;
  uint8_t connection;
  uint16_t checksum;
};

static_assert(sizeof(PersistedRecord) < 128, "Persistent records must stay compact");
constexpr uint32_t PERSISTENT_CAPACITY =
    STORAGE_LIMIT_BYTES / sizeof(PersistedRecord);

struct LiveState {
  uint64_t seq = 0;
  bool irConnected = true;
  bool obstacle = false;
  bool climateConnected = false;
  float temperatureC = NAN;
  float humidityPct = NAN;
  Presence presence = Presence::UNKNOWN;
  Marker marker = Marker::UNKNOWN;
  Safety safety = Safety::SAFE;
  Trend trend = Trend::FLAT;
  Connection connection = Connection::LIVE;
  uint32_t clearedRecords = 0;
  uint32_t storageUsedBytes = 0;
  uint32_t pendingUploads = 0;
  String alertId;
  bool alertOpen = false;
  bool alertAcknowledged = false;
  String acknowledgedBy;
  String acknowledgedAt;
};

LiveState state;
PersistedRecord ramRecords[RAM_RECORD_CAPACITY];
size_t ramHead = 0;
size_t ramCount = 0;
uint32_t persistentHead = 0;
uint32_t persistentCount = 0;

DHTesp dht;
Preferences preferences;
WebServer server(80);

uint32_t lastHeartbeatAt = 0;
uint32_t lastIrAt = 0;
uint32_t lastDhtAt = 0;
uint32_t lastRecordAt = 0;
uint32_t lastCatchupAt = 0;
uint32_t presenceCandidateAt = 0;
uint32_t safetyCandidateAt = 0;
uint32_t buttonChangedAt = 0;
uint32_t buttonPressedAt = 0;
bool heartbeatOn = false;
bool rawButton = HIGH;
bool stableButton = HIGH;
Presence presenceCandidate = Presence::UNKNOWN;
Safety safetyCandidate = Safety::SAFE;
float recentTemperatures[5] = {NAN, NAN, NAN, NAN, NAN};
size_t recentTemperatureCount = 0;

const char *presenceName(Presence value) {
  switch (value) {
    case Presence::EMPTY: return "EMPTY";
    case Presence::OCCUPIED: return "OCCUPIED";
    default: return "UNKNOWN";
  }
}

const char *markerName(Marker value) {
  switch (value) {
    case Marker::RED: return "RED";
    case Marker::BLUE: return "BLUE";
    case Marker::YELLOW: return "YELLOW";
    case Marker::GREEN: return "GREEN";
    default: return "UNKNOWN";
  }
}

const char *safetyName(Safety value) {
  switch (value) {
    case Safety::WARNING: return "WARNING";
    case Safety::DANGER: return "DANGER";
    default: return "SAFE";
  }
}

const char *trendName(Trend value) {
  switch (value) {
    case Trend::UP: return "RISING";
    case Trend::DOWN: return "FALLING";
    default: return "STABLE";
  }
}

const char *connectionName(Connection value) {
  switch (value) {
    case Connection::OFFLINE: return "OFFLINE";
    case Connection::CATCHING_UP: return "CATCHING_UP";
    default: return "LIVE";
  }
}

uint16_t checksum(const PersistedRecord &record) {
  const auto *bytes = reinterpret_cast<const uint8_t *>(&record);
  uint16_t value = 0xA55A;
  for (size_t index = 0; index < sizeof(PersistedRecord) - sizeof(record.checksum);
       ++index) {
    value = static_cast<uint16_t>((value << 5) ^ (value >> 11) ^ bytes[index]);
  }
  return value;
}

String isoTime(uint64_t epochSeconds = 0) {
  time_t now = epochSeconds ? static_cast<time_t>(epochSeconds) : time(nullptr);
  if (now < 1700000000) now = 1786500000 + millis() / 1000;
  tm utc{};
  gmtime_r(&now, &utc);
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(buffer);
}

uint64_t eventEpoch() {
  time_t now = time(nullptr);
  return now >= 1700000000 ? static_cast<uint64_t>(now)
                           : 1786500000ULL + millis() / 1000;
}

void persistMetadata() {
  preferences.putULong64("seq", state.seq);
  preferences.putUInt("phead", persistentHead);
  preferences.putUInt("pcount", persistentCount);
  preferences.putUInt("cleared", state.clearedRecords);
}

void writePersistent(PersistedRecord record) {
  uint32_t slot;
  if (persistentCount < PERSISTENT_CAPACITY) {
    slot = (persistentHead + persistentCount) % PERSISTENT_CAPACITY;
    ++persistentCount;
  } else {
    slot = persistentHead;
    persistentHead = (persistentHead + 1) % PERSISTENT_CAPACITY;
    ++state.clearedRecords;
  }

  record.clearedRecords = state.clearedRecords;
  record.checksum = checksum(record);
  File file = LittleFS.open("/records.bin", "r+");
  if (!file) file = LittleFS.open("/records.bin", FILE_WRITE);
  if (!file || !file.seek(slot * sizeof(PersistedRecord), SeekSet) ||
      file.write(reinterpret_cast<const uint8_t *>(&record), sizeof(record)) !=
          sizeof(record)) {
    Serial.println("ERROR storage_write_failed");
  }
  file.close();
  state.storageUsedBytes =
      min<uint32_t>(persistentCount * sizeof(PersistedRecord), STORAGE_LIMIT_BYTES);
  persistMetadata();
}

void addRamRecord(const PersistedRecord &record) {
  const size_t slot = (ramHead + ramCount) % RAM_RECORD_CAPACITY;
  if (ramCount < RAM_RECORD_CAPACITY) {
    ramRecords[slot] = record;
    ++ramCount;
  } else {
    ramRecords[ramHead] = record;
    ramHead = (ramHead + 1) % RAM_RECORD_CAPACITY;
  }
}

Marker readMarker() {
  const uint8_t code = (digitalRead(MARKER_BIT_0_PIN) == LOW ? 1 : 0) |
                       (digitalRead(MARKER_BIT_1_PIN) == LOW ? 2 : 0) |
                       (digitalRead(MARKER_BIT_2_PIN) == LOW ? 4 : 0);
  switch (code) {
    case 1: return Marker::RED;
    case 2: return Marker::BLUE;
    case 3: return Marker::YELLOW;
    case 4: return Marker::GREEN;
    default: return Marker::UNKNOWN;
  }
}

void updatePresence(uint32_t now) {
  const Presence raw = digitalRead(PRESENCE_PIN) == LOW ? Presence::OCCUPIED
                                                        : Presence::EMPTY;
  if (raw != presenceCandidate) {
    presenceCandidate = raw;
    presenceCandidateAt = now;
  } else if (state.presence != raw && now - presenceCandidateAt >= PRESENCE_HOLD_MS) {
    state.presence = raw;
    Serial.printf("VISION presence=%s source=SIMULATED_CAMERA\n",
                  presenceName(state.presence));
  }
  state.marker = readMarker();
}

Safety rawSafety() {
  if (!state.climateConnected) return state.safety;
  if (state.temperatureC >= 35 || state.humidityPct >= 85) return Safety::DANGER;
  if (state.temperatureC >= 30 || state.humidityPct >= 70) return Safety::WARNING;
  return Safety::SAFE;
}

void updateAlarmOutputs() {
  const bool active = state.safety == Safety::DANGER;
  digitalWrite(RELAY_PIN, active ? LOW : HIGH);  // Wokwi NPN relay is active-low.
  if (active) {
    tone(BUZZER_PIN, 880);
  } else {
    noTone(BUZZER_PIN);
  }
}

void updateSafety(uint32_t now) {
  const Safety raw = rawSafety();
  if (raw != safetyCandidate) {
    safetyCandidate = raw;
    safetyCandidateAt = now;
  } else if (state.safety != raw && now - safetyCandidateAt >= SAFETY_HOLD_MS) {
    const Safety previous = state.safety;
    state.safety = raw;
    updateAlarmOutputs();
    Serial.printf("SAFETY status=%s trend=%s\n", safetyName(state.safety),
                  trendName(state.trend));
    if (state.safety == Safety::DANGER && previous != Safety::DANGER) {
      state.alertId = "wokwi-alert-" + String(static_cast<unsigned long>(state.seq + 1));
      state.alertOpen = true;
      state.alertAcknowledged = false;
      state.acknowledgedBy = "";
      state.acknowledgedAt = "";
      Serial.printf("ALERT opened id=%s\n", state.alertId.c_str());
    } else if (previous == Safety::DANGER && state.safety != Safety::DANGER) {
      state.alertOpen = false;
    }
  }
}

void updateTrend(float temperature) {
  if (!isfinite(temperature)) return;
  if (recentTemperatureCount < 5) {
    recentTemperatures[recentTemperatureCount++] = temperature;
  } else {
    for (size_t index = 1; index < 5; ++index) {
      recentTemperatures[index - 1] = recentTemperatures[index];
    }
    recentTemperatures[4] = temperature;
  }
  if (recentTemperatureCount < 3) {
    state.trend = Trend::FLAT;
    return;
  }
  const float delta = recentTemperatures[recentTemperatureCount - 1] -
                      recentTemperatures[0];
  state.trend = delta > 0.7 ? Trend::UP
                            : delta < -0.7 ? Trend::DOWN : Trend::FLAT;
}

bool acknowledgeAlert(const char *source) {
  if (!state.alertOpen || state.alertAcknowledged) return false;
  state.alertAcknowledged = true;
  state.acknowledgedBy = source;
  state.acknowledgedAt = isoTime();
  Serial.printf("ACK winner alertId=%s source=%s\n", state.alertId.c_str(), source);
  return true;
}

void updateButton(uint32_t now) {
  const bool reading = digitalRead(USER_BUTTON_PIN);
  if (reading != rawButton) {
    rawButton = reading;
    buttonChangedAt = now;
  }
  if (now - buttonChangedAt < BUTTON_DEBOUNCE_MS || reading == stableButton) return;
  stableButton = reading;
  if (stableButton == LOW) {
    buttonPressedAt = now;
  } else {
    const uint32_t held = now - buttonPressedAt;
    if (held >= WIFI_RESET_HOLD_MS) {
      preferences.remove("wifi_ssid");
      preferences.remove("device_name");
      Serial.println("WIFI_RESET simulated_credentials_cleared setup_mode_requested");
    } else if (held < 2000) {
      acknowledgeAlert("physical");
    }
  }
}

void updateConnection(uint32_t now) {
  const bool logicalOnline = digitalRead(NETWORK_PIN) == HIGH;
  if (!logicalOnline) {
    state.connection = Connection::OFFLINE;
    return;
  }
  if (state.pendingUploads > 0) {
    state.connection = Connection::CATCHING_UP;
    if (now - lastCatchupAt >= 250) {
      lastCatchupAt = now;
      --state.pendingUploads;
      Serial.printf("CATCHUP remaining=%lu exactly_once_id=stable\n",
                    static_cast<unsigned long>(state.pendingUploads));
    }
  } else {
    state.connection = Connection::LIVE;
  }
}

PersistedRecord makeRecord() {
  PersistedRecord record{};
  record.version = 1;
  record.seq = ++state.seq;
  record.occurredAt = eventEpoch();
  record.temperatureC = state.temperatureC;
  record.humidityPct = state.humidityPct;
  record.flags = (state.irConnected ? 1 : 0) | (state.obstacle ? 2 : 0) |
                 (state.climateConnected ? 4 : 0) |
                 (state.alertAcknowledged ? 8 : 0);
  record.presence = static_cast<uint8_t>(state.presence);
  record.marker = static_cast<uint8_t>(state.marker);
  record.safety = static_cast<uint8_t>(state.safety);
  record.trend = static_cast<uint8_t>(state.trend);
  record.connection = static_cast<uint8_t>(state.connection);
  record.clearedRecords = state.clearedRecords;
  record.checksum = checksum(record);
  return record;
}

void createCombinedRecord() {
  updateTrend(state.temperatureC);
  PersistedRecord record = makeRecord();
  addRamRecord(record);
  writePersistent(record);
  if (state.connection == Connection::OFFLINE) ++state.pendingUploads;
  Serial.printf(
      "RECORD seq=%llu ram=%u/256 storage=%lu/%lu cleared=%lu connection=%s\n",
      record.seq, static_cast<unsigned>(ramCount),
      static_cast<unsigned long>(state.storageUsedBytes),
      static_cast<unsigned long>(STORAGE_LIMIT_BYTES),
      static_cast<unsigned long>(state.clearedRecords), connectionName(state.connection));
}

String stateJson() {
  String json;
  json.reserve(900);
  json += "{\"deviceId\":\"wokwi-device\",\"seq\":" + String(state.seq);
  json += ",\"occurredAt\":\"" + isoTime() + "\"";
  json += ",\"source\":\"SIMULATION\"";
  json += ",\"ir\":{\"connected\":" + String(state.irConnected ? "true" : "false");
  if (state.irConnected) json += ",\"occupiedRaw\":" + String(state.obstacle ? "true" : "false");
  json += "},\"climate\":{\"connected\":" + String(state.climateConnected ? "true" : "false");
  if (state.climateConnected) {
    json += ",\"temperatureC\":" + String(state.temperatureC, 1);
    json += ",\"humidityPct\":" + String(state.humidityPct, 1);
  }
  json += "},\"presence\":\"" + String(presenceName(state.presence)) + "\"";
  json += ",\"marker\":\"" + String(markerName(state.marker)) + "\"";
  json += ",\"overallStatus\":\"" + String(safetyName(state.safety)) + "\"";
  json += ",\"trend\":\"" + String(trendName(state.trend)) + "\"";
  json += ",\"connectionState\":\"" + String(connectionName(state.connection)) + "\"";
  json += ",\"storage\":{\"limitBytes\":" + String(STORAGE_LIMIT_BYTES);
  json += ",\"usedBytes\":" + String(state.storageUsedBytes);
  json += ",\"clearedRecords\":" + String(state.clearedRecords) + "}";
  if (state.alertOpen || state.alertAcknowledged) {
    json += ",\"alert\":{\"alertId\":\"" + state.alertId + "\",\"state\":\"";
    json += state.alertAcknowledged ? "ACKNOWLEDGED" : "OPEN";
    json += "\"";
    if (state.alertAcknowledged) {
      json += ",\"acknowledgedBy\":\"" + state.acknowledgedBy + "\"";
      json += ",\"acknowledgedAt\":\"" + state.acknowledgedAt + "\"";
    }
    json += "}";
  }
  json += "}";
  return json;
}

String recordJson(const PersistedRecord &record) {
  String json = "{\"eventId\":\"wokwi-device-" + String(record.seq) + "\"";
  json += ",\"deviceId\":\"wokwi-device\",\"seq\":" + String(record.seq);
  json += ",\"occurredAt\":\"" + isoTime(record.occurredAt) + "\"";
  json += ",\"source\":\"" + String(record.connection == static_cast<uint8_t>(Connection::CATCHING_UP) ? "catchup" : "live") + "\"";
  json += ",\"ir\":{\"connected\":" + String(record.flags & 1 ? "true" : "false") +
          ",\"occupiedRaw\":" + String(record.flags & 2 ? "true" : "false") + "}";
  json += ",\"climate\":{\"connected\":" + String(record.flags & 4 ? "true" : "false") +
          ",\"temperatureC\":" + String(record.temperatureC, 1) +
          ",\"humidityPct\":" + String(record.humidityPct, 1) + "}";
  json += ",\"presence\":\"" + String(presenceName(static_cast<Presence>(record.presence))) + "\"";
  json += ",\"marker\":\"" + String(markerName(static_cast<Marker>(record.marker))) + "\"";
  json += ",\"overallStatus\":\"" + String(safetyName(static_cast<Safety>(record.safety))) + "\"";
  json += ",\"trend\":\"" + String(trendName(static_cast<Trend>(record.trend))) + "\"";
  json += ",\"connectionState\":\"" + String(connectionName(static_cast<Connection>(record.connection))) + "\"";
  json += "}";
  return json;
}

void serveDashboard() {
  static const char page[] PROGMEM = R"HTML(<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>RoboFusion Wokwi Twin</title><style>body{font:15px system-ui;margin:0;background:#f4f6f2;color:#262927}.wrap{max-width:900px;margin:auto;padding:24px}.notice,.card{background:white;border:1px solid #e4e8e2;border-radius:18px;padding:18px;margin:14px 0}.notice{background:#e9f7ef}pre{white-space:pre-wrap;word-break:break-word}.pill{display:inline-block;background:#15965f;color:white;border-radius:99px;padding:5px 10px}</style></head><body><main class="wrap"><h1>RoboFusion Wokwi Behavioral Twin</h1><div class="notice"><b>SIMULATION</b> — switches emulate IR/camera/network scenarios. This is not real optical-camera evidence.</div><div class="card"><span class="pill" id="status">Loading</span><h2>Device state</h2><pre id="state"></pre></div><div class="card"><h2>Rolling records</h2><div id="count">0 / 256</div></div></main><script>async function tick(){try{const s=await fetch('/api/v1/state').then(r=>r.json());state.textContent=JSON.stringify(s,null,2);status.textContent=s.connectionState+' · '+s.overallStatus;const r=await fetch('/api/v1/records?limit=256').then(r=>r.json());count.textContent=r.count+' / 256';}catch(e){status.textContent='Unavailable'}}tick();setInterval(tick,1000)</script></body></html>)HTML";
  server.send(200, "text/html", page);
}

void serveRecords() {
  int limit = server.hasArg("limit") ? server.arg("limit").toInt() : 256;
  limit = constrain(limit, 1, 256);
  const size_t count = min<size_t>(ramCount, static_cast<size_t>(limit));
  const size_t start = ramCount - count;
  String json = "{\"items\":[";
  for (size_t index = 0; index < count; ++index) {
    const size_t slot = (ramHead + start + index) % RAM_RECORD_CAPACITY;
    if (index) json += ',';
    json += recordJson(ramRecords[slot]);
  }
  json += "],\"count\":" + String(count) + "}";
  server.send(200, "application/json", json);
}

void serveCameraPlaceholder() {
  const String svg = "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'><rect width='100%' height='100%' fill='#dce8df'/><text x='50%' y='44%' text-anchor='middle' font-family='sans-serif' font-size='28' fill='#262927'>SIMULATED CAMERA INPUT</text><text x='50%' y='56%' text-anchor='middle' font-family='sans-serif' font-size='18' fill='#59605b'>" + String(presenceName(state.presence)) + " · " + String(markerName(state.marker)) + "</text></svg>";
  server.send(200, "image/svg+xml", svg);
}

void handleUnknownRoute() {
  const String uri = server.uri();
  const String prefix = "/api/v1/alerts/";
  const String suffix = "/ack";
  if (server.method() == HTTP_POST && uri.startsWith(prefix) && uri.endsWith(suffix)) {
    const String requestedId = uri.substring(prefix.length(), uri.length() - suffix.length());
    if (requestedId != state.alertId) {
      server.send(404, "application/json", "{\"error\":\"alert_not_found\"}");
      return;
    }
    const bool accepted = acknowledgeAlert("dashboard");
    String response = "{\"alertId\":\"" + state.alertId + "\",\"accepted\":" +
                      String(accepted ? "true" : "false") +
                      ",\"acknowledgedBy\":\"" + state.acknowledgedBy +
                      "\",\"acknowledgedAt\":\"" + state.acknowledgedAt + "\"}";
    server.send(200, "application/json", response);
    return;
  }
  server.send(404, "application/json", "{\"error\":\"not_found\"}");
}

void setupWebServer() {
  server.on("/", HTTP_GET, serveDashboard);
  server.on("/api/v1/state", HTTP_GET,
            [] { server.send(200, "application/json", stateJson()); });
  server.on("/api/v1/records", HTTP_GET, serveRecords);
  server.on("/api/v1/camera", HTTP_GET, serveCameraPlaceholder);
  server.onNotFound(handleUnknownRoute);
  server.begin();
}

void setup() {
  Serial.begin(115200);
  pinMode(HEARTBEAT_PIN, OUTPUT);
  pinMode(IR_TRIGGER_PIN, INPUT_PULLUP);
  pinMode(PRESENCE_PIN, INPUT_PULLUP);
  pinMode(MARKER_BIT_0_PIN, INPUT_PULLUP);
  pinMode(MARKER_BIT_1_PIN, INPUT_PULLUP);
  pinMode(MARKER_BIT_2_PIN, INPUT_PULLUP);
  pinMode(NETWORK_PIN, INPUT_PULLUP);
  pinMode(USER_BUTTON_PIN, INPUT_PULLUP);
  pinMode(IR_FAULT_PIN, INPUT_PULLUP);
  pinMode(DHT_FAULT_PIN, INPUT_PULLUP);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);
  dht.setup(DHT_PIN, DHTesp::DHT22);

  LittleFS.begin(true);
  preferences.begin("robofusion", false);
  state.seq = preferences.getULong64("seq", 0);
  persistentHead = preferences.getUInt("phead", 0) % PERSISTENT_CAPACITY;
  persistentCount = min<uint32_t>(preferences.getUInt("pcount", 0), PERSISTENT_CAPACITY);
  state.clearedRecords = preferences.getUInt("cleared", 0);
  state.storageUsedBytes = min<uint32_t>(persistentCount * sizeof(PersistedRecord), STORAGE_LIMIT_BYTES);

  WiFi.mode(WIFI_STA);
  WiFi.begin("Wokwi-GUEST", "", 6);
  const uint32_t wifiStartedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wifiStartedAt < 12000) {
    delay(10);
  }
  if (WiFi.status() == WL_CONNECTED) {
    configTime(0, 0, "pool.ntp.org");
    Serial.printf("WIFI simulation_adapter_connected ip=%s\n",
                  WiFi.localIP().toString().c_str());
  } else {
    Serial.println("WIFI simulation_adapter_unavailable dashboard_offline");
  }
  setupWebServer();
  presenceCandidate = digitalRead(PRESENCE_PIN) == LOW ? Presence::OCCUPIED
                                                       : Presence::EMPTY;
  presenceCandidateAt = millis();
  safetyCandidateAt = millis();
  Serial.printf("ROBOFUSION_READY profile=WOKWI storageLimit=%lu recordSize=%u persistentCapacity=%lu\n",
                static_cast<unsigned long>(STORAGE_LIMIT_BYTES),
                static_cast<unsigned>(sizeof(PersistedRecord)),
                static_cast<unsigned long>(PERSISTENT_CAPACITY));
}

void loop() {
  const uint32_t now = millis();
  server.handleClient();

  if (now - lastHeartbeatAt >= HEARTBEAT_MS) {
    lastHeartbeatAt += HEARTBEAT_MS;
    heartbeatOn = !heartbeatOn;
    digitalWrite(HEARTBEAT_PIN, heartbeatOn);
  }

  if (now - lastIrAt >= IR_SAMPLE_MS) {
    lastIrAt = now;
    state.irConnected = digitalRead(IR_FAULT_PIN) == HIGH;
    state.obstacle = state.irConnected && digitalRead(IR_TRIGGER_PIN) == LOW;
    if (state.irConnected) {
      Serial.printf("IR connected=true obstacle=%s\n", state.obstacle ? "true" : "false");
    } else {
      Serial.println("ERROR ir_sensor_disconnected heartbeat_continues=true");
    }
  }

  if (now - lastDhtAt >= DHT_SAMPLE_MS) {
    lastDhtAt = now;
    const TempAndHumidity reading = dht.getTempAndHumidity();
    state.climateConnected = digitalRead(DHT_FAULT_PIN) == HIGH &&
                             isfinite(reading.temperature) && isfinite(reading.humidity);
    if (state.climateConnected) {
      state.temperatureC = reading.temperature;
      state.humidityPct = reading.humidity;
      Serial.printf("DHT connected=true temperature=%.1f humidity=%.1f\n",
                    state.temperatureC, state.humidityPct);
    } else {
      Serial.println("ERROR dht_sensor_unavailable other_tasks_continue=true");
    }
  }

  updatePresence(now);
  updateSafety(now);
  updateButton(now);
  updateConnection(now);

  if (now - lastRecordAt >= RECORD_MS) {
    lastRecordAt = now;
    createCombinedRecord();
  }

  if (Serial.available()) {
    const char command = static_cast<char>(Serial.read());
    if (command == 'F' || command == 'f') {
      for (int index = 0; index < 300; ++index) createCombinedRecord();
      Serial.printf("FAST_FILL complete ram=%u expected=256\n",
                    static_cast<unsigned>(ramCount));
    }
  }
  delay(1);
}
