#include <Arduino.h>
#include "../lib/ports.h"
#include "../lib/esp_comm.h"
#include "../lib/wifi_config.h"

#ifdef Serial1
ESPComm esp(Serial1, 115200);
#else
// Fallback to Serial if Serial1 is not available — update to the correct UART if needed
ESPComm esp(Serial, 115200);
#endif

void setup() {
  // Debug console
  Serial.begin(115200);

  // Initialize V_DETECT pins as inputs
  pinMode(V_DETECT_1, INPUT);
  pinMode(V_DETECT_2, INPUT);
  pinMode(V_DETECT_3, INPUT);
  pinMode(V_DETECT_4, INPUT);

  // Initialize LEDs as outputs
  pinMode(IOT_LINK_LED, OUTPUT);
  pinMode(IOT_RUN_LED, OUTPUT);

  // Initialize button pins as inputs
  pinMode(BTN_1, INPUT_PULLUP);
  pinMode(BTN_2, INPUT_PULLUP);
  pinMode(BTN_3, INPUT_PULLUP);
  pinMode(BTN_4, INPUT_PULLUP);

  // Start ESP serial and attempt to connect to WiFi
  esp.begin();
  delay(200);
  Serial.println("Testing ESP connection...");
  if (!esp.test()) {
    Serial.println("ESP not responding to AT commands (check wiring/baud)");
  } else {
    Serial.println("ESP OK — attempting WiFi connect");
    if (esp.connectWiFi(WIFI_SSID, WIFI_PASS)) {
      Serial.println("WiFi connected");
    } else {
      Serial.println("WiFi connect failed");
    }
  }
}

void loop() {
  // Read V_DETECT values
  int v1 = analogRead(V_DETECT_1);
  int v2 = analogRead(V_DETECT_2);
  int v3 = analogRead(V_DETECT_3);
  int v4 = analogRead(V_DETECT_4);

  // Read button states
  bool btn1 = digitalRead(BTN_1) == LOW;
  bool btn2 = digitalRead(BTN_2) == LOW;
  bool btn3 = digitalRead(BTN_3) == LOW;
  bool btn4 = digitalRead(BTN_4) == LOW;

  // Update LEDs locally
  digitalWrite(IOT_LINK_LED, btn1);
  digitalWrite(IOT_RUN_LED, btn2);

  // Build a small JSON payload (manual, lightweight)
  String payload = "{";
  payload += String("\"v1\":") + v1 + String(",");
  payload += String("\"v2\":") + v2 + String(",");
  payload += String("\"v3\":") + v3 + String(",");
  payload += String("\"v4\":") + v4 + String(",");
  payload += String("\"btn\":{") + String("\"b1\":") + (btn1?"1":"0") + String(",") + String("\"b2\":") + (btn2?"1":"0") + String(",") + String("\"b3\":") + (btn3?"1":"0") + String(",") + String("\"b4\":") + (btn4?"1":"0") + String("}}\n");

  // Send telemetry to dashboard via ESP module
  bool sent = esp.sendTCP(DASHBOARD_HOST, DASHBOARD_PORT, payload);
  if (sent) {
    Serial.println("Telemetry sent");
  } else {
    Serial.println("Telemetry send failed");
  }

  delay(1000);
}