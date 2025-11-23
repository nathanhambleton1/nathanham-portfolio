#include "../lib/comm_manager.h"
#include "../lib/esp_comm.h"
#include "../lib/supabase_config.h"
#include "../lib/wifi_config.h"
#include "../lib/processing.h"
#include <Arduino.h>

static ESPComm *esp = NULL;

void commInit(HardwareSerial &serial) {
  if (esp) return;
  esp = new ESPComm(serial, 115200);
  esp->begin();
}

bool commTest(uint32_t timeout) {
  if (!esp) return false;
  return esp->test(timeout);
}

bool commConnectWiFi(uint32_t timeout) {
  if (!esp) return false;
  return esp->connectWiFi(WIFI_SSID, WIFI_PASS, timeout);
}

static String buildPostRequest(const char *path, const String &body) {
  String req = String("POST ") + path + " HTTP/1.1\r\n";
  req += String("Host: ") + SUPABASE_HOST + "\r\n";
  req += String("apikey: ") + SUPABASE_ANON_KEY + "\r\n";
  req += String("Authorization: Bearer ") + SUPABASE_ANON_KEY + "\r\n";
  req += "Content-Type: application/json\r\n";
  req += String("Content-Length: ") + String(body.length()) + "\r\n";
  req += "\r\n";
  req += body;
  return req;
}

// Build a POST request that includes a Prefer header for upsert/merge
static String buildPostRequestPrefer(const char *path, const String &body, const char* preferHeader) {
  String req = String("POST ") + path + " HTTP/1.1\r\n";
  req += String("Host: ") + SUPABASE_HOST + "\r\n";
  req += String("apikey: ") + SUPABASE_ANON_KEY + "\r\n";
  req += String("Authorization: Bearer ") + SUPABASE_ANON_KEY + "\r\n";
  req += "Content-Type: application/json\r\n";
  if (preferHeader && preferHeader[0]) {
    req += String(preferHeader) + "\r\n";
  }
  req += String("Content-Length: ") + String(body.length()) + "\r\n";
  req += "\r\n";
  req += body;
  return req;
}

// Upsert device status using Prefer: resolution=merge-duplicates
bool commUpsertDeviceStatus(const String &deviceId, const String &infoJson) {
  if (!esp) return false;
  String body = String("{") + "\"device_id\":\"" + deviceId + "\"";
  if (infoJson.length()) {
    body += String(",\"info\":") + infoJson;
  }
  body += String("}");

  const char* prefer = "Prefer: resolution=merge-duplicates";
  String req = buildPostRequestPrefer(SUPABASE_STATUS_PATH, body, prefer);
  return esp->sendHTTPS(SUPABASE_HOST, 443, req);
}

bool commSendTelemetry(const String &body) {
  if (!esp) return false;
  String req = buildPostRequest(SUPABASE_TELEMETRY_PATH, body);
  return esp->sendHTTPS(SUPABASE_HOST, 443, req);
}

// Poll for pending commands and process them
void commPollCommands() {
  if (!esp) return;
  // GET pending commands
  String getReq = String("GET ") + SUPABASE_COMMANDS_PATH + "?status=eq.pending&select=id,cmd,payload HTTP/1.1\r\n";
  getReq += String("Host: ") + SUPABASE_HOST + "\r\n";
  getReq += String("apikey: ") + SUPABASE_ANON_KEY + "\r\n";
  getReq += String("Authorization: Bearer ") + SUPABASE_ANON_KEY + "\r\n";
  getReq += "Accept: application/json\r\n";
  getReq += "\r\n";

  if (!esp->sendHTTPS(SUPABASE_HOST, 443, getReq)) return;

  String resp = esp->readRawResponse(4000);
  int jsonStart = resp.indexOf("[");
  if (jsonStart < 0) return;
  String json = resp.substring(jsonStart);

  // very small parser: look for occurrences of objects with id/cmd/payload
  int idx = json.indexOf("{", 0);
  while (idx >= 0) {
    int objEnd = json.indexOf("}", idx);
    if (objEnd < 0) break;
    String obj = json.substring(idx, objEnd + 1);

    // extract id
    int idPos = obj.indexOf("\"id\":");
    long id = -1;
    if (idPos >= 0) {
      int p = idPos + 6;
      while (p < obj.length() && (obj[p] == ' ')) p++;
      int pe = p;
      while (pe < obj.length() && isDigit(obj[pe])) pe++;
      id = obj.substring(p, pe).toInt();
    }

    // extract cmd
    int cmdPos = obj.indexOf("\"cmd\":");
    String cmd = "";
    if (cmdPos >= 0) {
      int q1 = obj.indexOf('"', cmdPos + 6);
      int q2 = obj.indexOf('"', q1 + 1);
      if (q1 >= 0 && q2 > q1) cmd = obj.substring(q1 + 1, q2);
    }

    // extract payload (assume JSON object following "payload":)
    int payloadPos = obj.indexOf("\"payload\":");
    String payload = "";
    if (payloadPos >= 0) {
      int brace = obj.indexOf('{', payloadPos);
      if (brace >= 0) {
        int depth = 0;
        for (int i = brace; i < obj.length(); i++) {
          if (obj[i] == '{') depth++;
          else if (obj[i] == '}') {
            depth--;
            if (depth == 0) {
              payload = obj.substring(brace, i + 1);
              break;
            }
          }
        }
      }
    }

    if (cmd.length()) {
      process_handleCommand(cmd, payload, id);
    }
      // mark command as done (only if we have a valid id)
      if (id >= 0) {
        commUpdateCommandStatus(id, "done");

        // also log command execution to telemetry for auditing
        String tPayload = String("{\"id\":") + String(id) + String(",\"cmd\":\"") + cmd + String("\",\"payload\":") + (payload.length()?payload:String("{}")) + String("}");
        String tBody = String("{\"type\":\"command\",\"payload\":") + tPayload + String("}");
        commSendTelemetry(tBody);
      }

    idx = json.indexOf("{", objEnd + 1);
  }
}

void commShutdown() {
  if (esp) {
    delete esp;
    esp = NULL;
  }
}

  // Update a command's status (PATCH /rest/v1/commands?id=eq.<id>)
  bool commUpdateCommandStatus(long id, const char* status) {
    if (!esp) return false;
    String path = String(SUPABASE_COMMANDS_PATH) + "?id=eq." + String(id);
    String body = String("{\"status\":\"") + String(status) + String("\"}");

    String req = String("PATCH ") + path + " HTTP/1.1\r\n";
    req += String("Host: ") + SUPABASE_HOST + "\r\n";
    req += String("apikey: ") + SUPABASE_ANON_KEY + "\r\n";
    req += String("Authorization: Bearer ") + SUPABASE_ANON_KEY + "\r\n";
    req += "Content-Type: application/json\r\n";
    req += String("Content-Length: ") + String(body.length()) + "\r\n";
    req += "Prefer: return=representation\r\n";
    req += "\r\n";
    req += body;

    return esp->sendHTTPS(SUPABASE_HOST, 443, req);
  }
