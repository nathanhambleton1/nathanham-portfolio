#ifndef COMM_MANAGER_H
#define COMM_MANAGER_H

#include <Arduino.h>

// Initialize communication with ESP over the provided serial port
void commInit(HardwareSerial &serial);

// Test connectivity to the ESP (AT)
bool commTest(uint32_t timeout = 2000);

// Attempt to connect WiFi using WIFI_SSID / WIFI_PASS defines
bool commConnectWiFi(uint32_t timeout = 20000);

// Send a prebuilt telemetry JSON body to Supabase (returns success)
bool commSendTelemetry(const String &body);

// Upsert a device row in `device_status`. `infoJson` is optional JSON object text (e.g. "{}")
bool commUpsertDeviceStatus(const String &deviceId, const String &infoJson);

// Poll commands and process them (non-blocking-ish)
void commPollCommands();

// Update command status by id (e.g. set to 'done')
bool commUpdateCommandStatus(long id, const char* status);

// Must call before exit to cleanup (optional)
void commShutdown();

#endif // COMM_MANAGER_H
