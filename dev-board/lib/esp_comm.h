#ifndef ESP_COMM_H
#define ESP_COMM_H

#include <Arduino.h>

class ESPComm {
public:
  ESPComm(HardwareSerial &serial, uint32_t baud = 115200);
  void begin();
  bool test(uint32_t timeout = 2000);
  bool connectWiFi(const char* ssid, const char* pass, uint32_t timeout = 20000);
  bool sendTCP(const char* host, uint16_t port, const String &payload, uint32_t timeout = 10000);
  bool sendHTTPS(const char* host, uint16_t port, const String &payload, uint32_t timeout = 10000);
  // Read raw response buffer (wrapper for internal reader)
  String readRawResponse(uint32_t timeout = 2000);

private:
  HardwareSerial* serialPort;
  uint32_t baudRate;

  String readResponse(uint32_t timeout);
  bool sendCommandExpect(const String &cmd, const char* expect, uint32_t timeout);
};

#endif // ESP_COMM_H
