#include "../lib/processing.h"
#include "../lib/ports.h"
#include "../lib/supabase_config.h"
#include "../lib/comm_manager.h"
#include <Arduino.h>

String process_buildTelemetry(int v1, int v2, int v3, int v4, bool b1, bool b2, bool b3, bool b4) {
  String payload = "{";
  payload += String("\"v1\":") + v1 + String(",");
  payload += String("\"v2\":") + v2 + String(",");
  payload += String("\"v3\":") + v3 + String(",");
  payload += String("\"v4\":") + v4 + String(",");
  payload += String("\"btn\":{") + String("\"b1\":") + (b1?"1":"0") + String(",") + String("\"b2\":") + (b2?"1":"0") + String(",") + String("\"b3\":") + (b3?"1":"0") + String(",") + String("\"b4\":") + (b4?"1":"0") + String("}");
  payload += String("}");
  return payload;
}

// Minimal command handler: supports `set_iot_led` with payload {"index":0,"state":true}
void process_handleCommand(const String &cmd, const String &payload, long id) {
  if (cmd == "set_iot_led") {
    int iIdx = payload.indexOf("\"index\":");
    int sIdx = payload.indexOf("\"state\":");
    int index = -1;
    bool state = false;
    if (iIdx >= 0) {
      int p = iIdx + 8;
      while (p < payload.length() && (payload[p] == ' ')) p++;
      int pe = p;
      while (pe < payload.length() && isDigit(payload[pe])) pe++;
      index = payload.substring(p, pe).toInt();
    }
    if (sIdx >= 0) {
      int p = sIdx + 8;
      while (p < payload.length() && (payload[p] == ' ')) p++;
      if (payload.substring(p, p + 4) == "true") state = true;
      else state = false;
    }

    if (index == 0) digitalWrite(IOT_LINK_LED, state);
    else if (index == 1) digitalWrite(IOT_RUN_LED, state);

    // Note: updating the command status to 'done' is handled by comm_manager
  }
  else if (cmd == "read_sensors") {
    // immediate telemetry snapshot on demand
    int v1 = analogRead(V_DETECT_1);
    int v2 = analogRead(V_DETECT_2);
    int v3 = analogRead(V_DETECT_3);
    int v4 = analogRead(V_DETECT_4);

    bool b1 = digitalRead(BTN_1) == LOW;
    bool b2 = digitalRead(BTN_2) == LOW;
    bool b3 = digitalRead(BTN_3) == LOW;
    bool b4 = digitalRead(BTN_4) == LOW;

    String payloadBody = process_buildTelemetry(v1, v2, v3, v4, b1, b2, b3, b4);
    String body = String("{\"type\":\"sensors\",\"payload\":") + payloadBody + String("}");
    commSendTelemetry(body);
  }
  // Add more command handlers here as needed
}
