#include "../lib/esp_comm.h"

ESPComm::ESPComm(HardwareSerial &serial, uint32_t baud): serialPort(&serial), baudRate(baud) {}

void ESPComm::begin() {
  if (serialPort) {
    serialPort->begin(baudRate);
  }
}

String ESPComm::readResponse(uint32_t timeout) {
  String resp;
  uint32_t start = millis();
  while (millis() - start < timeout) {
    while (serialPort && serialPort->available()) {
      char c = (char)serialPort->read();
      resp += c;
    }
    if (resp.length()) {
      // Continue reading a little to gather full responses
      delay(10);
    }
  }
  return resp;
}

String ESPComm::readRawResponse(uint32_t timeout) {
  return readResponse(timeout);
}

bool ESPComm::sendCommandExpect(const String &cmd, const char* expect, uint32_t timeout) {
  if (!serialPort) return false;
  // send command
  serialPort->println(cmd);
  // small delay for command dispatch
  delay(50);
  String r = readResponse(timeout);
  if (r.indexOf(expect) >= 0) return true;
  return false;
}

bool ESPComm::test(uint32_t timeout) {
  // Basic AT check
  return sendCommandExpect("AT", "OK", timeout);
}

bool ESPComm::connectWiFi(const char* ssid, const char* pass, uint32_t timeout) {
  if (!serialPort) return false;
  // Set station mode
  sendCommandExpect("AT+CWMODE=1", "OK", 2000);
  // Attempt to join AP
  String cmd = String("AT+CWJAP=\"") + ssid + "\",\"" + pass + "\"";
  // Connect may take several seconds
  bool ok = sendCommandExpect(cmd, "OK", timeout);
  return ok;
}

bool ESPComm::sendTCP(const char* host, uint16_t port, const String &payload, uint32_t timeout) {
  if (!serialPort) return false;
  // Start connection
  String startCmd = String("AT+CIPSTART=\"TCP\",\"") + host + "\"," + String(port);
  if (!sendCommandExpect(startCmd, "OK", 4000)) {
    // sometimes ESP returns "ALREADY CONNECT" or immediate ">"; continue
    // try to proceed anyway
  }

  // Prepare send length
  uint16_t len = payload.length();
  String sendCmd = String("AT+CIPSEND=") + String(len);
  if (!sendCommandExpect(sendCmd, ">", 4000)) {
    // failed to get prompt
    return false;
  }

  // Send payload
  serialPort->print(payload);
  serialPort->flush();

  // Wait for send confirmation
  String r = readResponse(timeout);
  if (r.indexOf("SEND OK") >= 0 || r.indexOf("SEND OK") >= 0) {
    // close connection
    sendCommandExpect("AT+CIPCLOSE", "OK", 2000);
    return true;
  }

  // try to close
  sendCommandExpect("AT+CIPCLOSE", "OK", 2000);
  return false;
}

bool ESPComm::sendHTTPS(const char* host, uint16_t port, const String &payload, uint32_t timeout) {
  if (!serialPort) return false;
  // Start SSL connection (many AT firmwares accept "SSL" as the protocol)
  String startCmd = String("AT+CIPSTART=\"SSL\",\"") + host + "\"," + String(port);
  if (!sendCommandExpect(startCmd, "OK", 5000)) {
    // sometimes we still get a prompt or ALREADY CONNECT; proceed cautiously
  }

  uint16_t len = payload.length();
  String sendCmd = String("AT+CIPSEND=") + String(len);
  if (!sendCommandExpect(sendCmd, ">", 5000)) {
    return false;
  }

  serialPort->print(payload);
  serialPort->flush();

  String r = readResponse(timeout);
  if (r.indexOf("SEND OK") >= 0) {
    sendCommandExpect("AT+CIPCLOSE", "OK", 2000);
    return true;
  }

  sendCommandExpect("AT+CIPCLOSE", "OK", 2000);
  return false;
}
