#include <Arduino.h>
#include "../lib/startup.h"
#include "../lib/comm_manager.h"
#include "../lib/processing.h"
#include "../lib/supabase_config.h"
#include "../lib/ports.h"

// Keep setup() small: initialize pins, serial, and communication.
void setup() {
  startup_initSerial(115200);
  startup_initPins();

  // Initialize the ESP communication using Serial1 when available
#ifdef Serial1
  commInit(Serial1);
#else
  commInit(Serial);
#endif

  delay(200);
  Serial.println("Testing ESP connection...");
  if (!commTest()) {
    Serial.println("ESP not responding to AT commands (check wiring/baud)");
  } else {
    Serial.println("ESP OK — attempting WiFi connect");
    if (commConnectWiFi()) {
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

  // Build telemetry payload and send
  String payload = process_buildTelemetry(v1, v2, v3, v4, btn1, btn2, btn3, btn4);
  String body = String("{\"type\":\"sensors\",\"payload\":") + payload + String("}");
  bool sent = commSendTelemetry(body);
  if (sent) Serial.println("Telemetry posted to Supabase");
  else Serial.println("Telemetry post failed");

  // Upsert device status row (lightweight heartbeat)
  // `DEVICE_ID` is defined in supabase_config.h
  commUpsertDeviceStatus(String(DEVICE_ID), String("{}"));

  // Poll for commands occasionally
  static uint32_t lastCmdPoll = 0;
  uint32_t now = millis();
  if (now - lastCmdPoll > 5000) {
    commPollCommands();
    lastCmdPoll = now;
  }

  delay(1000);
}